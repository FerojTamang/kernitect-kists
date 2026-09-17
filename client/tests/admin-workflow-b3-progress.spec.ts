import { expect, test, type Page } from '@playwright/test';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';
const workflowEmail = 'phase9e.b1.trainee@example.invalid';

type Assignment = {
  id: number;
  traineeId: number;
  traineeEmail: string;
  trainingModuleId: number;
  trainingModuleTitle: string;
  required: boolean;
  status: 'active' | 'cancelled';
};

type AssignmentsPayload = {
  assignments: Assignment[];
};

type ProgressRecord = {
  assignmentId: number;
  traineeEmail: string;
  trainingModuleId: number;
  trainingModuleTitle: string;
  required: boolean;
  assignmentStatus: 'active' | 'cancelled';
  progressPercentage: number;
  learningCompleted: number;
  learningTotal: number;
  scenarioCompleted: number;
  scenarioTotal: number;
  assessmentTotal: number;
  assessmentPassed: number;
  assessmentAttempts: number;
  certificateIssued: boolean;
};

type ProgressPayload = {
  records: ProgressRecord[];
};

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('9E-B3 administrator can trace the workflow trainee assignment into progress and results', async ({
  page,
}) => {
  await signIn(page);

  const assignmentsResponse = await page.request.get('/api/admin/assignments');
  expect(assignmentsResponse.status()).toBe(200);
  const assignmentsData = (await assignmentsResponse.json()) as AssignmentsPayload;

  const workflowAssignments = assignmentsData.assignments.filter(
    (item) => item.traineeEmail === workflowEmail && item.status === 'active',
  );
  expect(
    workflowAssignments.length,
    '9E-B2 should leave at least one active training assignment for the workflow trainee',
  ).toBeGreaterThanOrEqual(1);

  const assignment =
    workflowAssignments.find((item) => item.trainingModuleTitle === 'Manual Handling') ??
    workflowAssignments[0]!;

  const progressResponse = await page.request.get('/api/admin/progress');
  expect(progressResponse.status()).toBe(200);
  const progressData = (await progressResponse.json()) as ProgressPayload;

  const record = progressData.records.find(
    (item) => item.assignmentId === assignment.id,
  );

  expect(record, 'The B2 assignment should appear in administrator progress monitoring').toBeDefined();
  expect(record).toMatchObject({
    traineeEmail: workflowEmail,
    trainingModuleId: assignment.trainingModuleId,
    trainingModuleTitle: assignment.trainingModuleTitle,
    required: assignment.required,
    assignmentStatus: assignment.status,
  });

  const workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await workflow.getByRole('link', { name: 'Open progress monitoring' }).click();
  await expect(page).toHaveURL(/\/admin\/progress$/);

  await page.getByLabel('Search trainees').fill(workflowEmail);
  await page
    .getByLabel('Training module')
    .selectOption(String(assignment.trainingModuleId));

  const progressRecords = page.getByRole('region', { name: 'Trainee progress records' });
  const row = progressRecords
    .locator('tbody tr')
    .filter({ hasText: workflowEmail })
    .filter({ hasText: assignment.trainingModuleTitle });

  await expect(row).toHaveCount(1);
  await expect(row).toBeVisible();
  await expect(row).toContainText(workflowEmail);
  await expect(row).toContainText(assignment.trainingModuleTitle);
  await expect(row).toContainText(assignment.required ? 'Required assignment' : 'Optional assignment');
  await expect(row).toContainText(`${record!.progressPercentage}%`);

  await expect(page.locator('.admin-progress-filter-meta')).toContainText('Showing 1 of');
});
