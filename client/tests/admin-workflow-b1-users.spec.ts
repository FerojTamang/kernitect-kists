import { expect, test, type Page } from '@playwright/test';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';
const workflowEmail = 'phase9e.b1.trainee@example.invalid';
const workflowFirstName = 'Phase9E';
const workflowLastName = 'Trainee';
const workflowJobRole = 'Warehouse Operative';

type AdminUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
};

type UsersPayload = {
  users: AdminUser[];
};

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function loadUsers(page: Page): Promise<UsersPayload> {
  const response = await page.request.get('/api/admin/users');
  expect(response.status()).toBe(200);
  return (await response.json()) as UsersPayload;
}

test('9E-B1 administrator can create or restore a trainee and verify the job role', async ({
  page,
}) => {
  await signIn(page);

  const workflow = page.getByRole('navigation', { name: 'Administrator workflow' });
  await workflow.getByRole('link', { name: 'Open users & job roles' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  let payload = await loadUsers(page);
  let trainee = payload.users.find((user) => user.email === workflowEmail);

  if (!trainee) {
    await page.getByRole('button', { name: 'Add trainee' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('First name').fill(workflowFirstName);
    await dialog.getByLabel('Last name').fill(workflowLastName);
    await dialog.getByLabel('Email address').fill(workflowEmail);
    await dialog.getByLabel('Initial password').fill(password);
    await dialog
      .getByLabel('Workplace job role')
      .selectOption({ label: workflowJobRole });
    await expect(dialog.getByRole('checkbox')).toBeChecked();

    await dialog
      .getByRole('button', { name: 'Create trainee', exact: true })
      .click();
    await expect(dialog).toBeHidden();
  } else if (
    trainee.firstName !== workflowFirstName ||
    trainee.lastName !== workflowLastName ||
    trainee.jobRole !== workflowJobRole ||
    !trainee.isActive
  ) {
    await page.getByLabel('Search trainees').fill(workflowEmail);
    await page
      .getByRole('button', {
        name: `Edit ${trainee.firstName} ${trainee.lastName}`,
      })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('First name').fill(workflowFirstName);
    await dialog.getByLabel('Last name').fill(workflowLastName);
    await dialog
      .getByLabel('Workplace job role')
      .selectOption({ label: workflowJobRole });

    const active = dialog.getByRole('checkbox');
    if (!(await active.isChecked())) {
      await active.check();
    }

    await dialog
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(dialog).toBeHidden();
  }

  payload = await loadUsers(page);
  trainee = payload.users.find((user) => user.email === workflowEmail);
  expect(trainee).toBeDefined();
  expect(trainee).toMatchObject({
    firstName: workflowFirstName,
    lastName: workflowLastName,
    email: workflowEmail,
    jobRole: workflowJobRole,
    isActive: true,
  });

  await page.getByLabel('Search trainees').fill(workflowEmail);
  await expect(page.getByText(workflowEmail, { exact: true })).toBeVisible();
  await expect(
    page
      .locator('.admin-users-table-wrap')
      .getByText(workflowJobRole, { exact: true })
      .first(),
  ).toBeVisible();
});
