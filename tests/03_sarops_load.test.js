
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login here' }).click();
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('admin@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('grigware');
  await page.getByLabel('Check Into Incident').selectOption('123');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Operations' }).click();

  // Assign roles to the Staff team
  await page.locator('div').filter({ hasText: /^Staff$/ }).first().click();
  await page.getByText('Responder 10').first().dragTo(page.getByText(/assign Operations/i));
  await page.getByText('Responder 11').first().dragTo(page.getByText(/assign Planning/i));
  await page.getByText('Responder 12').first().dragTo(page.getByText(/assign Logistics/i));
  await page.getByText('Responder 13').first().dragTo(page.getByText(/assign Admin/i));

  await page.getByRole('button', { name: 'Save' }).waitFor();
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'ICS Chart' }).click();
  await expect(page.getByText('Responder 10')).toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Operations' }).click();
  // Create Team1 and assign Sarah Miller (K9) and Responder 14 to it
  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('Sarah Miller (K9)').first().dragTo(page.getByRole('cell', { name: /Drop chip here to assign Team/i }));
  await page.getByText('Responder 14').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Sarah Miller (K9)')).toBeVisible();

  // Create Team2 and assign James Chen (UAS) and Responder 11 to it
  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('James Chen (UAS)').first().dragTo(page.getByRole('cell', { name: 'Drop chip here to assign Team Leader...' }));
  await page.getByText('Responder 15').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('James Chen (UAS)')).toBeVisible();

  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('Responder 16').first().dragTo(page.getByRole('cell', { name: 'Drop chip here to assign Team Leader...' }));
  await page.getByText('Responder 17').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Responder 16')).toBeVisible();

  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('Responder 18').first().dragTo(page.getByRole('cell', { name: 'Drop chip here to assign Team Leader...' }));
  await page.getByText('Responder 19').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Responder 18')).toBeVisible();

  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('Responder 20').first().dragTo(page.getByRole('cell', { name: 'Drop chip here to assign Team Leader...' }));
  await page.getByText('Responder 21').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Responder 20')).toBeVisible();

  await page.getByRole('columnheader', { name: 'Team New' }).getByRole('button').click();
  await page.getByText('Responder 22').first().dragTo(page.getByRole('cell', { name: /Drop chip here to assign Team/i }));
  await page.getByText('Responder 23').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Responder 22')).toBeVisible();

  // Log out
  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Check Out' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();
});