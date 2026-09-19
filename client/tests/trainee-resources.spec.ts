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

test('resource library filters local guides and opens an accessible dialog', async ({ page }) => {
  await signIn(page);
  await page.goto('/trainee/resources');
  await expect(page.getByRole('heading', { name: 'Safety Resources' })).toBeVisible();
  await expect(page.getByText('KISTS / Workspace preview')).toHaveCount(0);
  await expect(page.locator('.resource-card')).toHaveCount(6);
  await expect(page.getByText('6', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'PPE', exact: true }).click();
  await expect(page.locator('.resource-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'PPE Quick Guide' })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();

  const checklist = page.locator('.resource-card').filter({ hasText: 'Manual Handling Checklist' });
  const viewButton = checklist.getByRole('button', { name: 'View Resource' });
  await viewButton.click();
  const dialog = page.getByRole('dialog', { name: 'Manual Handling Checklist' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Before lifting' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(viewButton).toBeFocused();

  await viewButton.click();
  await page.getByRole('button', { name: 'Close resource' }).click();
  await expect(dialog).toHaveCount(0);
});

test('resource cards remain responsive without document overflow', async ({ page }) => {
  await signIn(page);
  await page.goto('/trainee/resources');
  for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 900 }, { width: 768, height: 960 }, { width: 1024, height: 900 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
