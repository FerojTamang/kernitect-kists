import { expect, test, type Page } from '@playwright/test';
const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';
async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test('administrator users page lists trainees, filters accounts and opens the trainee form responsively', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole('heading', { name: 'Users & job roles' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'User account summary' }),
  ).toBeVisible();
  const response = await page.request.get('/api/admin/users');
  expect(response.status()).toBe(200);
  const data = (await response.json()) as {
    users: Array<{
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl: string | null;
      assignedCount: number;
      requiredTrainingModuleIds: number[];
    }>;
    trainingModules: Array<{ id: number; title: string }>;
  };
  expect(data.users.length).toBeGreaterThanOrEqual(1);
  const first = data.users[0]!;
  await page.getByLabel('Search trainees').fill(first.email);
  await expect(page.getByText(first.email, { exact: true })).toBeVisible();
  await expect(
    page
      .locator('tr')
      .filter({ hasText: first.email })
      .getByText(
        `${first.assignedCount} module${first.assignedCount === 1 ? '' : 's'}`,
      ),
  ).toBeVisible();
  const identity = page
    .locator('.admin-users-identity')
    .filter({ hasText: first.email });
  if (first.avatarUrl) {
    await expect(identity.locator('img')).toHaveAttribute(
      'src',
      first.avatarUrl,
    );
  } else {
    await expect(identity.locator('.admin-users-avatar')).toHaveText(
      `${first.firstName[0] ?? ''}${first.lastName[0] ?? ''}`.toUpperCase(),
    );
  }
  await page
    .getByRole('button', { name: `Edit ${first.firstName} ${first.lastName}` })
    .click();
  let dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('group', { name: 'Required training' }),
  ).toBeVisible();
  for (const module of data.trainingModules) {
    const checkbox = dialog.getByRole('checkbox', { name: module.title });
    await expect(checkbox).toBeVisible();
    if (first.requiredTrainingModuleIds.includes(module.id)) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  }
  const changedModule = data.trainingModules[0]!;
  const wasRequired = first.requiredTrainingModuleIds.includes(
    changedModule.id,
  );
  await dialog.getByRole('checkbox', { name: changedModule.title }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  const changedAssignedCount = first.assignedCount + (wasRequired ? -1 : 1);
  await expect(
    page
      .locator('tr')
      .filter({ hasText: first.email })
      .getByText(
        `${changedAssignedCount} module${changedAssignedCount === 1 ? '' : 's'}`,
      ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `Edit ${first.firstName} ${first.lastName}` })
    .click();
  dialog = page.getByRole('dialog');
  const persisted = dialog.getByRole('checkbox', { name: changedModule.title });
  if (wasRequired) await expect(persisted).not.toBeChecked();
  else await expect(persisted).toBeChecked();
  await persisted.click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Add trainee' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    page.getByText('System role: TRAINEE', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
