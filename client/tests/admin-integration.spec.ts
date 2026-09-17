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

test('administrator workflow navigation connects dashboard, users, assignments and progress', async ({
  page,
}) => {
  await signIn(page);

  let workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await expect(workflow).toBeVisible();
  await expect(
    workflow.getByRole('link', { name: 'Open administrator dashboard' }),
  ).toHaveAttribute('aria-current', 'page');

  await workflow.getByRole('link', { name: 'Open users & job roles' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { name: 'Users & job roles' })).toBeVisible();
  workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await expect(
    workflow.getByRole('link', { name: 'Open users & job roles' }),
  ).toHaveAttribute('aria-current', 'page');

  await workflow.getByRole('link', { name: 'Open training assignments' }).click();
  await expect(page).toHaveURL(/\/admin\/assignments$/);
  await expect(
    page.getByRole('heading', { name: 'Training assignments' }),
  ).toBeVisible();
  workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await expect(
    workflow.getByRole('link', { name: 'Open training assignments' }),
  ).toHaveAttribute('aria-current', 'page');

  await workflow.getByRole('link', { name: 'Open progress monitoring' }).click();
  await expect(page).toHaveURL(/\/admin\/progress$/);
  await expect(page.getByRole('heading', { name: 'Progress & results' })).toBeVisible();
  workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await expect(
    workflow.getByRole('link', { name: 'Open progress monitoring' }),
  ).toHaveAttribute('aria-current', 'page');

  await workflow.getByRole('link', { name: 'Open administrator dashboard' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Administrator dashboard' }),
  ).toBeVisible();
});
