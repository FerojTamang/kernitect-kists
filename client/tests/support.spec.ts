import { expect, test, type Page } from '@playwright/test';
import { createTrainee, removeTrainee, trainee } from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';
const uniqueMessage = `Certificate support request ${Date.now()}`;

test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

test('trainee help provides FAQ, validated administrator contact and future AI guidance', async ({
  page,
}) => {
  await signIn(page, trainee);
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);

  const helpCard = page.getByRole('region', { name: 'Help & Support' });
  await expect(helpCard).toBeVisible();
  await expect(
    helpCard.getByRole('link', { name: /View Help & FAQ/ }),
  ).toHaveAttribute('href', '/trainee/help');
  await expect(
    helpCard.getByRole('link', { name: /Contact Administrator/ }),
  ).toHaveAttribute('href', '/trainee/support');
  await expect(helpCard.getByRole('link')).toHaveCount(2);
  await helpCard.getByRole('link', { name: /Contact Administrator/ }).click();
  await expect(page).toHaveURL(/\/trainee\/support$/);
  const contactHeader = page.locator('.support-page-header');
  expect(
    await contactHeader.evaluate((header) => {
      const main = header.closest('main');
      return (
        main &&
        header.getBoundingClientRect().top - main.getBoundingClientRect().top <
          60
      );
    }),
  ).toBe(true);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Select an issue type.')).toBeVisible();
  await expect(page.getByText('Enter a message.')).toBeVisible();

  await page
    .getByLabel('Issue type / subject')
    .selectOption('certificate_issue');
  await page.getByLabel('Message', { exact: true }).fill(uniqueMessage);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Your message has been sent to an administrator.',
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Return to Help & FAQ' }).click();
  await expect(
    page.getByRole('heading', { name: 'Frequently asked questions' }),
  ).toBeVisible();
  expect(
    await page.locator('.support-page-header').evaluate((header) => {
      const main = header.closest('main');
      return (
        main &&
        header.getBoundingClientRect().top - main.getBoundingClientRect().top <
          60
      );
    }),
  ).toBe(true);
  const question = page.getByText('What is KISTS?', { exact: true });
  await question.click();
  await expect(
    page.getByText(/web-based safety training system/),
  ).toBeVisible();

  const externalAiRequests: string[] = [];
  page.on('request', (request) => {
    if (/openai|anthropic|gemini|generativelanguage/i.test(request.url()))
      externalAiRequests.push(request.url());
  });
  await page.getByRole('link', { name: /Ask AI Assistant/ }).click();
  await expect(
    page.getByRole('heading', { name: 'AI Assistant — Coming Soon' }),
  ).toBeVisible();
  expect(externalAiRequests).toEqual([]);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('dashboard help card remains in its existing right column without horizontal overflow', async ({
  page,
}) => {
  await signIn(page, trainee);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 960 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const helpCard = page.getByRole('region', { name: 'Help & Support' });
    await expect(helpCard).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await helpCard.evaluate(
        (card) => card.closest('.dashboard-support-column') !== null,
      ),
    ).toBe(true);
  }
});

test('administrator can view a submitted trainee message and update its status', async ({
  page,
}) => {
  await signIn(page, administrator);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page
    .getByRole('link', { name: 'Support messages', exact: true })
    .click();
  const row = page.getByRole('row').filter({ hasText: uniqueMessage });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'View' }).click();
  const dialog = page.getByRole('dialog', { name: /Message from/ });
  await expect(dialog.getByText(uniqueMessage, { exact: true })).toBeVisible();
  await dialog.getByLabel('Status').selectOption('in_progress');
  await expect(dialog.getByLabel('Status')).toHaveValue('in_progress');
});
