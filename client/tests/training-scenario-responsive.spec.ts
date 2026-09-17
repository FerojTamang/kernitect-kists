import { expect, test, type Page } from '@playwright/test';
import {
  createTrainee,
  prepareScenarioReadyTrainee,
  removeTrainee,
  trainee,
} from './trainee-fixture';

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

test('Manual Handling learning remains responsive across key breakpoints', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'My Training' }).click();
  await page
    .getByRole('region', { name: 'Assigned training modules' })
    .getByRole('link', { name: /Start Learning|Continue Learning/ })
    .click();

  await expect(page).toHaveURL(/\/trainee\/training\/\d+$/);

  const viewports = [
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole('heading', { name: 'What is manual handling?' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('Manual Handling 360 scenario remains responsive across key breakpoints', async ({
  page,
}) => {
  await prepareScenarioReadyTrainee();
  await signIn(page);
  await page.getByRole('link', { name: 'Scenarios' }).click();
  await page.getByRole('link', { name: /Open Scenario/ }).click();

  await expect(page).toHaveURL(/\/trainee\/training\/\d+\/scenario$/);

  const viewports = [
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole('heading', { name: 'Warehouse Manual Handling Scenario' }),
    ).toBeVisible();
    await expect(page.getByText('360° interactive scenario')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Safety point 1' }).last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    390.5,
  );
});
