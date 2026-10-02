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

type TraineeOption = {
  id: number;
  email: string;
  isActive: boolean;
};

type ModuleOption = {
  id: number;
  title: string;
};

type AssignmentsPayload = {
  trainees: TraineeOption[];
  modules: ModuleOption[];
  assignments: Assignment[];
};

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function loadAssignments(page: Page): Promise<AssignmentsPayload> {
  const response = await page.request.get('/api/admin/assignments');
  expect(response.status()).toBe(200);
  return (await response.json()) as AssignmentsPayload;
}

test('9E-B2 administrator can assign required training to the workflow trainee and verify it', async ({
  page,
}) => {
  await signIn(page);

  const workflow = page.getByRole('navigation', {
    name: 'Administrator workflow',
  });
  await workflow
    .getByRole('link', { name: 'Open training assignments' })
    .click();
  await expect(page).toHaveURL(/\/admin\/assignments$/);

  let payload = await loadAssignments(page);
  const trainee = payload.trainees.find((item) => item.email === workflowEmail);
  expect(
    trainee,
    '9E-B1 workflow trainee should exist before B2',
  ).toBeDefined();
  expect(trainee?.isActive).toBe(true);

  const targetModule =
    payload.modules.find((module) => module.title === 'Manual Handling') ??
    payload.modules[0];
  expect(
    targetModule,
    'At least one active training module is required',
  ).toBeDefined();

  let assignment = payload.assignments.find(
    (item) =>
      item.traineeId === trainee!.id &&
      item.trainingModuleId === targetModule!.id,
  );

  if (!assignment) {
    await page.getByRole('button', { name: 'Assign training' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog
      .getByLabel('Trainee', { exact: true })
      .selectOption(String(trainee!.id));
    await dialog
      .getByLabel('Training module', { exact: true })
      .selectOption(String(targetModule!.id));

    const required = dialog.getByRole('radio', { name: /Required training/ });
    await required.check();
    await expect(required).toBeChecked();

    await dialog
      .getByRole('button', { name: 'Assign training', exact: true })
      .click();
    await expect(dialog).toBeHidden();
  }

  payload = await loadAssignments(page);
  assignment = payload.assignments.find(
    (item) =>
      item.traineeId === trainee!.id &&
      item.trainingModuleId === targetModule!.id,
  );

  expect(assignment).toBeDefined();
  expect(assignment).toMatchObject({
    traineeEmail: workflowEmail,
    trainingModuleId: targetModule!.id,
    trainingModuleTitle: targetModule!.title,
    required: true,
    status: 'active',
  });

  await page.getByLabel('Search assignments').fill(workflowEmail);
  const results = page.locator('.admin-assignments-table-wrap');
  await expect(
    results.getByText(workflowEmail, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    results.getByText(targetModule!.title, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    results.getByText('Required', { exact: true }).first(),
  ).toBeVisible();
});
