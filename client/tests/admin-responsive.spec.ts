import { expect, test, type Page } from '@playwright/test';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';

const adminPages = [
  { path: '/admin/dashboard', heading: 'Administrator dashboard' },
  { path: '/admin/users', heading: 'Users & job roles' },
  { path: '/admin/assignments', heading: 'Training assignments' },
  { path: '/admin/progress', heading: 'Progress & results' },
] as const;

const viewports = [
  { width: 390, height: 844 },
  { width: 640, height: 900 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(administrator);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

async function expectNoDocumentOverflow(
  page: Page,
  route: string,
  viewportWidth: number,
) {
  const metrics = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(
        (item) =>
          item.right > viewportWidth + 1 ||
          item.left < -1 ||
          item.width > viewportWidth + 1,
      )
      .slice(0, 8);

    return { documentWidth, viewportWidth, offenders };
  });

  expect(
    metrics.documentWidth,
    `Document overflow on ${route} at ${viewportWidth}px. ` +
      `scrollWidth=${metrics.documentWidth}, innerWidth=${metrics.viewportWidth}. ` +
      `Likely offenders: ${JSON.stringify(metrics.offenders)}`,
  ).toBeLessThanOrEqual(metrics.viewportWidth);
}

test('administrator workspace remains contained across supported responsive breakpoints', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const adminPage of adminPages) {
      await page.goto(adminPage.path);
      await expect(
        page.getByRole('heading', { name: adminPage.heading }).first(),
      ).toBeVisible();
      await expectNoDocumentOverflow(page, adminPage.path, viewport.width);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Add trainee' }).click();
  const userDialog = page.getByRole('dialog');
  await expect(userDialog).toBeVisible();
  const userBox = await userDialog.boundingBox();
  expect(userBox).not.toBeNull();
  expect(userBox!.x).toBeGreaterThanOrEqual(0);
  expect(userBox!.x + userBox!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.goto('/admin/assignments');
  await page.getByRole('button', { name: 'Assign training' }).click();
  const assignmentDialog = page.getByRole('dialog');
  await expect(assignmentDialog).toBeVisible();
  const assignmentBox = await assignmentDialog.boundingBox();
  expect(assignmentBox).not.toBeNull();
  expect(assignmentBox!.x).toBeGreaterThanOrEqual(0);
  expect(assignmentBox!.x + assignmentBox!.width).toBeLessThanOrEqual(390);
});
