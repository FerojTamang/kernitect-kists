import { expect, test, type Page } from '@playwright/test';
import { createTrainee, removeTrainee, trainee } from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(trainee);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
}

test('settings renders managed profile, avatar controls, password dialog and persistent motion preference', async ({
  page,
}) => {
  await signIn(page);
  let avatar = false;
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 1,
          firstName: 'Alex',
          lastName: 'Morgan',
          email: trainee,
          systemRole: 'trainee',
          jobRole: 'Warehouse Operative',
          avatarUrl: avatar ? '/api/trainee/settings/avatar?v=1' : null,
        },
      }),
    }),
  );
  await page.route('**/api/trainee/settings/avatar', async (route) => {
    if (route.request().method() === 'POST') {
      avatar = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avatarUrl: '/api/trainee/settings/avatar?v=1' }),
      });
      return;
    }
    if (route.request().method() === 'DELETE') {
      avatar = false;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'image/png', body: '' });
  });
  await page.route('**/api/trainee/settings/password', async (route) => {
    const body = route.request().postDataJSON() as { currentPassword: string };
    await route.fulfill(
      body.currentPassword === 'wrong-password'
        ? {
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { message: 'The current password is incorrect.' },
            }),
          }
        : { status: 204 },
    );
  });

  await page.goto('/trainee/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('AM', { exact: true })).toBeVisible();
  const profile = page.locator('.settings-profile-card');
  await expect(
    profile.getByRole('heading', { name: 'Alex Morgan' }),
  ).toBeVisible();
  await expect(profile.getByText(trainee, { exact: true })).toBeVisible();
  await expect(
    profile.getByText('Warehouse Operative', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText('Managed by administrator')).toHaveCount(3);
  await expect(page.getByText('KISTS / Workspace preview')).toHaveCount(0);

  await page.getByLabel('Upload photo').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await expect(page.getByText('Profile photo updated.')).toBeVisible();
  await page.goto('/trainee/dashboard');
  await expect(
    page.locator('.dashboard-profile .profile-avatar img'),
  ).toBeVisible();
  await page.goto('/trainee/settings');
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByText('Profile photo removed.')).toBeVisible();
  await page.goto('/trainee/dashboard');
  await expect(page.locator('.dashboard-profile .profile-avatar')).toHaveText(
    'AM',
  );
  await expect(
    page.locator('.dashboard-profile .profile-avatar img'),
  ).toHaveCount(0);
  await page.goto('/trainee/settings');

  await page.getByRole('button', { name: 'Change password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await dialog.getByLabel('Current password').fill('wrong-password');
  await dialog.getByLabel(/^New password/).fill('A-valid-password-123');
  await dialog
    .getByLabel('Confirm new password')
    .fill('different-password-123');
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(
    dialog.getByText('New password and confirmation must match.'),
  ).toBeVisible();
  await dialog.getByLabel('Confirm new password').fill('A-valid-password-123');
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(
    dialog.getByText('The current password is incorrect.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('checkbox', { name: 'Reduce motion' }).check();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('kists:preferences:reduce-motion'),
      ),
    )
    .toBe('true');
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Reduce motion' }),
  ).toBeChecked();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 960 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
