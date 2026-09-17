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

test('administrator users page lists trainees, filters accounts and opens the trainee form responsively', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole('heading', { name: 'Users & job roles' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'User account summary' }),
  ).toBeVisible();
  const response = await page.request.get('/api/admin/users');
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    users: Array<{ firstName: string; email: string }>;
  };
  expect(data.users.length).toBeGreaterThanOrEqual(1);
  const first = data.users[0]!;
  await page.getByLabel('Search trainees').fill(first.email);
  await expect(page.getByText(first.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add trainee' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByText('System role: TRAINEE', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
