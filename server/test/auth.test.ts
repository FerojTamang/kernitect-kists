import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import pg from 'pg';
import express from 'express';
import { migrate, quotedSchema } from '../src/database/migrate.js';
import { seed } from '../src/database/seed.js';
import { inTransaction } from '../src/database/transaction.js';
import { assertLocalDevelopmentDatabase } from '../src/database/safety.js';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService, hashToken } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth/auth.password.js';
import { sessionCookieOptions } from '../src/modules/auth/auth.cookie.js';
import {
  requireAuthentication,
  requireSystemRole,
} from '../src/middleware/authentication.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import type { AuthUser } from '../src/modules/auth/auth.types.js';

const schema = `kists_test_${randomBytes(10).toString('hex')}`;
const database = new pg.Pool({
  connectionString: env.databaseUrl,
  options: `-c search_path=${schema},pg_catalog -c timezone=UTC`,
});
let schemaCreated = false;
const password = randomBytes(24).toString('base64url');
const traineeEmail = 'auth.trainee@example.invalid';
const adminEmail = 'auth.administrator@example.invalid';
const emptyTraineeEmail = 'empty.dashboard@example.invalid';
let server: Server;
let base: string;
let traineeId: number;
let otherTraineeId: number;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);
  await inTransaction(database, async (client) => {
    await migrate(client, schema);
    await seed(client, schema);
  });
  schemaCreated = true;
  const passwordHash = await hashPassword(password);
  for (const [email, role, job, active] of [
    [traineeEmail, 'trainee', 'Warehouse Operative', true],
    [adminEmail, 'administrator', null, true],
    [emptyTraineeEmail, 'trainee', 'Warehouse Operative', true],
    ['auth.disabled@example.invalid', 'trainee', 'Warehouse Operative', false],
    ['auth.supervisor@example.invalid', 'trainee', 'Supervisor', true],
  ]) {
    const row = await database.query<{ id: number }>(
      `INSERT INTO users
      (first_name, last_name, email, password_hash, system_role_id, job_role_id, is_active)
      SELECT 'TEST', 'Auth', $1, $2, r.id, j.id, $5 FROM system_roles r
      LEFT JOIN job_roles j ON j.name = $4 WHERE r.name = $3 RETURNING id`,
      [email, passwordHash, role, job, active],
    );
    if (email === traineeEmail) traineeId = row.rows[0]!.id;
  }
  otherTraineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
      (first_name, last_name, email, password_hash, system_role_id, job_role_id)
      SELECT 'OTHER', 'Trainee', 'other.dashboard@example.invalid', $1, r.id, j.id
      FROM system_roles r CROSS JOIN job_roles j
      WHERE r.name = 'trainee' AND j.name = 'Warehouse Operative' RETURNING id`,
      [passwordHash],
    )
  ).rows[0]!.id;
  const adminId = (
    await database.query<{ id: number }>(
      `SELECT u.id FROM users u JOIN system_roles r ON r.id = u.system_role_id
       WHERE lower(u.email) = $1 AND r.name = 'administrator'`,
      [adminEmail],
    )
  ).rows[0]!.id;
  const manualId = (
    await database.query<{ id: number }>(
      "SELECT id FROM training_modules WHERE slug = 'manual-handling'",
    )
  ).rows[0]!.id;
  const forkliftId = (
    await database.query<{ id: number }>(
      "SELECT id FROM training_modules WHERE slug = 'forklift-pedestrian-safety'",
    )
  ).rows[0]!.id;
  await database.query(
    `INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by)
     VALUES ($1, $3, $4), ($1, $5, $4), ($2, $3, $4)`,
    [traineeId, otherTraineeId, manualId, adminId, forkliftId],
  );
  await database.query(
    `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id,
      percentage, started_at, last_accessed_at)
     SELECT trainee_id, training_module_id, id, 60, now() - interval '45 minutes', now()
     FROM training_assignments WHERE trainee_id = $1 AND training_module_id = $2`,
    [traineeId, manualId],
  );
  const app = express();
  const service = new AuthService(new AuthRepository(database));
  // Test-only protected endpoint: no administrator feature API is introduced.
  app.get(
    '/authorization-probe',
    requireAuthentication(service),
    requireSystemRole('administrator'),
    (_req, res) => res.json({ allowed: true }),
  );
  app.use(createApp(database));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  if (schemaCreated)
    await database.query(`DROP SCHEMA ${quotedSchema(schema)} CASCADE`);
  await database.end();
});

async function login(
  email = traineeEmail,
  overrides: Record<string, unknown> = {},
  cookie?: string,
) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ email, password, ...overrides }),
  });
}
function cookieFrom(response: Response): string {
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('kists_session='));
  return cookie!;
}
async function me(cookie?: string) {
  return fetch(`${base}/api/auth/me`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

async function dashboard(cookie?: string) {
  return fetch(`${base}/api/trainee/dashboard`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

async function trainingModule(cookie?: string, assignmentId?: number) {
  return fetch(`${base}/api/trainee/training/${assignmentId ?? 0}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

async function completeTrainingContent(
  cookie: string | undefined,
  assignmentId: number | string,
  contentId: number | string,
) {
  return fetch(
    `${base}/api/trainee/training/${assignmentId}/content/${contentId}/complete`,
    { method: 'POST', headers: cookie ? { Cookie: cookie } : {} },
  );
}

async function answerTrainingQuestion(
  cookie: string | undefined,
  assignmentId: number | string,
  contentId: number | string,
  questionId: number | string,
  optionId: number | string,
) {
  return fetch(
    `${base}/api/trainee/training/${assignmentId}/content/${contentId}/questions/${questionId}/answer`,
    {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ optionId }),
    },
  );
}

async function trainingScenario(cookie?: string, assignmentId?: number) {
  return fetch(`${base}/api/trainee/training/${assignmentId ?? 0}/scenario`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

async function answerScenarioHazard(
  cookie: string | undefined,
  assignmentId: number | string,
  hazardId: number | string,
  decisionKey: string,
  trusted = true,
) {
  return fetch(
    `${base}/api/trainee/training/${assignmentId}/scenario/hazards/${hazardId}/respond`,
    {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'Content-Type': 'application/json',
        ...(trusted ? { Origin: env.clientUrl, 'X-KISTS-Request': '1' } : {}),
      },
      body: JSON.stringify({ decisionKey }),
    },
  );
}

test('valid trainee login returns only safe profile fields', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const body = (await response.json()) as { user: AuthUser };
  assert.equal(body.user.systemRole, 'trainee');
  assert.equal(body.user.jobRole, 'Warehouse Operative');
  assert.deepEqual(Object.keys(body.user).sort(), [
    'avatarUrl',
    'email',
    'firstName',
    'id',
    'jobRole',
    'lastName',
    'systemRole',
  ]);
  assert.deepEqual(Object.keys(body), ['user']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('valid administrator login has administrator system role and no job role', async () => {
  const response = await login(adminEmail);
  assert.equal(response.status, 200);
  const { user } = (await response.json()) as { user: AuthUser };
  assert.equal(user.systemRole, 'administrator');
  assert.equal(user.jobRole, null);
});

test('wrong passwords, nonexistent users and disabled accounts receive the same safe error', async () => {
  const wrong = await login(traineeEmail, {
    password: 'not-the-right-password',
  });
  const nonexistent = await login('unknown@example.invalid');
  const disabled = await login('auth.disabled@example.invalid');
  assert.equal(wrong.status, 401);
  assert.equal(nonexistent.status, 401);
  assert.equal(disabled.status, 401);
  const expected = await wrong.json();
  assert.deepEqual(await nonexistent.json(), expected);
  assert.deepEqual(await disabled.json(), expected);
  assert.equal(wrong.headers.get('set-cookie'), null);
});

test('authenticated me returns the safe user while anonymous me returns 401', async () => {
  assert.equal((await me()).status, 401);
  const response = await me(cookieFrom(await login()));
  assert.equal(response.status, 200);
  const { user } = (await response.json()) as { user: AuthUser };
  assert.equal(user.id, traineeId);
  assert.equal('password_hash' in user, false);
  assert.equal('passwordHash' in user, false);
  assert.equal('token_hash' in user, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('trainee dashboard is session-bound, role-protected and database-backed', async () => {
  assert.equal((await dashboard()).status, 401);
  assert.equal(
    (await dashboard(cookieFrom(await login(adminEmail)))).status,
    403,
  );
  const response = await dashboard(cookieFrom(await login()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = (await response.json()) as {
    trainee: AuthUser;
    summary: {
      totalAssigned: number;
      inProgress: number;
      notStarted: number;
      overallProgressPercentage: number;
    };
    assignedTraining: Array<Record<string, unknown>>;
  };
  assert.equal(body.trainee.id, traineeId);
  assert.equal(body.trainee.firstName, 'TEST');
  assert.equal('password_hash' in body, false);
  assert.equal('token_hash' in body, false);
  assert.equal(body.summary.totalAssigned, 2);
  assert.equal(body.summary.inProgress, 1);
  assert.equal(body.summary.notStarted, 1);
  assert.equal(body.summary.overallProgressPercentage, 30);
  assert.deepEqual(
    body.assignedTraining.map((assignment) => assignment.title),
    ['Manual Handling', 'Forklift and Pedestrian Safety'],
  );
  assert.equal(body.assignedTraining[0]?.progressPercentage, 60);
  assert.equal(body.assignedTraining[0]?.status, 'in_progress');
  assert.equal(
    body.assignedTraining.some(
      (assignment) => assignment.title === 'Forklift and Pedestrian Safety',
    ),
    true,
  );
  assert.equal(
    body.assignedTraining.some(
      (assignment) => assignment.assignmentId === otherTraineeId,
    ),
    false,
  );
  const emptyResponse = await dashboard(
    cookieFrom(await login(emptyTraineeEmail)),
  );
  assert.equal(emptyResponse.status, 200);
  const emptyBody = (await emptyResponse.json()) as {
    summary: { totalAssigned: number; overallProgressPercentage: number };
    assignedTraining: unknown[];
  };
  assert.deepEqual(emptyBody.summary, {
    totalAssigned: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overallProgressPercentage: 0,
  });
  assert.deepEqual(emptyBody.assignedTraining, []);
});

test('trainee dashboard exposes only current active required training', async () => {
  await database.query(
    "UPDATE training_modules SET is_active=true WHERE slug='forklift-pedestrian-safety'",
  );
  const forklift = await database.query<{ id: number }>(
    `UPDATE training_assignments ta SET required=false
     FROM training_modules m
     WHERE ta.training_module_id=m.id AND ta.trainee_id=$1
       AND m.slug='forklift-pedestrian-safety' AND ta.status='active'
     RETURNING ta.id`,
    [traineeId],
  );
  assert.equal(forklift.rowCount, 1);
  try {
    const response = await dashboard(cookieFrom(await login()));
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: { totalAssigned: number; overallProgressPercentage: number };
      assignedTraining: Array<{ title: string }>;
    };
    assert.equal(body.summary.totalAssigned, 1);
    assert.equal(body.summary.overallProgressPercentage, 60);
    assert.deepEqual(
      body.assignedTraining.map((assignment) => assignment.title),
      ['Manual Handling'],
    );
  } finally {
    await database.query(
      'UPDATE training_assignments SET required=true WHERE id=$1',
      [forklift.rows[0]!.id],
    );
    await database.query(
      "UPDATE training_modules SET is_active=false WHERE slug='forklift-pedestrian-safety'",
    );
  }
});

test('manual handling module endpoint is trainee-only, assignment-bound and resume-aware', async () => {
  const cookie = cookieFrom(await login());
  const assignmentRow = await database.query<{ id: number }>(
    `SELECT a.id FROM training_assignments a
     JOIN training_modules m ON m.id = a.training_module_id
     WHERE a.trainee_id = $1 AND m.slug = 'manual-handling' AND a.status = 'active'`,
    [traineeId],
  );
  assert.ok(assignmentRow.rows[0]);
  const assignmentId = assignmentRow.rows[0]!.id;

  assert.equal((await trainingModule()).status, 401);
  assert.equal(
    (await trainingModule(cookieFrom(await login(adminEmail)), assignmentId))
      .status,
    403,
  );
  assert.equal((await trainingModule(cookie, otherTraineeId)).status, 404);

  const response = await trainingModule(cookie, assignmentId);
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    assignmentId: number;
    moduleTitle: string;
    status: string;
    progress: {
      assignmentPercentage: number;
      learningProgressPercentage: number;
      completedSections: number;
      totalSections: number;
    };
    sections: Array<{
      id: number;
      title: string;
      sequenceOrder: number;
      completedAt: string | null;
      formativeQuestions: Array<{ options: unknown[] }>;
    }>;
    resumeSectionIndex: number;
  };
  assert.equal(body.assignmentId, assignmentId);
  assert.equal(body.moduleTitle, 'Manual Handling');
  assert.equal(body.status, 'in_progress');
  assert.equal(body.progress.assignmentPercentage, 60);
  assert.equal(body.progress.learningProgressPercentage, 0);
  assert.equal(body.progress.totalSections, 5);
  assert.equal(body.sections[0]?.formativeQuestions.length, 2);
  assert.equal(body.sections[0]?.formativeQuestions[0]?.options.length, 4);
  assert.deepEqual(
    body.sections.map((section) => section.title),
    [
      'Introduction',
      'Risks and Injuries',
      'Assessing the Task and Load',
      'Safe Lifting Techniques',
      'Practical Examples',
    ],
  );
  assert.equal(body.resumeSectionIndex, 0);

  const missing = await trainingModule(cookie, 999999);
  assert.equal(missing.status, 404);
});

test('content completion persists, is idempotent and never completes the full assignment', async () => {
  const cookie = cookieFrom(await login());
  const assignmentId = (
    await database.query<{ id: number }>(
      `SELECT a.id FROM training_assignments a
       JOIN training_modules m ON m.id = a.training_module_id
       WHERE a.trainee_id = $1 AND m.slug = 'manual-handling'`,
      [traineeId],
    )
  ).rows[0]!.id;
  const otherAssignmentId = (
    await database.query<{ id: number }>(
      `SELECT a.id FROM training_assignments a
       JOIN training_modules m ON m.id = a.training_module_id
       WHERE a.trainee_id = $1 AND m.slug = 'manual-handling'`,
      [otherTraineeId],
    )
  ).rows[0]!.id;
  const contentIds = (
    await database.query<{ id: number }>(
      `SELECT c.id FROM training_content c
       JOIN training_modules m ON m.id = c.training_module_id
       WHERE m.slug = 'manual-handling' AND c.is_active ORDER BY c.sequence_order`,
    )
  ).rows.map((row) => row.id);
  assert.equal(contentIds.length, 5);

  const questions = (
    await database.query<{
      contentId: number;
      questionId: number;
      optionId: number;
      isCorrect: boolean;
    }>(
      `SELECT fq.training_content_id AS "contentId", fq.id AS "questionId",
        fo.id AS "optionId", fo.is_correct AS "isCorrect"
       FROM formative_questions fq
       JOIN training_content c ON c.id = fq.training_content_id
       JOIN training_modules m ON m.id = c.training_module_id
       JOIN formative_answer_options fo ON fo.formative_question_id = fq.id
       WHERE m.slug = 'manual-handling'
         AND fo.is_correct
       ORDER BY fq.training_content_id, fq.sequence_order`,
    )
  ).rows;
  assert.equal(questions.length, 10);

  assert.equal(
    (await completeTrainingContent(undefined, assignmentId, contentIds[0]!))
      .status,
    401,
  );
  assert.equal(
    (await completeTrainingContent(cookie, 'bad', contentIds[0]!)).status,
    400,
  );
  assert.equal(
    (await completeTrainingContent(cookie, assignmentId, 'bad')).status,
    400,
  );
  assert.equal(
    (await completeTrainingContent(cookie, 999999, contentIds[0]!)).status,
    404,
  );
  assert.equal(
    (await completeTrainingContent(cookie, assignmentId, 999999)).status,
    404,
  );
  assert.equal(
    (await completeTrainingContent(cookie, otherAssignmentId, contentIds[0]!))
      .status,
    404,
  );

  assert.equal(
    (await completeTrainingContent(cookie, assignmentId, contentIds[0]!))
      .status,
    409,
  );

  const firstQuestion = questions[0]!;
  assert.equal(
    (
      await answerTrainingQuestion(
        cookie,
        otherAssignmentId,
        firstQuestion.contentId,
        firstQuestion.questionId,
        firstQuestion.optionId,
      )
    ).status,
    404,
  );
  const wrongOption = (
    await database.query<{ id: number }>(
      `SELECT id FROM formative_answer_options
       WHERE formative_question_id = $1 AND is_correct = false LIMIT 1`,
      [firstQuestion.questionId],
    )
  ).rows[0]!.id;
  const wrong = await answerTrainingQuestion(
    cookie,
    assignmentId,
    firstQuestion.contentId,
    firstQuestion.questionId,
    wrongOption,
  );
  assert.equal(wrong.status, 200);
  assert.equal(((await wrong.json()) as { correct: boolean }).correct, false);
  const firstCorrect = await answerTrainingQuestion(
    cookie,
    assignmentId,
    firstQuestion.contentId,
    firstQuestion.questionId,
    firstQuestion.optionId,
  );
  assert.equal(firstCorrect.status, 200);
  assert.equal(
    ((await firstCorrect.json()) as { sectionComplete: boolean })
      .sectionComplete,
    false,
  );

  for (const [index, contentId] of contentIds.entries()) {
    for (const question of questions.filter(
      (item) => item.contentId === contentId,
    )) {
      if (question.questionId === firstQuestion.questionId) continue;
      const response = await answerTrainingQuestion(
        cookie,
        assignmentId,
        contentId,
        question.questionId,
        question.optionId,
      );
      assert.equal(response.status, 200);
    }
    const response = await trainingModule(cookie, assignmentId);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      progress: {
        learningProgressPercentage: number;
        completedSections: number;
        totalSections: number;
      };
      resumeSectionIndex: number;
      sections: Array<{ completedAt: string | null }>;
    };
    assert.equal(body.progress.learningProgressPercentage, (index + 1) * 20);
    assert.equal(body.progress.completedSections, index + 1);
    assert.equal(body.progress.totalSections, 5);
    assert.equal(body.resumeSectionIndex, index < 4 ? index + 1 : 0);
    assert.ok(body.sections[index]!.completedAt);
  }

  const repeated = await answerTrainingQuestion(
    cookie,
    assignmentId,
    firstQuestion.contentId,
    firstQuestion.questionId,
    firstQuestion.optionId,
  );
  assert.equal(repeated.status, 200);
  assert.equal(
    (
      await database.query(
        'SELECT count(*)::integer AS count FROM training_content_completion WHERE training_assignment_id = $1',
        [assignmentId],
      )
    ).rows[0].count,
    5,
  );

  const refreshed = (await (
    await trainingModule(cookie, assignmentId)
  ).json()) as {
    progress: { learningProgressPercentage: number };
  };
  assert.equal(refreshed.progress.learningProgressPercentage, 100);

  const dashboardBody = (await (await dashboard(cookie)).json()) as {
    assignedTraining: Array<{ title: string; status: string }>;
  };
  assert.equal(
    dashboardBody.assignedTraining.find(
      (item) => item.title === 'Manual Handling',
    )?.status,
    'in_progress',
  );
  assert.equal(
    (
      await database.query(
        `SELECT count(*)::integer AS count FROM certificates WHERE trainee_id = $1`,
        [traineeId],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await database.query(
        `SELECT count(*)::integer AS count FROM assessment_attempts WHERE trainee_id = $1`,
        [traineeId],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(JSON.stringify(refreshed).includes('password'), false);
  assert.equal(JSON.stringify(refreshed).includes('token'), false);
});

test('manual handling scenario is learning-gated, assignment-bound and persists five safety decisions', async () => {
  const cookie = cookieFrom(await login());
  const otherCookie = cookieFrom(
    await login('other.dashboard@example.invalid'),
  );
  const assignmentId = (
    await database.query<{ id: number }>(
      `SELECT a.id FROM training_assignments a
       JOIN training_modules m ON m.id = a.training_module_id
       WHERE a.trainee_id = $1 AND m.slug = 'manual-handling'`,
      [traineeId],
    )
  ).rows[0]!.id;
  const otherAssignmentId = (
    await database.query<{ id: number }>(
      `SELECT a.id FROM training_assignments a
       JOIN training_modules m ON m.id = a.training_module_id
       WHERE a.trainee_id = $1 AND m.slug = 'manual-handling'`,
      [otherTraineeId],
    )
  ).rows[0]!.id;

  assert.equal((await trainingScenario()).status, 401);
  assert.equal(
    (await trainingScenario(cookieFrom(await login(adminEmail)), assignmentId))
      .status,
    403,
  );
  assert.equal((await trainingScenario(cookie, otherAssignmentId)).status, 404);

  const locked = await trainingScenario(otherCookie, otherAssignmentId);
  assert.equal(locked.status, 409);
  assert.equal(
    ((await locked.json()) as { error: { code: string } }).error.code,
    'SCENARIO_LOCKED',
  );

  await database.query(
    `INSERT INTO training_content_completion
      (trainee_id, training_assignment_id, training_module_id, training_content_id)
     SELECT a.trainee_id, a.id, a.training_module_id, c.id
     FROM training_assignments a
     JOIN training_content c ON c.training_module_id = a.training_module_id AND c.is_active
     WHERE a.id = $1
     ON CONFLICT (training_assignment_id, training_content_id) DO NOTHING`,
    [assignmentId],
  );

  const opened = await trainingScenario(cookie, assignmentId);
  assert.equal(opened.status, 200);
  const body = (await opened.json()) as {
    assignmentId: number;
    scenario: { id: number; resourceReference: string };
    progress: {
      completedHazards: number;
      totalHazards: number;
      completed: boolean;
    };
    hazards: Array<{
      id: number;
      sequenceOrder: number;
      decisionOptions: Array<{ key: string; label: string }>;
      selectedDecisionKey: string | null;
      answeredCorrectly: boolean;
      feedback: string | null;
    }>;
  };
  assert.equal(body.assignmentId, assignmentId);
  assert.equal(
    body.scenario.resourceReference,
    'asset://scenarios/manual-handling/manual-handling-warehouse.jpg',
  );
  assert.equal(body.progress.completedHazards, 0);
  assert.equal(body.progress.totalHazards, 5);
  assert.equal(body.progress.completed, false);
  assert.equal(body.hazards.length, 5);
  assert.ok(
    body.hazards.every((hazard) => hazard.decisionOptions.length === 3),
  );
  assert.equal(JSON.stringify(body).includes('correctDecisionKey'), false);

  const firstHazard = body.hazards[0]!;
  assert.equal(
    (
      await answerScenarioHazard(
        cookie,
        assignmentId,
        firstHazard.id,
        firstHazard.decisionOptions[0]!.key,
        false,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await answerScenarioHazard(
        cookie,
        assignmentId,
        firstHazard.id,
        'not-a-real-decision',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await answerScenarioHazard(
        otherCookie,
        assignmentId,
        firstHazard.id,
        firstHazard.decisionOptions[0]!.key,
      )
    ).status,
    404,
  );

  const decisions = (
    await database.query<{
      hazardId: number;
      correctDecisionKey: string;
      wrongDecisionKey: string;
    }>(
      `SELECT h.id AS "hazardId",
        h.metadata->>'correctDecisionKey' AS "correctDecisionKey",
        (
          SELECT option->>'key'
          FROM jsonb_array_elements(h.metadata->'decisionOptions') option
          WHERE option->>'key' <> h.metadata->>'correctDecisionKey'
          LIMIT 1
        ) AS "wrongDecisionKey"
       FROM hazards h
       WHERE h.scenario_id = $1
       ORDER BY h.sequence_order`,
      [body.scenario.id],
    )
  ).rows;
  assert.equal(decisions.length, 5);

  const wrong = await answerScenarioHazard(
    cookie,
    assignmentId,
    decisions[0]!.hazardId,
    decisions[0]!.wrongDecisionKey,
  );
  assert.equal(wrong.status, 200);
  assert.equal(((await wrong.json()) as { correct: boolean }).correct, false);

  for (const [index, decision] of decisions.entries()) {
    const response = await answerScenarioHazard(
      cookie,
      assignmentId,
      decision.hazardId,
      decision.correctDecisionKey,
    );
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      correct: boolean;
      scenario: {
        progress: {
          completedHazards: number;
          totalHazards: number;
          completed: boolean;
        };
      };
    };
    assert.equal(result.correct, true);
    assert.equal(result.scenario.progress.completedHazards, index + 1);
    assert.equal(result.scenario.progress.totalHazards, 5);
    assert.equal(result.scenario.progress.completed, index === 4);
  }

  const refreshed = (await (
    await trainingScenario(cookie, assignmentId)
  ).json()) as {
    progress: {
      completedHazards: number;
      completed: boolean;
      completedAt: string | null;
    };
  };
  assert.equal(refreshed.progress.completedHazards, 5);
  assert.equal(refreshed.progress.completed, true);
  assert.ok(refreshed.progress.completedAt);

  const repeated = await answerScenarioHazard(
    cookie,
    assignmentId,
    decisions[4]!.hazardId,
    decisions[4]!.correctDecisionKey,
  );
  assert.equal(repeated.status, 200);
  assert.equal(
    (
      await database.query(
        `SELECT count(*)::int AS count
         FROM scenario_hazard_responses shr
         JOIN scenario_attempts sa ON sa.id = shr.scenario_attempt_id
         WHERE sa.training_assignment_id = $1`,
        [assignmentId],
      )
    ).rows[0].count,
    5,
  );

  const assignmentProgress = (
    await database.query<{ percentage: string; completedAt: Date | null }>(
      `SELECT percentage::text AS percentage, completed_at AS "completedAt"
       FROM progress WHERE training_assignment_id = $1`,
      [assignmentId],
    )
  ).rows[0]!;
  assert.equal(Number(assignmentProgress.percentage), 67);
  assert.equal(assignmentProgress.completedAt, null);
  assert.equal(
    (
      await database.query(
        'SELECT count(*)::int AS count FROM assessment_attempts WHERE training_assignment_id = $1',
        [assignmentId],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await database.query(
        'SELECT count(*)::int AS count FROM certificates WHERE trainee_id = $1',
        [traineeId],
      )
    ).rows[0].count,
    0,
  );
});

test('session cookie is HttpOnly, host-only, SameSite=Lax with an explicit eight-hour max-age', async () => {
  const response = await login();
  const header = response.headers.get('set-cookie')!;
  assert.ok(header.includes('HttpOnly'));
  assert.ok(header.includes('SameSite=Lax'));
  assert.ok(header.includes('Path=/'));
  assert.ok(header.includes('Max-Age=28800'));
  assert.ok(header.includes('Expires='));
  assert.ok(!header.includes('Domain='));
  assert.ok(!header.includes('Secure'));
  assert.equal(sessionCookieOptions(false).sameSite, 'lax');
  assert.equal(sessionCookieOptions(true).sameSite, 'none');
  assert.equal(sessionCookieOptions(true).secure, true);
});

test('remember me changes both database expiry and cookie lifetime to 30 days', async () => {
  const response = await login(traineeEmail, { rememberMe: true });
  assert.ok(response.headers.get('set-cookie')!.includes('Max-Age=2592000'));
  const token = cookieFrom(response).slice('kists_session='.length);
  const result = (
    await database.query(
      'SELECT extract(epoch FROM expires_at - created_at)::integer AS seconds FROM auth_sessions WHERE token_hash = $1',
      [hashToken(token)],
    )
  ).rows[0];
  assert.equal(result.seconds, 2592000);
});

test('database stores only a SHA-256 hash, never the opaque cookie token', async () => {
  const response = await login();
  const token = cookieFrom(response).slice('kists_session='.length);
  assert.equal(token.length, 43);
  const result = (
    await database.query(
      'SELECT token_hash FROM auth_sessions WHERE token_hash = $1',
      [hashToken(token)],
    )
  ).rows[0];
  assert.ok(
    result && result.token_hash !== token && result.token_hash.length === 64,
  );
  assert.ok(!JSON.stringify(await response.json()).includes(token));
});

test('logout clears the cookie and invalidates the saved session', async () => {
  const cookie = cookieFrom(await login());
  const response = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal(response.status, 204);
  assert.ok(response.headers.get('set-cookie')!.includes('kists_session=;'));
  assert.equal((await me(cookie)).status, 401);
});

test('expired and revoked sessions are rejected', async () => {
  for (const state of ['expired', 'revoked']) {
    const cookie = cookieFrom(await login());
    const hash = hashToken(cookie.slice('kists_session='.length));
    await database.query(
      state === 'expired'
        ? "UPDATE auth_sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE token_hash = $1"
        : 'UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE token_hash = $1',
      [hash],
    );
    const response = await me(cookie);
    assert.equal(response.status, 401);
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      'SESSION_EXPIRED',
    );
  }
});

test('disabling an account invalidates an already-issued session', async () => {
  const cookie = cookieFrom(await login());
  try {
    await database.query('UPDATE users SET is_active = false WHERE id = $1', [
      traineeId,
    ]);
    assert.equal((await me(cookie)).status, 401);
  } finally {
    await database.query('UPDATE users SET is_active = true WHERE id = $1', [
      traineeId,
    ]);
  }
});

test('login rotates the browser session instead of accepting a fixed token', async () => {
  const original = cookieFrom(await login());
  const replacement = cookieFrom(await login(traineeEmail, {}, original));
  assert.ok(original !== replacement);
  assert.equal((await me(original)).status, 401);
  assert.equal((await me(replacement)).status, 200);
});

test('trainee and Supervisor job roles cannot access an administrator endpoint', async () => {
  for (const email of [traineeEmail, 'auth.supervisor@example.invalid']) {
    const cookie = cookieFrom(await login(email));
    assert.equal(
      (
        await fetch(`${base}/authorization-probe`, {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
  }
});

test('administrator is accepted on a role-protected endpoint, anonymous user is rejected', async () => {
  const cookie = cookieFrom(await login(adminEmail));
  assert.equal(
    (
      await fetch(`${base}/authorization-probe`, {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  assert.equal((await fetch(`${base}/authorization-probe`)).status, 401);
});

test('malformed email, password, remember flag and unknown fields are rejected', async () => {
  for (const overrides of [
    { email: '' },
    { email: 'invalid' },
    { password: '' },
    { password: 12 },
    { password: 'é'.repeat(37) },
    { rememberMe: 'yes' },
    { systemRole: 'administrator' },
  ]) {
    assert.equal((await login(traineeEmail, overrides)).status, 400);
  }
});

test('untrusted or missing origins and missing custom headers cannot mutate authentication', async () => {
  for (const headers of [
    { Origin: 'https://untrusted.invalid', 'X-KISTS-Request': '1' },
    { 'X-KISTS-Request': '1' },
    { Origin: env.clientUrl },
  ]) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      } as Record<string, string>,
      body: JSON.stringify({ email: traineeEmail, password }),
    });
    assert.equal(response.status, 403);
  }
});

test('malformed cookies return 401 and security headers are present', async () => {
  const response = await me('kists_session=%not-a-token');
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('credentialed CORS is limited to CLIENT_URL', async () => {
  const allowed = await fetch(`${base}/api/auth/me`, {
    headers: { Origin: env.clientUrl },
  });
  assert.equal(
    allowed.headers.get('access-control-allow-origin'),
    env.clientUrl,
  );
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const denied = await fetch(`${base}/api/auth/me`, {
    headers: { Origin: 'https://untrusted.invalid' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('trainee can upload, read and remove a validated persistent avatar', async () => {
  const cookie = cookieFrom(await login());
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(`${base}/api/trainee/settings/avatar`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'image/png',
    },
    body: png,
  });
  assert.equal(upload.status, 200);
  assert.equal((await me(cookie)).status, 200);
  const avatar = await fetch(`${base}/api/trainee/settings/avatar`, {
    headers: { Cookie: cookie },
  });
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get('content-type'), 'image/png');
  const invalid = await fetch(`${base}/api/trainee/settings/avatar`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'image/png',
    },
    body: 'not an image',
  });
  assert.equal(invalid.status, 400);
  const remove = await fetch(`${base}/api/trainee/settings/avatar`, {
    method: 'DELETE',
    headers: { Cookie: cookie, Origin: env.clientUrl, 'X-KISTS-Request': '1' },
  });
  assert.equal(remove.status, 204);
  assert.equal(
    (
      await fetch(`${base}/api/trainee/settings/avatar`, {
        headers: { Cookie: cookie },
      })
    ).status,
    404,
  );
});

test('trainee password change verifies the current password and preserves policy', async () => {
  const cookie = cookieFrom(await login());
  const request = (currentPassword: string, newPassword: string) =>
    fetch(`${base}/api/trainee/settings/password`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: env.clientUrl,
        'X-KISTS-Request': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  assert.equal(
    (await request('incorrect-current-password', 'A-valid-new-password-123'))
      .status,
    400,
  );
  assert.equal((await request(password, 'short')).status, 400);
  const nextPassword = 'A-valid-new-password-123';
  assert.equal((await request(password, nextPassword)).status, 204);
  assert.equal((await login(traineeEmail)).status, 401);
  assert.equal(
    (await login(traineeEmail, { password: nextPassword })).status,
    200,
  );
});

test('administrator reuses persistent avatar and password settings with role-safe URLs', async () => {
  const cookie = cookieFrom(await login(adminEmail));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(`${base}/api/admin/settings/avatar`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'image/png',
    },
    body: png,
  });
  assert.equal(upload.status, 200);
  assert.match(
    ((await upload.json()) as { avatarUrl: string }).avatarUrl,
    /^\/api\/admin\/settings\/avatar\?v=\d+$/,
  );
  const current = await me(cookie);
  assert.equal(current.status, 200);
  assert.equal(
    ((await current.json()) as { user: AuthUser }).user.avatarUrl,
    '/api/admin/settings/avatar',
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/settings/avatar`, {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  const traineeCookie = cookieFrom(await login(emptyTraineeEmail));
  assert.equal(
    (
      await fetch(`${base}/api/admin/settings/avatar`, {
        headers: { Cookie: traineeCookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/settings/avatar`, {
        method: 'DELETE',
        headers: {
          Cookie: cookie,
          Origin: env.clientUrl,
          'X-KISTS-Request': '1',
        },
      })
    ).status,
    204,
  );
  const passwordAttempt = await fetch(`${base}/api/admin/settings/password`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'incorrect-current-password',
      newPassword: 'A-valid-new-password-123',
    }),
  });
  assert.equal(passwordAttempt.status, 400);
});

test('repeated failed login is rate-limited with a retry hint', async () => {
  let response: Response | undefined;
  for (let index = 0; index < 11; index++)
    response = await login('limited@example.invalid');
  assert.equal(response?.status, 429);
  assert.ok(response?.headers.get('retry-after'));
});
