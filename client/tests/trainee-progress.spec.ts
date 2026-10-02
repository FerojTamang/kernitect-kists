import { expect, test, type Page } from '@playwright/test';
import { createTrainee, removeTrainee, trainee } from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
const assignmentId = 77;

test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(trainee);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
}

function dashboard(assignments: unknown[]) {
  return {
    trainee: {
      id: 1,
      firstName: 'Alex',
      lastName: 'Morgan',
      email: trainee,
      systemRole: 'trainee',
    },
    summary: {
      totalAssigned: assignments.length,
      completed: assignments.length,
      inProgress: 0,
      notStarted: 0,
      overallProgressPercentage: assignments.length ? 100 : 0,
    },
    assignedTraining: assignments,
  };
}

const manualHandling = {
  assignmentId,
  moduleId: 1,
  title: 'Manual Handling',
  description: 'Safe lifting and handling techniques.',
  required: true,
  status: 'completed',
  progressPercentage: 100,
  learningProgressPercentage: 100,
  learningCompletedSections: 5,
  learningTotalSections: 5,
  assignedAt: '2026-09-01T00:00:00.000Z',
  dueAt: null,
  nextAction: 'review',
};

test('progress page presents real completed training records and remains responsive', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboard([manualHandling])),
    }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/scenario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          progress: { completedHazards: 5, totalHazards: 5, completed: true },
        }),
      }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/assessment`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          latestAttempt: { scorePercentage: 90, passed: true },
        }),
      }),
  );
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
          certificateNumber: 'KISTS-20260919-001',
          issuedAt: '2026-09-19T10:00:00.000Z',
          traineeName: 'Alex Morgan',
          status: 'issued',
          training: [
            {
              assignmentId,
              moduleTitle: 'Manual Handling',
              completedAt: '2026-09-19T09:00:00.000Z',
              assessments: [],
            },
          ],
        },
      }),
    }),
  );

  await page.goto('/trainee/progress');
  await expect(
    page.getByRole('heading', { name: 'My Progress' }),
  ).toBeVisible();
  await expect(page.getByText('KISTS / Workspace preview')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Manual Handling' }),
  ).toBeVisible();
  await expect(page.getByText('5 of 5 sections · Complete')).toBeVisible();
  await expect(page.getByText('5 of 5 safety points · Complete')).toBeVisible();
  await expect(page.getByText('90% · Passed')).toBeVisible();
  await expect(page.getByText('KISTS-20260919-001')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Review Training' }),
  ).toHaveAttribute('href', `/trainee/training/${assignmentId}`);
  await expect(
    page.getByRole('link', { name: 'View Certificate' }),
  ).toHaveAttribute('href', '/trainee/certificates/700');
  await expect(page.getByText('Forklift and Pedestrian Safety')).toHaveCount(0);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('progress page shows a truthful empty state when no training is assigned', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboard([])),
    }),
  );
  await page.route('**/api/trainee/certificates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: false,
        certificate: null,
        completion: {
          requiredAssignments: 0,
          completedAssignments: 0,
          requiredAssessments: 0,
          passedAssessments: 0,
        },
      }),
    }),
  );
  await page.goto('/trainee/progress');
  await expect(
    page.getByRole('heading', { name: 'No training assigned yet' }),
  ).toBeVisible();
  await expect(page.locator('.trainee-progress-card')).toHaveCount(0);
});
