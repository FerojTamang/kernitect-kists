import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const password = process.env.KISTS_DEMO_PASSWORD!;
const trainee = 'alex.morgan@example.invalid';
const administrator = 'kists.administrator@example.invalid';

async function fillLogin(page: Page, email = trainee) {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true }),
  ).toBeEnabled();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
}
async function signIn(page: Page, email = trainee) {
  await fillLogin(page, email);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(
    email === administrator ? /\/admin\/dashboard$/ : /\/trainee\/dashboard$/,
  );
}

test('desktop login uses real branding and excludes design documentation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in to your training portal' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Kernitect', exact: true }),
  ).toHaveAttribute('src', /kernitect-logo-on-dark/);
  await expect(
    page.getByText(
      /KISTS COLOUR THEME|#[0-9A-F]{6}|Explore trainee/i,
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true }),
  ).toHaveCSS('background-color', 'rgb(108, 92, 231)');
  await page.evaluate(() => document.fonts.ready);
  await mkdir('.local/verification', { recursive: true });
  await page.screenshot({
    path: '.local/verification/login-desktop.png',
    fullPage: true,
  });
});

test('empty/invalid form input and password visibility are keyboard accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(
    page.getByText('Enter your email address.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Enter your password.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toBeFocused();
  await page.getByLabel('Email address', { exact: true }).fill('invalid');
  await page
    .getByLabel('Password', { exact: true })
    .fill('visibility-test-only');
  await page
    .getByRole('button', { name: 'Show password', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page
    .getByRole('button', { name: 'Hide password', exact: true })
    .click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(
    page.getByText('Enter a valid email address.', { exact: true }),
  ).toBeVisible();
});

test('trainee login persists on reload, cannot access admin routes, and logs out', async ({
  page,
  context,
}) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/$/);
  await signIn(page);
  await expect(page.getByText('Alex Morgan', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Alex Morgan', { exact: true })).toBeVisible();
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).user.systemRole).toBe('trainee');
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'kists_session',
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(
    await page.evaluate(() => document.cookie.includes('kists_session')),
  ).toBe(false);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.goto('/admin/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Access denied' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to your workspace' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goto('/trainee/progress');
  await expect(page).toHaveURL(/\/$/);
});

test('administrator login redirects by system role and preserves dashboard placeholders', async ({
  page,
}) => {
  await signIn(page, administrator);
  await expect(
    page.getByText('KISTS Administrator', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Planned functionality', { exact: true }),
  ).toBeVisible();
  await page.goto('/trainee/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Access denied' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to your workspace' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('remember me creates a persistent 30-day cookie', async ({
  page,
  context,
}) => {
  await fillLogin(page);
  await page.getByRole('checkbox', { name: /Remember me/ }).check();
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'kists_session',
  );
  expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeGreaterThan(
    29 * 86400,
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
});

test('wrong credentials and a disabled Phase 2 demo account show safe errors', async ({
  page,
}) => {
  await fillLogin(page);
  await page
    .getByLabel('Password', { exact: true })
    .fill('incorrect-test-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Email or password is incorrect, or your account is unavailable.',
  );
  await page
    .getByLabel('Email address', { exact: true })
    .fill('demo.trainee@example.invalid');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Contact your administrator',
  );
  await expect(page).toHaveURL(/\/$/);
});

test('network and server failures remain recoverable', async ({ page }) => {
  await fillLogin(page);
  await page.route('**/api/auth/login', (route) => route.abort());
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'We could not reach the training portal',
  );
  await page.unroute('**/api/auth/login');
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true }),
  ).toBeEnabled();
});

test('loading state prevents duplicate sign-in requests', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  await fillLogin(page);
  await page.route('**/api/auth/login', async (route) => {
    requests++;
    await paused;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Signing in…' }),
  ).toBeDisabled();
  await page.keyboard.press('Enter');
  release();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
});

test('a revoked session returns to login with an expiry message on the next check', async ({
  page,
}) => {
  await signIn(page);
  await page.request.post('/api/auth/logout', {
    headers: { Origin: 'http://localhost:5173', 'X-KISTS-Request': '1' },
    data: {},
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('status')).toContainText(
    'Your session has expired',
  );
});

test('mobile login remains usable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: '.local/verification/login-mobile.png',
    fullPage: true,
  });
});
