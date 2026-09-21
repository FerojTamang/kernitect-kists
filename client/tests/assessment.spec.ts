import { expect, test, type Page } from '@playwright/test';
import { createTrainee, removeTrainee, trainee } from './trainee-fixture';

const password = process.env.KISTS_DEMO_PASSWORD!;
const assignmentId = 424242;

test.beforeAll(createTrainee);
test.afterAll(removeTrainee);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email address', { exact: true }).fill(trainee);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
}

function assessmentDetail(latestAttempt: unknown = null) {
  return {
    assignmentId,
    moduleId: 1,
    assessment: {
      id: 200,
      title: 'Manual Handling Final Assessment',
      description: 'Final graded Manual Handling knowledge assessment.',
      passPercentage: 75,
      sequenceOrder: 2,
    },
    questions: Array.from({ length: 10 }, (_, questionIndex) => ({
      id: 1000 + questionIndex,
      questionText: `Safety question ${questionIndex + 1}?`,
      questionType: 'single_choice',
      sequenceOrder: questionIndex + 1,
      options: Array.from({ length: 4 }, (_, optionIndex) => ({
        id: 10000 + questionIndex * 10 + optionIndex,
        optionText: `Question ${questionIndex + 1} option ${optionIndex + 1}`,
        sequenceOrder: optionIndex + 1,
      })),
    })),
    latestAttempt,
  };
}

async function answerAllQuestions(page: Page) {
  for (let question = 1; question <= 10; question += 1) {
    await page
      .getByRole('radio', { name: `Question ${question} option 1` })
      .check();
    await page
      .getByRole('button', {
        name: question === 10 ? 'Review answers' : 'Next →',
      })
      .click();
  }
}

test('final assessment UI supports fail, retry, pass and persisted completion', async ({
  page,
}) => {
  let latestAttempt: null | {
    id: number;
    attemptNumber: number;
    scorePercentage: number;
    passPercentage: number;
    passed: boolean;
    submittedAt: string;
  } = null;
  let submissions = 0;

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
          certificateNumber: 'KISTS-20260917-ABCDEF123456',
          issuedAt: '2026-09-17T12:00:00.000Z',
          traineeName: 'Alex Morgan',
          status: 'issued',
          training: [{ assignmentId, moduleTitle: 'Manual Handling', completedAt: '2026-09-17T11:59:00.000Z', assessments: [] }],
        },
      }),
    }),
  );

  await page.route(
    new RegExp(`/api/trainee/training/${assignmentId}/assessment(?:/submit)?$`),
    async (route) => {
      const request = route.request();

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(assessmentDetail(latestAttempt)),
        });
        return;
      }

      submissions += 1;
      const body = request.postDataJSON() as {
        answers: Array<{ questionId: number; optionId: number }>;
      };
      expect(body.answers).toHaveLength(10);

      latestAttempt = {
        id: 300 + submissions,
        attemptNumber: submissions,
        scorePercentage: submissions === 1 ? 50 : 100,
        passPercentage: 75,
        passed: submissions === 2,
        submittedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          assignmentId,
          assessmentId: 200,
          correctAnswers: submissions === 1 ? 5 : 10,
          totalQuestions: 10,
          attempt: latestAttempt,
        }),
      });
    },
  );

  await page.goto(`/trainee/training/${assignmentId}/assessment`);
  await expect(
    page.getByRole('heading', { name: 'Manual Handling Final Assessment' }),
  ).toBeVisible();
  await expect(
    page.getByText('10 Questions · Prototype pass mark 75%'),
  ).toBeVisible();
  await expect(page.getByText('0 of 10 answered')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Submit final assessment' }),
  ).toHaveCount(0);

  await page.getByRole('radio', { name: 'Question 1 option 1' }).check();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: '← Previous' }).click();
  await expect(
    page.getByRole('radio', { name: 'Question 1 option 1' }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Next →' }).click();

  for (let question = 2; question <= 10; question += 1) {
    await page
      .getByRole('radio', { name: `Question ${question} option 1` })
      .check();
    await page
      .getByRole('button', {
        name: question === 10 ? 'Review answers' : 'Next →',
      })
      .click();
  }

  await expect(page.getByText('10 of 10 answered')).toBeVisible();
  await page.getByRole('button', { name: 'Submit final assessment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Assessment not passed' }),
  ).toBeVisible();
  await expect(page.locator('.assessment-result-score > strong')).toHaveText(
    '50%',
  );
  await expect(page.locator('.assessment-pass-confetti')).toHaveCount(0);

  await page.getByRole('button', { name: 'Retry assessment' }).click();
  await expect(page.getByText('Previous attempt: 50%')).toBeVisible();

  await answerAllQuestions(page);

  await page.getByRole('button', { name: 'Submit final assessment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Assessment passed' }),
  ).toBeVisible();
  await expect(
    page.getByText('Congratulations, Alex Morgan! You passed with 100%.'),
  ).toBeVisible();
  await expect(page.getByText('Manual Handling complete')).toBeVisible();
  await expect(page.locator('.assessment-result-score > strong')).toHaveText(
    '100%',
  );
  await expect(page.locator('.assessment-pass-confetti')).toBeVisible();
  await expect(page.locator('.assessment-pass-confetti')).toHaveCount(0, {
    timeout: 4500,
  });

  const assessmentUrl = page.url();
  const certificateButton = page.getByRole('button', { name: /View digital certificate/ });
  await certificateButton.click();
  await expect(page).toHaveURL(assessmentUrl);
  const dialog = page.getByRole('dialog', { name: 'Digital Certificate' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Alex Morgan', { exact: true })).toBeVisible();
  await expect(dialog.getByText('KISTS-20260917-ABCDEF123456')).toBeVisible();
  await expect(dialog.getByText('17 September 2026')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Download certificate' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Assessment passed' })).toBeVisible();
  await expect(certificateButton).toBeFocused();

  await certificateButton.click();
  await page.getByRole('button', { name: 'Close digital certificate' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(assessmentUrl);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Assessment passed' }),
  ).toBeVisible();
  await expect(page.getByText('Manual Handling complete')).toBeVisible();
  await page.getByRole('link', { name: 'Return to Dashboard' }).click();
  await expect(page).toHaveURL(/\/trainee\/dashboard$/);
});
