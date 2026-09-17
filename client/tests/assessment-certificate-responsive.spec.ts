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

function assessmentDetail() {
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
    latestAttempt: null,
  };
}

test('final assessment remains responsive across key breakpoints', async ({
  page,
}) => {
  await signIn(page);
  await page.route(
    new RegExp(`/api/trainee/training/${assignmentId}/assessment$`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(assessmentDetail()),
      }),
  );

  await page.goto(`/trainee/training/${assignmentId}/assessment`);
  await expect(
    page.getByRole('heading', { name: 'Manual Handling Final Assessment' }),
  ).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const firstQuestion = page.locator('.assessment-question').first();
  const questionBox = await firstQuestion.boundingBox();
  expect(questionBox).not.toBeNull();
  expect((questionBox?.x ?? 0) + (questionBox?.width ?? 0)).toBeLessThanOrEqual(
    390.5,
  );
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
        certificate: {
          id: 700,
          certificateNumber: 'KISTS-20260917-RESPONSIVE-CERTIFICATE-ABCDEF1234567890',
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
  await expect(
    page.getByRole('heading', { name: 'Your digital certificate' }),
  ).toBeVisible();

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
