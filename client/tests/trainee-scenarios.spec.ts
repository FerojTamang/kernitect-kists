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

function assignment(
  id = assignmentId,
  title = 'Manual Handling',
  complete = true,
) {
  return {
    assignmentId: id,
    moduleId: id,
    title,
    description: 'Assigned safety training.',
    required: true,
    status: complete ? 'in_progress' : 'not_started',
    progressPercentage: complete ? 50 : 0,
    learningProgressPercentage: complete ? 100 : 20,
    learningCompletedSections: complete ? 5 : 1,
    learningTotalSections: 5,
    assignedAt: '2026-09-01T00:00:00.000Z',
    dueAt: null,
    nextAction: 'continue',
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
      completed: 0,
      inProgress: assignments.length,
      notStarted: 0,
      overallProgressPercentage: 50,
    },
    assignedTraining: assignments,
  };
}

function scenario(completedHazards: number, completed = false) {
  return {
    assignmentId,
    scenario: {
      title: 'Interactive Warehouse Safety Scenario',
      description:
        'Identify warehouse hazards and choose safer manual-handling actions.',
    },
    progress: { completedHazards, totalHazards: 5, completed },
  };
}

test('Scenario Centre shows only relevant ready scenario with a dynamic route', async ({
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
        body: JSON.stringify(scenario(0)),
      }),
  );
  await page.route('**/api/trainee/training/88/scenario', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'SCENARIO_NOT_FOUND', message: 'Not found' },
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/trainee/scenarios');
  await expect(
    page.getByRole('heading', { name: 'Safety Scenarios' }),
  ).toBeVisible();
  await expect(page.getByText('Learning comes first')).toHaveCount(0);
  await expect(
    page.getByRole('heading', {
      name: 'Interactive Warehouse Safety Scenario',
    }),
  ).toBeVisible();
  await expect(page.getByText('Forklift and Pedestrian Safety')).toHaveCount(0);
  const action = page.getByRole('link', { name: /Start Scenario/ });
  await expect(action).toHaveAttribute(
    'href',
    `/trainee/training/${assignmentId}/scenario`,
  );
  const box = await action.boundingBox();
  expect(box && box.y + box.height <= 900).toBeTruthy();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1536, height: 864 },
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

test('Scenario Centre presents locked prerequisites without bypassing learning', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        dashboard([assignment(assignmentId, 'Manual Handling', false)]),
      ),
    }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/scenario`,
    (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'SCENARIO_LOCKED', message: 'Complete learning.' },
        }),
      }),
  );
  await page.goto('/trainee/scenarios');
  await expect(page.getByText('Locked', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Complete all required learning sections/),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Continue Learning/ }),
  ).toHaveAttribute('href', `/trainee/training/${assignmentId}`);
});

test('Scenario Centre shows completed progress and review action', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dashboard([assignment()])),
    }),
  );
  await page.route(
    `**/api/trainee/training/${assignmentId}/scenario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scenario(5, true)),
      }),
  );
  await page.goto('/trainee/scenarios');
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('5 of 5 safety points completed')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Review Scenario/ }),
  ).toHaveAttribute('href', `/trainee/training/${assignmentId}/scenario`);
});
