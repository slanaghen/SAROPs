
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
  await page.getByRole('link', { name: 'Administration' }).click();
  
  // Seed the responder data
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Seed Data' }).click();
  
  // Log out
  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).waitFor();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Check Out' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();
});