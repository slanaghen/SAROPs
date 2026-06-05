import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login here' }).click();
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('admin@gmail.com');
  await page.getByRole('textbox', { name: 'Username' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('grigware');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('button', { name: '+ New' }).nth(4).click();
  await page.getByRole('textbox', { name: 'Incident Narrative' }).click();
  await page.getByRole('textbox', { name: 'Incident Narrative' }).fill('Find Jill. She\'s gone missing.');
  await page.getByRole('textbox', { name: 'Situational Awareness' }).click();
  await page.getByRole('textbox', { name: 'Situational Awareness' }).fill('Watch out for snakes.');
  await page.getByRole('button', { name: 'Start Incident Tracking' }).click();
  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.getByRole('button', { name: 'Seed Data' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Operations' }).click();
  await page.locator('div').filter({ hasText: /^Staff$/ }).click();
  await page.getByText('Sarah Miller (K9)K9 Search').click();
  await page.locator(page.getByText('Responder 1', { exact: true })).dragTo(page.locator(page.getByText('Drop chip here to assign Operations...')));
});