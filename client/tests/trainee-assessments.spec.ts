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

function assignment(id = assignmentId, title = 'Manual Handling') {
  return {
    assignmentId: id,
    moduleId: id,
    title,
    description: 'Assigned safety training.',
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
}

function dashboard(assignments: unknown[]) {
  return {
    trainee: {
      id: 1,
      firstName: 'Alex',
      lastName: 'Morgan',
      email: trainee,
      systemRole: 'trainee',
      avatarUrl: null,
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

test('assessment centre shows only relevant passed assessments and real result data', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        dashboard([
          assignment(),
          assignment(88, 'Forklift and Pedestrian Safety'),
        ]),
      ),
    }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/scenario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ progress: { completed: true } }),
      }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/assessment`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignmentId,
          assessment: {
            title: 'Manual Handling Final Assessment',
            description:
              'Final graded assessment for Manual Handling safety training.',
            passPercentage: 75,
          },
          questions: Array.from({ length: 10 }),
          latestAttempt: {
            attemptNumber: 1,
            scorePercentage: 90,
            passPercentage: 75,
            passed: true,
            submittedAt: '2026-09-19T10:00:00.000Z',
          },
        }),
      }),
  );
  await page.route('**/api/trainee/training/88/**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'ASSESSMENT_NOT_FOUND', message: 'Not found' },
      }),
    }),
  );
  await page.goto('/trainee/assessments');
  await expect(
    page.getByRole('heading', { name: 'My Assessments' }),
  ).toBeVisible();
  await expect(page.getByText('Planned functionality')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Manual Handling Final Assessment' }),
  ).toBeVisible();
  await expect(page.getByText('Forklift and Pedestrian Safety')).toHaveCount(0);
  await expect(page.getByText('90%')).toBeVisible();
  await expect(page.getByText('75%')).toBeVisible();
  await expect(page.getByText('19 September 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Result' })).toHaveAttribute(
    'href',
    `/trainee/training/${assignmentId}/assessment`,
  );
  await expect(
    page.getByRole('link', { name: 'Start Assessment' }),
  ).toHaveCount(0);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 960 },
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

test('locked assessment exposes prerequisites without bypassing them', async ({
  page,
}) => {
  await signIn(page);
  const locked = {
    ...assignment(),
    status: 'in_progress',
    progressPercentage: 50,
    learningProgressPercentage: 100,
  };
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboard([locked])),
    }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/scenario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ progress: { completed: false } }),
      }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/assessment`,
    (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'ASSESSMENT_SCENARIO_LOCKED',
            message: 'Complete the scenario.',
          },
        }),
      }),
  );
  await page.goto('/trainee/assessments');
  await expect(page.getByText('Locked', { exact: true })).toBeVisible();
  await expect(
    page
      .getByText('Interactive scenario')
      .locator('..')
      .getByText('Incomplete'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue Training' }),
  ).toHaveAttribute('href', `/trainee/training/${assignmentId}`);
  await expect(
    page
      .locator('.assessment-centre-card footer')
      .getByRole('link', { name: /Assessment|Result/ }),
  ).toHaveCount(0);
});

test('assessment centre shows an empty state when no relevant assessment exists', async ({
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
  await page.goto('/trainee/assessments');
  await expect(
    page.getByRole('heading', { name: 'No assessments assigned' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Go to My Training' }),
  ).toHaveAttribute('href', '/trainee/training');
});
