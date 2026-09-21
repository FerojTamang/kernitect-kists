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
import { AssessmentRepository } from '../src/modules/assessments/assessment.repository.js';
import { hashPassword } from '../src/modules/auth/auth.password.js';

const schema = `kists_test_${randomBytes(10).toString('hex')}`;
const database = new pg.Pool({
  connectionString: env.databaseUrl,
  options: `-c search_path=${schema},pg_catalog -c timezone=UTC`,
});
const password = randomBytes(24).toString('base64url');
const traineeEmail = 'certificate.trainee@example.invalid';

let server: Server;
let base = '';
let traineeId = 0;
let assignmentId = 0;
let manualModuleId = 0;
let assessmentId = 0;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);
  await inTransaction(database, async (client) => {
    await migrate(client, schema);
    await seed(client, schema);
  });

  const passwordHash = await hashPassword(password);
  const adminId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, is_active)
       SELECT 'TEST', 'Administrator', 'certificate.admin@example.invalid',
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
       SELECT 'TEST', 'Certificate Trainee', $1, $2, r.id, j.id, true
       FROM system_roles r
       CROSS JOIN job_roles j
       WHERE r.name = 'trainee'
         AND j.name = 'Warehouse Operative'
       RETURNING id`,
      [traineeEmail, passwordHash],
    )
  ).rows[0]!.id;

  manualModuleId = (
    await database.query<{ id: number }>(
      `SELECT id FROM training_modules WHERE slug = 'manual-handling'`,
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
      `SELECT id FROM assessments
       WHERE training_module_id = $1 AND is_active
       ORDER BY sequence_order LIMIT 1`,
      [manualModuleId],
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
  await database.query(`DROP SCHEMA ${quotedSchema(schema)} CASCADE`);
  await database.end();
});

async function login(email = traineeEmail): Promise<string> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie || !cookie.startsWith('kists_session=')) {
    throw new Error('Login did not return a KISTS session cookie.');
  }
  return cookie;
}

async function completeActiveScenarios(assignmentId: number): Promise<void> {
  await database.query(
    `INSERT INTO scenario_attempts (
      trainee_id, training_assignment_id, training_module_id, scenario_id,
      started_at, completed_at
    )
    SELECT ta.trainee_id, ta.id, ta.training_module_id, s.id,
      clock_timestamp() - interval '10 minutes', clock_timestamp()
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
    [assignmentId],
  );
}

test('admin requirement removal issues one certificate for a previously blocked eligible trainee', async () => {
  const passwordHash = await hashPassword(password);
  const edgeTraineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, job_role_id, is_active)
       SELECT 'Alex', 'Edge', 'alex.edge@example.invalid', $1, r.id, j.id, true
       FROM system_roles r CROSS JOIN job_roles j
       WHERE r.name='trainee' AND j.name='Warehouse Operative'
       RETURNING id`,
      [passwordHash],
    )
  ).rows[0]!.id;
  const administratorId = (
    await database.query<{ id: number }>(
      `SELECT u.id FROM users u JOIN system_roles r ON r.id=u.system_role_id
       WHERE u.email='certificate.admin@example.invalid' AND r.name='administrator'`,
    )
  ).rows[0]!.id;
  const modules = await database.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM training_modules
     WHERE slug IN ('manual-handling', 'forklift-pedestrian-safety')`,
  );
  const edgeManualId = modules.rows.find((module) => module.slug === 'manual-handling')!.id;
  const edgeForkliftId = modules.rows.find((module) => module.slug === 'forklift-pedestrian-safety')!.id;
  const edgeAssignments = await database.query<{ id: number; trainingModuleId: number }>(
    `INSERT INTO training_assignments
      (trainee_id, training_module_id, assigned_by, required)
     VALUES ($1,$2,$4,true),($1,$3,$4,true)
     RETURNING id, training_module_id AS "trainingModuleId"`,
    [edgeTraineeId, edgeManualId, edgeForkliftId, administratorId],
  );
  const edgeManualAssignment = edgeAssignments.rows.find(
    (assignment) => assignment.trainingModuleId === edgeManualId,
  )!.id;
  await database.query(
    `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id)
     SELECT trainee_id, training_module_id, id FROM training_assignments
     WHERE trainee_id=$1`,
    [edgeTraineeId],
  );
  const correctAnswers = (
    await database.query<{ questionId: number; optionId: number }>(
      `SELECT q.id AS "questionId", ao.id AS "optionId"
       FROM questions q
       JOIN answer_options ao ON ao.question_id=q.id AND ao.is_correct
       WHERE q.assessment_id=$1 ORDER BY q.sequence_order, ao.sequence_order`,
      [assessmentId],
    )
  ).rows;
  await completeActiveScenarios(edgeManualAssignment);

  const passed = await new AssessmentRepository(database).submitAssessment(
    edgeTraineeId,
    edgeManualAssignment,
    assessmentId,
    correctAnswers,
  );
  assert.ok(passed?.attempt.passed);
  assert.equal(
    (await database.query('SELECT id FROM certificates WHERE trainee_id=$1', [edgeTraineeId])).rowCount,
    0,
  );

  const adminCookie = await login('certificate.admin@example.invalid');
  const update = await fetch(`${base}/api/admin/users/${edgeTraineeId}`, {
    method: 'PATCH',
    headers: {
      Cookie: adminCookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName: 'Alex',
      lastName: 'Edge',
      email: 'alex.edge@example.invalid',
      jobRoleId: null,
      isActive: true,
      requiredTrainingModuleIds: [edgeManualId],
    }),
  });
  assert.equal(update.status, 200);
  const issued = await database.query<{ certificateNumber: string; issuedAt: Date }>(
    `SELECT certificate_number AS "certificateNumber", issued_at AS "issuedAt"
     FROM certificates WHERE trainee_id=$1 AND status='issued'`,
    [edgeTraineeId],
  );
  assert.equal(issued.rowCount, 1);

  const repeat = await fetch(`${base}/api/admin/users/${edgeTraineeId}`, {
    method: 'PATCH',
    headers: {
      Cookie: adminCookie,
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName: 'Alex', lastName: 'Edge', email: 'alex.edge@example.invalid',
      jobRoleId: null, isActive: true, requiredTrainingModuleIds: [edgeManualId],
    }),
  });
  assert.equal(repeat.status, 200);
  const unchanged = await database.query<{ certificateNumber: string; issuedAt: Date }>(
    `SELECT certificate_number AS "certificateNumber", issued_at AS "issuedAt"
     FROM certificates WHERE trainee_id=$1 AND status='issued'`,
    [edgeTraineeId],
  );
  assert.deepEqual(unchanged.rows, issued.rows);
});

test('passing the final required assessment automatically issues and exposes a current digital certificate', async () => {
  const cookie = await login();

  const beforeResponse = await fetch(`${base}/api/trainee/certificates`, {
    headers: { Cookie: cookie },
  });
  assert.equal(beforeResponse.status, 200);
  const before = (await beforeResponse.json()) as {
    eligible: boolean;
    certificate: unknown;
  };
  assert.equal(before.eligible, false);
  assert.equal(before.certificate, null);

  const correctAnswers = (
    await database.query<{ questionId: number; optionId: number }>(
      `SELECT q.id AS "questionId", ao.id AS "optionId"
       FROM questions q
       JOIN answer_options ao ON ao.question_id = q.id AND ao.is_correct
       WHERE q.assessment_id = $1
       ORDER BY q.sequence_order, ao.sequence_order`,
      [assessmentId],
    )
  ).rows;
  assert.equal(correctAnswers.length, 10);

  await completeActiveScenarios(assignmentId);

  const result = await new AssessmentRepository(database).submitAssessment(
    traineeId,
    assignmentId,
    assessmentId,
    correctAnswers,
  );
  assert.ok(result?.attempt.passed);

  const issued = await database.query<{
    id: number;
    certificateNumber: string;
  }>(
    `SELECT id, certificate_number AS "certificateNumber"
     FROM certificates
     WHERE trainee_id = $1 AND status = 'issued'`,
    [traineeId],
  );
  assert.equal(issued.rowCount, 1);
  assert.match(issued.rows[0]!.certificateNumber, /^KISTS-\d{8}-[A-F0-9]{12}$/);

  const response = await fetch(`${base}/api/trainee/certificates`, {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const payload = (await response.json()) as {
    eligible: boolean;
    certificate: {
      id: number;
      certificateNumber: string;
      traineeName: string;
      status: string;
      training: Array<{
        assignmentId: number;
        moduleTitle: string;
        assessments: Array<{
          title: string;
          scorePercentage: number;
          passPercentage: number;
        }>;
      }>;
    };
  };

  assert.equal(payload.eligible, true);
  assert.equal(payload.certificate.id, issued.rows[0]!.id);
  assert.equal(payload.certificate.traineeName, 'TEST Certificate Trainee');
  assert.equal(payload.certificate.status, 'issued');
  assert.equal(payload.certificate.training.length, 1);
  assert.equal(payload.certificate.training[0]!.assignmentId, assignmentId);
  assert.equal(payload.certificate.training[0]!.moduleTitle, 'Manual Handling');
  assert.equal(payload.certificate.training[0]!.assessments.length, 1);
  assert.equal(
    payload.certificate.training[0]!.assessments[0]!.title,
    'Manual Handling Final Assessment',
  );
  assert.equal(
    payload.certificate.training[0]!.assessments[0]!.scorePercentage,
    100,
  );
  assert.equal(
    payload.certificate.training[0]!.assessments[0]!.passPercentage,
    75,
  );

  const evidence = await database.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM certificate_assignments
     WHERE certificate_id = $1`,
    [payload.certificate.id],
  );
  assert.equal(evidence.rows[0]!.count, 1);

  const reloaded = await fetch(`${base}/api/trainee/certificates`, {
    headers: { Cookie: cookie },
  });
  assert.equal(reloaded.status, 200);
  assert.equal(
    ((await reloaded.json()) as { certificate: { id: number } }).certificate.id,
    payload.certificate.id,
  );
});
