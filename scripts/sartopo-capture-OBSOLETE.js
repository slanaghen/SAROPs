const fs = require('fs');
const { chromium } = require('playwright');

// Environment variables:
// SARTOPO_URL - required (map or map list URL)
// SARTOPO_EMAIL - optional (for login)
// SARTOPO_PASSWORD - optional (for login)
// IMPORT_ENDPOINT - optional HTTP endpoint to POST the captured GeoJSON
// SARTOPO_WAIT_MS - optional extra wait after load (default 5000)

async function tryFill(page, selectors, value) {
  for (const s of selectors) {
    const el = await page.$(s);
    if (el) {
      try { await page.fill(s, value); return true; } catch (e) { /* ignore */ }
    }
  }
  return false;
}

(async () => {
  const MAP_URL = process.env.SARTOPO_URL;
  const SARTOPO_EMAIL = process.env.SARTOPO_EMAIL;
  const SARTOPO_PASSWORD = process.env.SARTOPO_PASSWORD;
  const IMPORT_ENDPOINT = process.env.IMPORT_ENDPOINT;
  const WAIT_MS = parseInt(process.env.SARTOPO_WAIT_MS || '5000', 10);

  if (!MAP_URL) {
    console.error('SARTOPO_URL must be set');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const found = [];
  page.on('response', async (res) => {
    try {
      const headers = res.headers();
      const ct = (headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json') || ct.includes('application/geo+json') || ct.includes('application/vnd.geo+json')) {
        const text = await res.text();
        if (text && text.includes('"features"')) {
          try {
            const json = JSON.parse(text);
            if (json && Array.isArray(json.features)) found.push(json);
          } catch (e) {
            // ignore non-json
          }
        }
      }
    } catch (e) {
      // ignore response parsing errors
    }
  });

  await page.goto(MAP_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // If a password input exists and credentials provided, attempt login using common selectors
  const pwd = await page.$('input[type="password"], input[name="password"]');
  if (pwd && SARTOPO_EMAIL && SARTOPO_PASSWORD) {
    await tryFill(page, ['input[name="email"]','input[type="email"]','input[name="username"]','input[name="user"]','input#email'], SARTOPO_EMAIL);
    await tryFill(page, ['input[type="password"]','input[name="password"]','input#password'], SARTOPO_PASSWORD);
    // try to click a login button
    const btn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Sign In")');
    if (btn) {
      try { await btn.click(); } catch (e) { /* ignore */ }
    }
    try { await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { /* continue */ }
  }

  // Give the map some time to fetch layers
  await page.waitForTimeout(WAIT_MS);

  await browser.close();

  if (found.length === 0) {
    console.error('No GeoJSON-like network responses found.');
    process.exit(3);
  }

  // Pick the largest features payload
  const geo = found.sort((a, b) => (b.features?.length || 0) - (a.features?.length || 0))[0];
  fs.writeFileSync('exported.geojson', JSON.stringify(geo, null, 2));
  console.log('Saved exported.geojson with', (geo.features||[]).length, 'features');

  if (IMPORT_ENDPOINT) {
    try {
      const res = await fetch(IMPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geo)
      });
      const text = await res.text();
      console.log('Import endpoint response:', res.status, text);
    } catch (e) {
      console.error('Failed to POST to IMPORT_ENDPOINT:', e.message);
      process.exit(4);
    }
  }
  process.exit(0);
})();
