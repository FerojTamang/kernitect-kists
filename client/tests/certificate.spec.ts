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

test('certificate page explains outstanding completion requirements', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/certificates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: false,
        certificate: null,
        completion: {
          requiredAssignments: 2,
          completedAssignments: 1,
          requiredAssessments: 1,
          passedAssessments: 1,
        },
      }),
    }),
  );

  await page.goto('/trainee/certificates');
  await expect(
    page.getByRole('heading', { name: 'No certificates yet' }),
  ).toBeVisible();
  await expect(page.getByText('1 / 2')).toBeVisible();
});

test('issued digital certificate displays evidence and supports print or PDF save', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/certificates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: true,
        completion: {
          requiredAssignments: 1,
          completedAssignments: 1,
          requiredAssessments: 1,
          passedAssessments: 1,
        },
        certificate: {
          id: 700,
          certificateNumber: 'KISTS-20260917-ABCDEF123456',
          issuedAt: '2026-09-17T12:00:00.000Z',
          traineeName: 'Alex Morgan',
          status: 'issued',
          training: [
            {
              assignmentId: 34,
              moduleTitle: 'Manual Handling',
              completedAt: '2026-09-17T11:59:00.000Z',
              assessments: [
                {
                  assessmentId: 200,
                  title: 'Manual Handling Final Assessment',
                  attemptNumber: 2,
                  scorePercentage: 100,
                  passPercentage: 75,
                },
              ],
            },
          ],
        },
      }),
    }),
  );

  await page.goto('/trainee/certificates');
  await expect(page.getByRole('heading', { name: 'My Certificates' })).toBeVisible();
  await expect(page.getByText('Certificates earned')).toBeVisible();
  await expect(page.getByText('Latest certificate')).toBeVisible();
  const libraryCard = page.locator('.certificate-library-card');
  await expect(libraryCard.getByText('17 September 2026')).toBeVisible();
  await expect(libraryCard.getByText('KISTS-20260917-ABCDEF123456')).toBeVisible();
  await page.getByRole('link', { name: 'View Certificate' }).click();
  await expect(page).toHaveURL(/\/trainee\/certificates\/700$/);
  await expect(
    page.getByRole('heading', { name: 'Digital Certificate' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Certificate of Completion' }),
  ).toBeVisible();
  const certificate = page.getByRole('article', {
    name: 'KISTS digital certificate',
  });
  await expect(
    certificate.getByText('Alex Morgan', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('MANUAL HANDLING SAFETY TRAINING', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('KISTS-20260917-ABCDEF123456')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download certificate' }),
  ).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await certificate.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const inner = element.querySelector('.certificate-document-inner')?.getBoundingClientRect();
      return { width: box.width, height: box.height, bottom: box.bottom, innerHeight: inner?.height ?? 0 };
    });
    expect(dimensions.width).toBeGreaterThan(800);
    expect(dimensions.height).toBeGreaterThan(450);
    expect(dimensions.bottom).toBeLessThanOrEqual(viewport.height);
    expect(dimensions.innerHeight).toBeLessThanOrEqual(dimensions.height);
    expect(dimensions.width / dimensions.height).toBeCloseTo(297 / 210, 1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
