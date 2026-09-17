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

test('administrator assignments page lists database assignments, filters them and opens the assignment form', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Assignments', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/assignments$/);
  await expect(
    page.getByRole('heading', { name: 'Training assignments' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Training assignment summary' }),
  ).toBeVisible();

  const response = await page.request.get('/api/admin/assignments');
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    assignments: Array<{ traineeEmail: string }>;
    trainees: Array<{ id: number }>;
    modules: Array<{ id: number }>;
  };
  expect(data.assignments.length).toBeGreaterThanOrEqual(1);
  expect(data.trainees.length).toBeGreaterThanOrEqual(1);
  expect(data.modules.length).toBeGreaterThanOrEqual(1);

  const first = data.assignments[0]!;
  await page.getByLabel('Search assignments').fill(first.traineeEmail);
  await expect(
    page.getByText(first.traineeEmail, { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Assign training' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByText('Create training assignment', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Trainee', { exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Training module', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Required training', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Optional training', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
});
