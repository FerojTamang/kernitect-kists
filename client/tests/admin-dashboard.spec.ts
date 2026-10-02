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

test('administrator dashboard shows live workforce training information and remains responsive', async ({
  page,
}) => {
  await signIn(page);

  await expect(
    page.getByRole('heading', { name: 'Administrator dashboard' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open administrator settings' }),
  ).toBeVisible();
  await expect(
    page
      .locator('.sidebar-footer')
      .getByText('KISTS Administrator', { exact: true }),
  ).toHaveCount(0);

  const summary = page.getByRole('region', {
    name: 'Administrator training summary',
  });
  await expect(summary).toBeVisible();
  await expect(
    summary.getByText('Total trainees', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Active assignments', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Completed training', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText('Certificates issued', { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByRole('link', { name: /Total trainees/ }),
  ).toHaveAttribute('href', '/admin/users');
  await expect(
    summary.getByRole('link', { name: /Active assignments/ }),
  ).toHaveAttribute('href', '/admin/assignments');
  await expect(
    summary.getByRole('link', { name: /Completed training/ }),
  ).toHaveAttribute('href', '/admin/progress');
  await expect(
    summary.getByRole('link', { name: /Certificates issued/ }),
  ).toHaveAttribute('href', '/admin/progress');
  await expect(
    page.getByRole('heading', { name: 'Needs attention' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Outstanding assignments/ }),
  ).toHaveAttribute('href', '/admin/assignments');

  await expect(
    page.getByRole('heading', { name: 'Training overview' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Trainee progress' }),
  ).toBeVisible();

  const dashboardResponse = await page.request.get('/api/admin/dashboard');
  expect(dashboardResponse.status()).toBe(200);
  const dashboard = (await dashboardResponse.json()) as {
    summary: { totalTrainees: number };
  };
  expect(dashboard.summary.totalTrainees).toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Administrator dashboard' }),
  ).toBeVisible();

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.administrator-shell');
      const sidebar = document.querySelector<HTMLElement>(
        '.administrator-shell > .sidebar',
      );
      const workspace = document.querySelector<HTMLElement>(
        '.administrator-shell > .workspace',
      );
      const main = document.querySelector<HTMLElement>(
        '.administrator-shell > .workspace > main',
      );
      return {
        shellHeight: shell?.getBoundingClientRect().height,
        sidebarHeight: sidebar?.getBoundingClientRect().height,
        workspaceHeight: workspace?.getBoundingClientRect().height,
        shellOverflow: shell ? getComputedStyle(shell).overflow : '',
        mainOverflowY: main ? getComputedStyle(main).overflowY : '',
        documentFits: document.documentElement.scrollHeight <= innerHeight + 1,
      };
    });
    expect(layout.shellHeight).toBeCloseTo(viewport.height, 0);
    expect(layout.sidebarHeight).toBeCloseTo(viewport.height, 0);
    expect(layout.workspaceHeight).toBeCloseTo(viewport.height, 0);
    expect(layout.shellOverflow).toBe('hidden');
    expect(layout.mainOverflowY).toBe('auto');
    expect(layout.documentFits).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
