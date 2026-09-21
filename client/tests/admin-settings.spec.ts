import { expect, test, type Page } from '@playwright/test';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('administrator settings shares profile state with the shell and supports account security', async ({ page }) => {
  await signIn(page);
  let avatar = false;
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 2, firstName: 'KISTS', lastName: 'Administrator', email: administrator, systemRole: 'administrator', jobRole: null, avatarUrl: avatar ? '/api/admin/settings/avatar?v=1' : null } }) }));
  await page.route('**/api/admin/settings/avatar', async (route) => {
    if (route.request().method() === 'POST') { avatar = true; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avatarUrl: '/api/admin/settings/avatar?v=1' }) }); return; }
    if (route.request().method() === 'DELETE') { avatar = false; await route.fulfill({ status: 204 }); return; }
    await route.fulfill({ status: 200, contentType: 'image/png', body: '' });
  });
  await page.route('**/api/admin/settings/password', async (route) => {
    const body = route.request().postDataJSON() as { currentPassword: string };
    await route.fulfill(body.currentPassword === 'wrong-password' ? { status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'The current password is incorrect.' } }) } : { status: 204 });
  });
  await page.reload();

  const profileLink = page.getByRole('link', { name: 'Open administrator settings' });
  await expect(profileLink).toBeVisible();
  await profileLink.press('Enter');
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Administrator navigation' }).getByRole('link', { name: 'Settings' })).toHaveClass(/active/);
  await expect(profileLink).toContainText('KISTS Administrator');
  await expect(page.locator('.admin-shell-avatar')).toHaveText('KA');
  await expect(page.locator('.settings-avatar')).toHaveText('KA');
  await expect(page.getByText(administrator, { exact: true })).toBeVisible();
  await expect(page.locator('#main-content').getByText('Administrator', { exact: true })).toBeVisible();

  await page.getByLabel('Upload photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(page.getByText('Profile photo updated.')).toBeVisible();
  await expect(page.locator('.admin-shell-avatar img')).toBeVisible();
  await expect(page.locator('.settings-avatar img')).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByText('Profile photo removed.')).toBeVisible();
  await expect(page.locator('.admin-shell-avatar')).toHaveText('KA');
  await expect(page.locator('.settings-avatar')).toHaveText('KA');

  await page.getByRole('button', { name: 'Change password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await dialog.getByLabel('Current password').fill('wrong-password');
  await dialog.getByLabel(/^New password/).fill('A-valid-password-123');
  await dialog.getByLabel('Confirm new password').fill('A-valid-password-123');
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(dialog.getByText('The current password is incorrect.')).toBeVisible();
});
