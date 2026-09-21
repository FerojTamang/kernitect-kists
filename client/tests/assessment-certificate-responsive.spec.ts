import { expect, test, type Page } from '@playwright/test';
import { createTrainee, removeTrainee, trainee } from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
const assignmentId = 901;

const viewports = [
  { width: 390, height: 844 },
  { width: 640, height: 900 },
  { width: 768, height: 960 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
];

test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(trainee);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

function assessmentDetail(latestAttempt: unknown = null) {
  return {
    assignmentId,
    moduleId: 10,
    assessment: {
      id: 200,
      title: 'Manual Handling Final Assessment',
      description:
        'Answer all ten questions. Your score is calculated after submission.',
      passPercentage: 75,
      sequenceOrder: 1,
    },
    questions: Array.from({ length: 10 }, (_, questionIndex) => ({
      id: 1000 + questionIndex,
      questionText: `Responsive assessment question ${questionIndex + 1} with enough wording to exercise narrow layouts safely.`,
      questionType: 'single_choice',
      sequenceOrder: questionIndex + 1,
      options: Array.from({ length: 4 }, (_, optionIndex) => ({
        id: 10000 + questionIndex * 10 + optionIndex,
        optionText: `Question ${questionIndex + 1} option ${optionIndex + 1} with descriptive answer text`,
        sequenceOrder: optionIndex + 1,
      })),
    })),
    latestAttempt,
  };
}

test('final assessment remains responsive across key breakpoints', async ({
  page,
}) => {
  let latestAttempt: unknown = null;
  await signIn(page);
  await page.route('**/api/trainee/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        assignedTraining: [
          { assignmentId, required: true, status: 'completed' },
        ],
      }),
    }),
  );
  await page.route('**/api/trainee/certificates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: true,
        completion: { requiredAssignments: 1, completedAssignments: 1, requiredAssessments: 1, passedAssessments: 1 },
        history: [],
        certificate: {
          id: 700,
          certificateNumber: 'KISTS-20260917-RESPONSIVE',
          issuedAt: '2026-09-17T12:00:00.000Z',
          traineeName: 'Alex Morgan',
          status: 'issued',
          training: [{ assignmentId, moduleTitle: 'Manual Handling', completedAt: '2026-09-17T11:59:00.000Z', assessments: [] }],
        },
      }),
    }),
  );
  await page.route(
    new RegExp(`/api/trainee/training/${assignmentId}/assessment$`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(assessmentDetail(latestAttempt)),
      }),
  );

  await page.goto(`/trainee/training/${assignmentId}/assessment`);
  await expect(
    page.getByRole('heading', { name: 'Manual Handling Final Assessment' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Trainee navigation' }),
  ).toHaveCount(0);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.assessment-question:visible')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 1024, height: 900 });
  const expandedSidebar = await page
    .getByRole('complementary', { name: 'Assessment progress' })
    .boundingBox();
  await page
    .getByRole('button', { name: 'Collapse assessment progress' })
    .click();
  const collapsedSidebar = await page
    .getByRole('complementary', { name: 'Assessment progress' })
    .boundingBox();
  expect(collapsedSidebar?.width).toBeLessThan(expandedSidebar?.width ?? 0);
  await page
    .getByRole('button', { name: 'Expand assessment progress' })
    .click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open questions' }).click();
  await page.getByRole('button', { name: /Question 2, unanswered/ }).click();
  await expect(
    page.getByText('Responsive assessment question 2', { exact: false }),
  ).toBeVisible();
  const questionBox = await page
    .locator('.assessment-question:visible')
    .boundingBox();
  expect(questionBox).not.toBeNull();
  expect((questionBox?.x ?? 0) + (questionBox?.width ?? 0)).toBeLessThanOrEqual(
    390.5,
  );

  latestAttempt = {
    id: 902,
    attemptNumber: 1,
    scorePercentage: 80,
    passPercentage: 75,
    passed: true,
    submittedAt: new Date().toISOString(),
  };
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Assessment passed' }),
  ).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }

  const desktopResultViewports = [
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ];

  for (const viewport of desktopResultViewports) {
    await page.setViewportSize(viewport);
    const fit = await page.evaluate(() => {
      const player = document.querySelector<HTMLElement>(
        '.assessment-result-player',
      );
      const result = document.querySelector<HTMLElement>('.assessment-result');
      const actions = document.querySelector<HTMLElement>(
        '.assessment-result .assessment-actions',
      );
      const resultBox = result?.getBoundingClientRect();
      const actionsBox = actions?.getBoundingClientRect();

      return {
        documentFits: document.documentElement.scrollHeight <= innerHeight,
        playerFits: Boolean(
          player && player.scrollHeight <= player.clientHeight + 1,
        ),
        resultFits: Boolean(resultBox && resultBox.bottom <= innerHeight + 0.5),
        actionsFit: Boolean(
          actionsBox && actionsBox.bottom <= innerHeight + 0.5,
        ),
        resultOverflow: result ? getComputedStyle(result).overflowY : '',
      };
    });

    expect(fit).toEqual({
      documentFits: true,
      playerFits: true,
      resultFits: true,
      actionsFit: true,
      resultOverflow: 'visible',
    });
  }

  await page.getByRole('button', { name: /View digital certificate/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Digital Certificate' });
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const modalBody = dialog.locator('.certificate-modal-content');
    const certificate = dialog.getByRole('article', { name: 'KISTS digital certificate' });
    const [bodyBox, certificateBox] = await Promise.all([modalBody.boundingBox(), certificate.boundingBox()]);
    expect(bodyBox).not.toBeNull();
    expect(certificateBox).not.toBeNull();
    expect(certificateBox?.y ?? 0).toBeGreaterThanOrEqual((bodyBox?.y ?? 0) - 0.5);
    expect((certificateBox?.y ?? 0) + (certificateBox?.height ?? 0)).toBeLessThanOrEqual((bodyBox?.y ?? 0) + (bodyBox?.height ?? 0) + 0.5);
    expect(await modalBody.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expect(certificate.getByText('Ram Kumar Tamang', { exact: true }).last()).toBeVisible();
    await expect(certificate.getByLabel('Safer people, brighter tomorrow')).toBeVisible();
  }
  for (const viewport of [...viewports, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('article', { name: 'KISTS digital certificate' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.emulateMedia({ media: 'print' });
  const modalPrintRoot = page.locator(
    '.certificate-modal .certificate-print-root',
  );
  await expect(modalPrintRoot).toHaveCSS('visibility', 'visible');
  await expect(page.locator('.certificate-modal-header')).toHaveCSS(
    'display',
    'none',
  );
  expect(await modalPrintRoot.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.width / box.height;
  })).toBeCloseTo(297 / 210, 2);
  const modalPdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(modalPdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await page.emulateMedia({ media: 'screen' });
});

test('issued certificate remains responsive across key breakpoints', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/trainee/certificates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: true,
        completion: {
          requiredAssignments: 1,
          completedAssignments: 1,
          requiredAssessments: 1,
          passedAssessments: 1,
        },
        history: [],
        certificate: {
          id: 700,
          certificateNumber:
            'KISTS-20260917-RESPONSIVE-CERTIFICATE-ABCDEF1234567890',
          issuedAt: '2026-09-17T12:00:00.000Z',
          traineeName: 'Alexandra Morgan-Warehouse-Operative',
          status: 'issued',
          training: [
            {
              assignmentId: 34,
              moduleTitle: 'Manual Handling and Safe Warehouse Operations',
              completedAt: '2026-09-17T11:59:00.000Z',
              assessments: [
                {
                  assessmentId: 200,
                  title: 'Manual Handling Final Assessment',
                  attemptNumber: 2,
                  scorePercentage: 100,
                  passPercentage: 75,
                },
              ],
            },
          ],
        },
      }),
    }),
  );

  await page.goto('/trainee/certificates');
  await expect(page.getByRole('heading', { name: 'Current Certificate' })).toBeVisible();
  for (const viewport of [...viewports, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }

  await page.goto('/trainee/certificates/700');
  await expect(
    page.getByRole('heading', { name: 'Digital Certificate' }),
  ).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  const detailPrintRoot = page.locator('.certificate-viewer-page .certificate-print-root');
  await expect(detailPrintRoot).toHaveCSS('visibility', 'visible');
  expect(await detailPrintRoot.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.width / box.height;
  })).toBeCloseTo(297 / 210, 2);
  const detailPdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(detailPdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await page.emulateMedia({ media: 'screen' });

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('link', { name: 'Back to Certificates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download certificate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    const desktopCertificate = page.getByRole('article', { name: 'KISTS digital certificate' });
    const desktopBox = await desktopCertificate.boundingBox();
    expect(desktopBox).not.toBeNull();
    expect((desktopBox?.y ?? 0) + (desktopBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 0.5);
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const certificate = page.getByRole('article', {
    name: 'KISTS digital certificate',
  });
  const certificateBox = await certificate.boundingBox();
  expect(certificateBox).not.toBeNull();
  expect(
    (certificateBox?.x ?? 0) + (certificateBox?.width ?? 0),
  ).toBeLessThanOrEqual(390.5);
});
