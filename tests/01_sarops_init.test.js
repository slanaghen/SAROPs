import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login here' }).click();
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('staff@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('grigware');
  await page.getByLabel('Check Into Incident— Don\'t').selectOption('NEW_INCIDENT');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Incident' }).click();
  await page.getByRole('textbox', { name: 'Incident Name' }).click();
  await page.getByRole('textbox', { name: 'Incident Name' }).fill('Test Mission');
  await page.getByRole('textbox', { name: 'Incident Number' }).click();
  await page.getByRole('textbox', { name: 'Incident Number' }).fill('123');
  await page.getByRole('textbox', { name: 'SARTopo Map ID' }).click();
  await page.getByRole('textbox', { name: 'SARTopo Map ID' }).fill('CVJP9L4');
  await page.getByRole('textbox', { name: 'Incident Narrative' }).click();
  await page.getByRole('textbox', { name: 'Incident Narrative' }).fill('We need to find Bill.');
  await page.getByRole('textbox', { name: 'Situational Awareness' }).click();
  await page.getByRole('textbox', { name: 'Situational Awareness' }).fill('Watch out for snakes.');
  await page.getByRole('spinbutton', { name: 'PAR/Status Check Interval (' }).click();
  await page.getByRole('spinbutton', { name: 'PAR/Status Check Interval (' }).fill('10');
  await page.getByRole('button', { name: 'Start Incident Tracking' }).click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Operations' }).click();
  await expect(page.getByText('Steve Staff')).toBeVisible();

  // Stay logged in...
});