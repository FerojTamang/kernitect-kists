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

test('administrator progress page summarizes, filters and responsively displays monitoring records', async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole('link', { name: 'Progress & results', exact: true })
    .click();

  await expect(page).toHaveURL(/\/admin\/progress$/);
  await expect(
    page.getByRole('heading', { name: 'Progress & results' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Progress summary' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Progress filters' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Trainee progress records' }),
  ).toBeVisible();

  const response = await page.request.get('/api/admin/progress');
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    records: Array<{
      traineeEmail: string;
      trainingModuleTitle: string;
      trainingModuleId: number;
    }>;
  };
  expect(data.records.length).toBeGreaterThanOrEqual(1);

  const first = data.records[0]!;
  const matchingEmailRecords = data.records.filter(
    (record) => record.traineeEmail === first.traineeEmail,
  ).length;

  await page.getByLabel('Search trainees').fill(first.traineeEmail);
  await expect(page.getByText(first.traineeEmail, { exact: true }).first()).toBeVisible();
  await expect(page.locator('.admin-progress-filter-meta')).toContainText(
    `Showing ${matchingEmailRecords} of ${data.records.length} assignments`,
  );

  await page.getByLabel('Training module').selectOption(String(first.trainingModuleId));
  const progressRecords = page.getByRole('region', { name: 'Trainee progress records' });
  await expect(
    progressRecords.getByText(first.trainingModuleTitle, { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Search trainees')).toHaveValue('');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.admin-progress-card').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
