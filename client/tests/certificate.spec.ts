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
    page.getByRole('heading', { name: 'Certificate not available yet' }),
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
  await expect(
    page.getByRole('heading', { name: 'Your digital certificate' }),
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
    page.getByText('Manual Handling', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Manual Handling Final Assessment', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('KISTS-20260917-ABCDEF123456')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Print / Save as PDF' }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
