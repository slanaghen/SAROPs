import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/checkin');
  // Check in a responder
  await page.getByRole('textbox', { name: 'Full Name *' }).click();
  await page.getByRole('textbox', { name: 'Full Name *' }).fill('Responder');
  await page.getByRole('textbox', { name: 'Agency *' }).click();
  await page.getByRole('textbox', { name: 'Agency *' }).fill('BCSO');
  await page.getByRole('textbox', { name: 'Identifier *' }).click();
  await page.getByRole('textbox', { name: 'Identifier *' }).fill('1234');
  await page.getByRole('textbox', { name: 'Cell Phone Number *' }).click();
  await page.getByRole('textbox', { name: 'Identifier *' }).fill('123412');
  await page.getByRole('textbox', { name: 'Cell Phone Number *' }).fill('312-312-31234');
  await page.getByRole('radio', { name: 'SAR' }).check();
  await page.getByRole('button', { name: 'Continue to Confirmation' }).click();
  await page.getByRole('button', { name: 'Confirm Check-In' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Check Out' }).click();
  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });

  // Log in as admin and verify the checked-in responder is visible in the Planning page
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login here' }).click();
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('admin@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('grigware');
  await page.getByLabel('Check Into Incident— Don\'t').selectOption('123');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Planning' }).click();
  // Create a new responder in the Planning page
  await page.getByRole('button', { name: 'New Responder' }).click();
  await page.getByRole('textbox', { name: 'Full Name' }).click();
  await page.getByRole('textbox', { name: 'Full Name' }).fill('The New Responder');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  // Create a new team and assign the new responder and an existing responder to it
  await page.getByRole('button', { name: 'New Team' }).click();
  await page.getByRole('textbox', { name: 'Team Name' }).click();
  await page.getByRole('textbox', { name: 'Team Name' }).fill('The New Team');
  await page.getByText('The New Responder').first().dragTo(page.getByRole('cell', { name: 'Drop chip here to assign Team' }));
  await page.getByText('Responder 29').first().dragTo(page.getByRole('cell', { name: 'Drop chips here to add' }));
  await page.getByRole('button', { name: 'Save' }).click();

  // Create a new assignment and assign the new team to it
  await page.getByRole('button', { name: 'New Assignment' }).click();
  await page.getByRole('textbox', { name: 'Assignment Title' }).click();
  await page.getByRole('textbox', { name: 'Assignment Title' }).fill('The New Assignment');
  await page.getByRole('button', { name: 'Save Assignment' }).click();
  await page.getByText('The New Team').dragTo(page.getByRole('cell', { name: 'The New Assignment' }));

  // Log out
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Check Out' }).click();
  await page.getByRole('button', { name: 'Confirm Check-Out' }).click();
  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
});