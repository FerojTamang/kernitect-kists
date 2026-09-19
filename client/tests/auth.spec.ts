import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  createTrainee,
  prepareScenarioReadyTrainee,
  removeTrainee,
  trainee,
} from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
const administrator = 'kists.administrator@example.invalid';
test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

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
    page.getByText(/KISTS COLOUR THEME|#[0-9A-F]{6}|Explore trainee/i),
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

test('trainee login reaches the database-backed dashboard, persists on reload, and logs out', async ({
  page,
  context,
}) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/$/);
  await signIn(page);
  await expect(
    page.locator('.sidebar-footer').getByText('Alex Morgan', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Alex' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Manual Handling' }).first(),
  ).toBeVisible();
  await expect(
    page.getByText('Forklift and Pedestrian Safety', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Learning progress 0%', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('0 of 5 sections complete', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('.sidebar-footer').getByText('Alex Morgan', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1536, height: 900 });
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
    page.locator('.sidebar-footer').getByText('KISTS Administrator', {
      exact: true,
    }),
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

test('dashboard loading and API errors remain honest and recoverable', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/trainee/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Your dashboard is unavailable' }),
  ).toBeVisible();
  await page.unroute('**/api/trainee/dashboard');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Alex' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
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

test('trainee My Training lists only assigned modules and opens Manual Handling', async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole('link', { name: 'My Training' }).click();

  await expect(page).toHaveURL(/\/trainee\/training$/);

  await expect(
    page.getByRole('heading', {
      name: 'Your assigned training',
    }),
  ).toBeVisible();

  const assignedModules = page.getByRole('region', {
    name: 'Assigned training modules',
  });

  await expect(assignedModules).toBeVisible();

  await expect(
    assignedModules.getByRole('heading', {
      name: 'Manual Handling',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    assignedModules.getByRole('heading', {
      name: 'Forklift & Pedestrian Safety',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    assignedModules.getByText(
      'Training content coming in a later development phase',
    ),
  ).toBeVisible();

  await expect(assignedModules.getByText('Fire Safety Basics')).toHaveCount(0);

  await assignedModules
    .getByRole('link', {
      name: /Start Learning|Continue Learning/,
    })
    .click();

  await expect(page).toHaveURL(/\/trainee\/training\/\d+$/);

  await page.goto('/trainee/dashboard');

  await page
    .getByRole('button', {
      name: 'Sign out',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/$/);
});

test('trainee completes the five-section Manual Handling learning journey with formative checks', async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole('button', { name: /Continue|Start/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/trainee\/training\/\d+$/);
  await expect(
    page.getByRole('link', {
      name: 'My Training',
      exact: true,
    }),
  ).toHaveClass(/active/);
  const sectionList = page.getByRole('navigation', {
    name: 'Complete each section',
  });
  for (const title of [
    'Introduction to Manual Handling',
    'Risks and Injuries',
    'Assessing the Task and Load',
    'Safe Lifting Techniques',
    'Practical Examples',
  ])
    await expect(sectionList.getByText(title, { exact: true })).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'What is manual handling?' }),
  ).toBeVisible();
  const answer = async (question: string, option: string) => {
    const questionCard = page
      .getByText(question, { exact: true })
      .locator('..');
    const before = await page
      .getByRole('progressbar', { name: 'Learning content progress' })
      .getAttribute('aria-valuenow');
    let submissions = 0;
    const countSubmission = (request: import('@playwright/test').Request) => {
      if (request.method() === 'POST' && request.url().endsWith('/answer'))
        submissions++;
    };
    page.on('request', countSubmission);
    await questionCard
      .getByRole('radio', { name: option, exact: true })
      .check();
    await expect(
      questionCard.getByRole('radio', { name: option, exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole('progressbar', { name: 'Learning content progress' }),
    ).toHaveAttribute('aria-valuenow', before!);
    expect(submissions).toBe(0);
    page.off('request', countSubmission);
    await expect(
      questionCard.getByRole('button', { name: 'Check Answer' }),
    ).toBeEnabled();
    await questionCard.getByRole('button', { name: 'Check Answer' }).click();
  };
  await answer(
    'Which activity is included in manual handling?',
    'Only lifting boxes',
  );
  await expect(page.getByText('✕ Not quite', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByText('✕ Not quite', { exact: true })).toHaveCount(0);
  await answer(
    'Which activity is included in manual handling?',
    'Lifting, pushing, pulling and carrying objects',
  );
  await answer(
    'Why is safe manual handling important?',
    'It helps reduce avoidable injury',
  );
  await expect(page.getByText('1 of 5 sections completed')).toBeVisible();
  await expect(page.getByText('20% learning progress')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'What is manual handling?' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Continue to Risks and Injuries/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Why it matters' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Why it matters' }),
  ).toBeVisible();
  await answer('Which is a common manual-handling injury?', 'Back pain');
  await answer(
    'Which practice increases handling risk?',
    'Twisting while carrying a heavy load',
  );
  await expect(page.getByText('2 of 5 sections completed')).toBeVisible();
  await expect(page.getByText('40% learning progress')).toBeVisible();
  await page
    .getByRole('button', { name: /Continue to Assessing the Task and Load/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Assess before you move' }),
  ).toBeVisible();
  await answer(
    'What should you check before moving a load?',
    'Size, shape, stability, weight and route',
  );
  await answer(
    'When should handling equipment or help be considered?',
    'When the load or route exceeds safe capability',
  );
  await page
    .getByRole('button', { name: /Continue to Safe Lifting Techniques/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'The key steps to safe lifting' }),
  ).toBeVisible();
  await answer(
    'What should you do before lifting?',
    'Plan the lift and assess the route',
  );
  await answer(
    'How should you carry a load?',
    'Keep it close and avoid twisting',
  );
  await page
    .getByRole('button', { name: /Continue to Practical Examples/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Choose a safer way to move the load' }),
  ).toBeVisible();
  await answer(
    'Which is the safer warehouse handling example?',
    'Bend your knees and keep the load close',
  );
  await answer(
    'What is the safest action when a load blocks your view?',
    'Stop, make the route safe and get help if needed',
  );
  const celebration = page.getByRole('status');
  const confetti = page.locator('.completion-confetti');

  await expect(celebration.getByText('Congratulations!')).toBeVisible();
  await expect(
    celebration.getByText(
      "You've completed the Manual Handling learning content.",
    ),
  ).toBeVisible();
  await expect(confetti).toBeVisible();
  expect(
    await confetti.evaluate((element) => ({
      pointerEvents: window.getComputedStyle(element).pointerEvents,
      position: window.getComputedStyle(element).position,
    })),
  ).toEqual({ pointerEvents: 'none', position: 'fixed' });
  await expect(page.getByText('100% learning progress')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Learning content complete', level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator('.completion-state > p').filter({
      hasText: "You've completed the Manual Handling learning content.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Interactive Warehouse Safety Scenario'),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByText(/certificate|assessment|pass|score/i),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Learning content complete', level: 2 }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto('/trainee/training/999999');
  await expect(
    page.getByRole('heading', { name: 'Training module unavailable' }),
  ).toBeVisible();
  await page.goto('/trainee/dashboard');
  await expect(
    page.getByRole('heading', { name: /Welcome back, Alex/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('trainee completes the interactive Manual Handling warehouse scenario', async ({
  page,
}) => {
  await prepareScenarioReadyTrainee();
  await signIn(page);
  await page.getByRole('link', { name: 'Scenarios' }).click();
  await expect(page).toHaveURL(/\/trainee\/scenarios$/);
  await expect(
    page.getByRole('heading', { name: 'Interactive safety scenarios' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Interactive Warehouse Safety Scenario',
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Open Scenario/ }).click();
  await expect(page).toHaveURL(/\/trainee\/training\/\d+\/scenario$/);
  await expect(
    page.getByRole('heading', { name: 'Warehouse Manual Handling Scenario' }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Interactive scenario progress' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText('360° interactive scenario')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Safety points' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Scenarios' })).toHaveCount(0);

  await page.getByRole('button', { name: /Safety point 1:/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.kists-360-hotspot').filter({ hasText: '1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page
    .getByRole('radio', {
      name: 'Carry the load and step around the obstruction',
    })
    .check();
  await expect(page.getByText('✕ Not quite', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check decision' }).click();
  await expect(page.getByText('✕ Not quite', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page
    .getByRole('radio', { name: 'Clear the route before moving the load' })
    .check();
  await page.getByRole('button', { name: 'Check decision' }).click();
  await expect(page.getByText('✓ Safety point complete')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Continue exploring 360° warehouse',
      exact: true,
    })
    .click();

  const decisions = [
    [2, 'Stabilise or restack the load first'],
    [3, 'Reposition close to the load and use stable footing'],
    [4, 'Use suitable handling equipment'],
    [5, 'Get appropriate assistance or use another safer method'],
  ] as const;

  for (const [point, decision] of decisions) {
    await page
      .getByRole('button', { name: new RegExp(`Safety point ${point}:`) })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .locator('.kists-360-hotspot')
      .filter({ hasText: String(point) })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('radio', { name: decision }).check();
    await page.getByRole('button', { name: 'Check decision' }).click();
    await expect(page.getByText('✓ Safety point complete')).toBeVisible();
    await page
      .getByRole('button', {
        name: 'Continue exploring 360° warehouse',
        exact: true,
      })
      .click();
  }

  await expect(
    page.getByRole('heading', { name: 'Interactive scenario complete' }),
  ).toBeVisible();
  await expect(
    page.getByText('5 of 5 safety objectives completed'),
  ).toBeVisible();
  await expect(page.getByText('Final Knowledge Assessment')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue to Final Assessment →' }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByText(/certificate|assessment score|passed/i),
  ).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Interactive scenario complete' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
