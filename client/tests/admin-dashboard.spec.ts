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

test('administrator dashboard shows live workforce training information and remains responsive', async ({
  page,
}) => {
  await signIn(page);

  await expect(
    page.getByRole('heading', { name: 'Administrator dashboard' }),
  ).toBeVisible();
  await expect(
    page.locator('.sidebar-footer').getByText('KISTS Administrator', {
      exact: true,
    }),
  ).toBeVisible();

  const summary = page.getByRole('region', {
    name: 'Administrator training summary',
  });
  await expect(summary).toBeVisible();
  await expect(
    summary.getByText('Total trainees', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Active assignments', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Completed training', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Certificates issued', { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'Training overview' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Trainee progress' }),
  ).toBeVisible();

  const dashboardResponse = await page.request.get('/api/admin/dashboard');
  expect(dashboardResponse.status()).toBe(200);
  const dashboard = (await dashboardResponse.json()) as {
    summary: { totalTrainees: number };
  };
  expect(dashboard.summary.totalTrainees).toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Administrator dashboard' }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
