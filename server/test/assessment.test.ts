import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { migrate, quotedSchema } from '../src/database/migrate.js';
import { assertLocalDevelopmentDatabase } from '../src/database/safety.js';
import { seed } from '../src/database/seed.js';
import { inTransaction } from '../src/database/transaction.js';
import { hashPassword } from '../src/modules/auth/auth.password.js';

const schema = `kists_test_${randomBytes(10).toString('hex')}`;
const database = new pg.Pool({
  connectionString: env.databaseUrl,
  options: `-c search_path=${schema},pg_catalog -c timezone=UTC`,
});

const password = randomBytes(24).toString('base64url');
const traineeEmail = 'assessment.trainee@example.invalid';

let schemaCreated = false;
let server: Server;
let base = '';
let traineeId = 0;
let assignmentId = 0;
let assessmentId = 0;
let forkliftAssignmentId = 0;
let forkliftAssessmentId = 0;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);

  await inTransaction(database, async (client) => {
    await migrate(client, schema);
    await seed(client, schema);
  });
  schemaCreated = true;

  const passwordHash = await hashPassword(password);

  const adminId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, is_active)
       SELECT 'TEST', 'Administrator', 'assessment.admin@example.invalid',
         $1, r.id, true
       FROM system_roles r
       WHERE r.name = 'administrator'
       RETURNING id`,
      [passwordHash],
    )
  ).rows[0]!.id;

  traineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, job_role_id, is_active)
       SELECT 'TEST', 'Assessment', $1, $2, r.id, j.id, true
       FROM system_roles r
       CROSS JOIN job_roles j
       WHERE r.name = 'trainee'
         AND j.name = 'Warehouse Operative'
       RETURNING id`,
      [traineeEmail, passwordHash],
    )
  ).rows[0]!.id;

  const manualModuleId = (
    await database.query<{ id: number }>(
      `SELECT id
       FROM training_modules
       WHERE slug = 'manual-handling'`,
    )
  ).rows[0]!.id;

  assignmentId = (
    await database.query<{ id: number }>(
      `INSERT INTO training_assignments
        (trainee_id, training_module_id, assigned_by, required)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [traineeId, manualModuleId, adminId],
    )
  ).rows[0]!.id;

  assessmentId = (
    await database.query<{ id: number }>(
      `SELECT id
       FROM assessments
       WHERE training_module_id = $1
         AND is_active
       ORDER BY sequence_order
       LIMIT 1`,
      [manualModuleId],
    )
  ).rows[0]!.id;

  const forkliftModuleId = (
    await database.query<{ id: number }>(
      `SELECT id FROM training_modules WHERE slug='forklift-pedestrian-safety'`,
    )
  ).rows[0]!.id;
  forkliftAssignmentId = (
    await database.query<{ id: number }>(
      `INSERT INTO training_assignments
       (trainee_id, training_module_id, assigned_by, required)
       VALUES ($1,$2,$3,true) RETURNING id`,
      [traineeId, forkliftModuleId, adminId],
    )
  ).rows[0]!.id;
  await database.query(
    `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id)
     VALUES ($1,$2,$3)`,
    [traineeId, forkliftModuleId, forkliftAssignmentId],
  );
  forkliftAssessmentId = (
    await database.query<{ id: number }>(
      `SELECT id FROM assessments WHERE training_module_id=$1 AND is_active`,
      [forkliftModuleId],
    )
  ).rows[0]!.id;

  server = createApp(database).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  if (schemaCreated) {
    await database.query(`DROP SCHEMA ${quotedSchema(schema)} CASCADE`);
  }

  await database.end();
});

async function login(): Promise<string> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: traineeEmail,
      password,
    }),
  });

  assert.equal(response.status, 200);

  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie || !cookie.startsWith('kists_session=')) {
    throw new Error('Login did not return a KISTS session cookie.');
  }
  return cookie;
}

async function getAssessment(cookie: string): Promise<Response> {
  return fetch(`${base}/api/trainee/training/${assignmentId}/assessment`, {
    headers: { Cookie: cookie },
  });
}

async function submitAssessment(
  cookie: string,
  answers: Array<{ questionId: number; optionId: number }>,
): Promise<Response> {
  return fetch(
    `${base}/api/trainee/training/${assignmentId}/assessment/submit`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: env.clientUrl,
        'X-KISTS-Request': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    },
  );
}

async function completeLearning(): Promise<void> {
  await database.query(
    `INSERT INTO training_content_completion
      (trainee_id, training_assignment_id, training_module_id, training_content_id)
     SELECT ta.trainee_id,
       ta.id,
       ta.training_module_id,
       c.id
     FROM training_assignments ta
     JOIN training_content c
       ON c.training_module_id = ta.training_module_id
      AND c.is_active
     WHERE ta.id = $1
     ON CONFLICT (training_assignment_id, training_content_id) DO NOTHING`,
    [assignmentId],
  );
}

async function completeScenario(
  targetAssignmentId = assignmentId,
): Promise<void> {
  await database.query(
    `INSERT INTO scenario_attempts
      (trainee_id, training_assignment_id, training_module_id, scenario_id,
       started_at, completed_at)
     SELECT ta.trainee_id,
       ta.id,
       ta.training_module_id,
       s.id,
       clock_timestamp() - interval '10 minutes',
       clock_timestamp()
     FROM training_assignments ta
     JOIN scenarios s
       ON s.training_module_id = ta.training_module_id
      AND s.is_active
     WHERE ta.id = $1
     ON CONFLICT (training_assignment_id, scenario_id) DO UPDATE SET
       completed_at = COALESCE(
         scenario_attempts.completed_at,
         EXCLUDED.completed_at
       )`,
    [targetAssignmentId],
  );
}

async function answerSet(correct: boolean) {
  const result = await database.query<{
    questionId: number;
    optionId: number;
  }>(
    `SELECT DISTINCT ON (q.id)
       q.id AS "questionId",
       ao.id AS "optionId"
     FROM questions q
     JOIN answer_options ao
       ON ao.question_id = q.id
     WHERE q.assessment_id = $1
       AND ao.is_correct = $2
     ORDER BY q.id, ao.sequence_order, ao.id`,
    [assessmentId, correct],
  );

  return result.rows;
}

test('final assessment is gated, server-scored, retryable and completes training only after a pass', async () => {
  const cookie = await login();

  const learningLocked = await getAssessment(cookie);
  assert.equal(learningLocked.status, 409);
  assert.equal(
    (
      (await learningLocked.json()) as {
        error: { code: string };
      }
    ).error.code,
    'ASSESSMENT_LEARNING_LOCKED',
  );

  await completeLearning();

  const scenarioLocked = await getAssessment(cookie);
  assert.equal(scenarioLocked.status, 409);
  assert.equal(
    (
      (await scenarioLocked.json()) as {
        error: { code: string };
      }
    ).error.code,
    'ASSESSMENT_SCENARIO_LOCKED',
  );

  await completeScenario();

  const available = await getAssessment(cookie);
  assert.equal(available.status, 200);
  assert.equal(available.headers.get('cache-control'), 'no-store');

  const detail = (await available.json()) as {
    assignmentId: number;
    assessment: {
      id: number;
      title: string;
      passPercentage: number;
    };
    questions: Array<{
      id: number;
      questionText: string;
      options: Array<{
        id: number;
        optionText: string;
      }>;
    }>;
    latestAttempt: null;
  };

  assert.equal(detail.assignmentId, assignmentId);
  assert.equal(detail.assessment.id, assessmentId);
  assert.equal(detail.assessment.title, 'Manual Handling Final Assessment');
  assert.equal(detail.assessment.passPercentage, 75);
  assert.equal(detail.questions.length, 10);
  assert.equal(detail.latestAttempt, null);
  assert.ok(
    detail.questions.every((question) => question.options.length === 4),
  );

  const publicPayload = JSON.stringify(detail);
  assert.equal(publicPayload.includes('is_correct'), false);
  assert.equal(publicPayload.includes('isCorrect'), false);

  const correctAnswers = await answerSet(true);
  const wrongAnswers = await answerSet(false);
  assert.equal(correctAnswers.length, 10);
  assert.equal(wrongAnswers.length, 10);

  const incomplete = await submitAssessment(cookie, correctAnswers.slice(0, 9));
  assert.equal(incomplete.status, 400);
  assert.equal(
    (
      (await incomplete.json()) as {
        error: { code: string };
      }
    ).error.code,
    'ASSESSMENT_INCOMPLETE',
  );

  const invalidAnswers = correctAnswers.map((answer) => ({ ...answer }));
  invalidAnswers[0]!.optionId = correctAnswers[1]!.optionId;

  const invalid = await submitAssessment(cookie, invalidAnswers);
  assert.equal(invalid.status, 400);
  assert.equal(
    (
      (await invalid.json()) as {
        error: { code: string };
      }
    ).error.code,
    'INVALID_ASSESSMENT_ANSWER',
  );

  const failed = await submitAssessment(cookie, wrongAnswers);
  assert.equal(failed.status, 201);

  const failedResult = (await failed.json()) as {
    correctAnswers: number;
    totalQuestions: number;
    attempt: {
      attemptNumber: number;
      scorePercentage: number;
      passPercentage: number;
      passed: boolean;
    };
  };

  assert.equal(failedResult.correctAnswers, 0);
  assert.equal(failedResult.totalQuestions, 10);
  assert.equal(failedResult.attempt.attemptNumber, 1);
  assert.equal(failedResult.attempt.scorePercentage, 0);
  assert.equal(failedResult.attempt.passPercentage, 75);
  assert.equal(failedResult.attempt.passed, false);

  const progressAfterFailure = await database.query<{
    percentage: string;
    completedAt: Date | null;
  }>(
    `SELECT percentage::text AS percentage,
       completed_at AS "completedAt"
     FROM progress
     WHERE training_assignment_id = $1`,
    [assignmentId],
  );
  assert.equal(progressAfterFailure.rowCount, 0);

  const afterFailure = await getAssessment(cookie);
  assert.equal(afterFailure.status, 200);
  const afterFailureBody = (await afterFailure.json()) as {
    latestAttempt: {
      attemptNumber: number;
      scorePercentage: number;
      passed: boolean;
    };
  };
  assert.equal(afterFailureBody.latestAttempt.attemptNumber, 1);
  assert.equal(afterFailureBody.latestAttempt.scorePercentage, 0);
  assert.equal(afterFailureBody.latestAttempt.passed, false);

  const passed = await submitAssessment(cookie, correctAnswers);
  assert.equal(passed.status, 201);

  const passedResult = (await passed.json()) as {
    correctAnswers: number;
    totalQuestions: number;
    attempt: {
      attemptNumber: number;
      scorePercentage: number;
      passPercentage: number;
      passed: boolean;
    };
  };

  assert.equal(passedResult.correctAnswers, 10);
  assert.equal(passedResult.totalQuestions, 10);
  assert.equal(passedResult.attempt.attemptNumber, 2);
  assert.equal(passedResult.attempt.scorePercentage, 100);
  assert.equal(passedResult.attempt.passPercentage, 75);
  assert.equal(passedResult.attempt.passed, true);

  const saved = await database.query<{
    attemptCount: number;
    responseCount: number;
    percentage: string;
    completedAt: Date | null;
  }>(
    `SELECT
       (SELECT COUNT(*)::int
          FROM assessment_attempts
         WHERE trainee_id = $1
           AND training_assignment_id = $2
           AND assessment_id = $3) AS "attemptCount",
       (SELECT COUNT(*)::int
          FROM assessment_responses ar
          JOIN assessment_attempts aa
            ON aa.id = ar.assessment_attempt_id
         WHERE aa.trainee_id = $1
           AND aa.training_assignment_id = $2
           AND aa.assessment_id = $3) AS "responseCount",
       p.percentage::text AS percentage,
       p.completed_at AS "completedAt"
     FROM progress p
     WHERE p.training_assignment_id = $2`,
    [traineeId, assignmentId, assessmentId],
  );

  assert.equal(saved.rows[0]!.attemptCount, 2);
  assert.equal(saved.rows[0]!.responseCount, 20);
  assert.equal(Number(saved.rows[0]!.percentage), 100);
  assert.ok(saved.rows[0]!.completedAt);

  const finalDetail = await getAssessment(cookie);
  assert.equal(finalDetail.status, 200);
  const finalBody = (await finalDetail.json()) as {
    latestAttempt: {
      attemptNumber: number;
      scorePercentage: number;
      passed: boolean;
    };
  };
  assert.equal(finalBody.latestAttempt.attemptNumber, 2);
  assert.equal(finalBody.latestAttempt.scorePercentage, 100);
  assert.equal(finalBody.latestAttempt.passed, true);

  const duplicatePass = await submitAssessment(cookie, correctAnswers);
  assert.equal(duplicatePass.status, 409);
  assert.equal(
    (
      (await duplicatePass.json()) as {
        error: { code: string };
      }
    ).error.code,
    'ASSESSMENT_ALREADY_PASSED',
  );
});

test('Forklift assessment requires learning and scenario completion before a pass', async () => {
  const cookie = await login();
  const endpoint = `${base}/api/trainee/training/${forkliftAssignmentId}/assessment`;
  const locked = await fetch(endpoint, { headers: { Cookie: cookie } });
  assert.equal(locked.status, 409);

  await database.query(
    `INSERT INTO training_content_completion
      (trainee_id, training_assignment_id, training_module_id, training_content_id)
     SELECT ta.trainee_id,ta.id,ta.training_module_id,c.id
     FROM training_assignments ta JOIN training_content c
       ON c.training_module_id=ta.training_module_id AND c.is_active
     WHERE ta.id=$1`,
    [forkliftAssignmentId],
  );

  const scenarioLocked = await fetch(endpoint, { headers: { Cookie: cookie } });
  assert.equal(scenarioLocked.status, 409);
  assert.equal(
    ((await scenarioLocked.json()) as { error: { code: string } }).error.code,
    'ASSESSMENT_SCENARIO_LOCKED',
  );
  await completeScenario(forkliftAssignmentId);

  const available = await fetch(endpoint, { headers: { Cookie: cookie } });
  assert.equal(available.status, 200);
  const detail = (await available.json()) as {
    moduleTitle: string;
    hasScenario: boolean;
    questions: Array<{ id: number; options: Array<{ id: number }> }>;
    assessment: { passPercentage: number };
  };
  assert.equal(detail.moduleTitle, 'Forklift and Pedestrian Safety');
  assert.equal(detail.hasScenario, true);
  assert.equal(detail.questions.length, 10);
  assert.equal(detail.assessment.passPercentage, 75);

  const answers = async (correct: boolean) =>
    (
      await database.query<{ questionId: number; optionId: number }>(
        `SELECT DISTINCT ON(q.id) q.id AS "questionId",ao.id AS "optionId"
         FROM questions q JOIN answer_options ao ON ao.question_id=q.id
         WHERE q.assessment_id=$1 AND ao.is_correct=$2
         ORDER BY q.id,ao.sequence_order`,
        [forkliftAssessmentId, correct],
      )
    ).rows;
  const submit = (body: unknown) =>
    fetch(`${endpoint}/submit`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: env.clientUrl,
        'X-KISTS-Request': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers: body }),
    });

  const failed = await submit(await answers(false));
  assert.equal(failed.status, 201);
  assert.equal(
    ((await failed.json()) as { attempt: { passed: boolean } }).attempt.passed,
    false,
  );
  assert.equal(
    Number(
      (
        await database.query<{ percentage: string }>(
          `SELECT percentage::text AS percentage FROM progress WHERE training_assignment_id=$1`,
          [forkliftAssignmentId],
        )
      ).rows[0]!.percentage,
    ),
    0,
  );

  const passed = await submit(await answers(true));
  assert.equal(passed.status, 201);
  assert.equal(
    ((await passed.json()) as { attempt: { passed: boolean } }).attempt.passed,
    true,
  );
  const progress = (
    await database.query<{ percentage: string; completedAt: Date | null }>(
      `SELECT percentage::text AS percentage,completed_at AS "completedAt" FROM progress WHERE training_assignment_id=$1`,
      [forkliftAssignmentId],
    )
  ).rows[0]!;
  assert.equal(Number(progress.percentage), 100);
  assert.ok(progress.completedAt);
});
