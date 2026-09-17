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

async function login(): Promise<string> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: env.clientUrl,
      'X-KISTS-Request': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: traineeEmail, password }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie || !cookie.startsWith('kists_session=')) {
    throw new Error('Login did not return a KISTS session cookie.');
  }
  return cookie;
}

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
