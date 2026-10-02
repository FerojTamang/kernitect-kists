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

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test('trainee dashboard and training remain responsive across key breakpoints', async ({
  page,
}) => {
  await signIn(page);

  const viewports = [
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    await page.goto('/trainee/dashboard');
    await expect(
      page.getByRole('heading', { name: /Welcome back,/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/trainee/training');
    await expect(
      page.getByRole('heading', { name: 'Your assigned training' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trainee/dashboard');

  const sidebarBox = await page
    .locator('.trainee-shell .sidebar')
    .boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect((sidebarBox?.x ?? 0) + (sidebarBox?.width ?? 0)).toBeLessThanOrEqual(
    390.5,
  );

  await page.goto('/trainee/training');
  const moduleCardBox = await page
    .locator('.assigned-module-card')
    .first()
    .boundingBox();
  expect(moduleCardBox).not.toBeNull();
  expect(
    (moduleCardBox?.x ?? 0) + (moduleCardBox?.width ?? 0),
  ).toBeLessThanOrEqual(390.5);
});
