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

const schema = `kists_test_${randomBytes(8).toString('hex')}`;
const database = new pg.Pool({
  connectionString: env.databaseUrl,
  options: `-c search_path=${schema},pg_catalog -c timezone=UTC`,
});

const password = randomBytes(24).toString('base64url');
const adminEmail = 'admin.progress@example.invalid';
const traineeEmail = 'admin.progress.trainee@example.invalid';

let server: Server;
let base = '';
let assignmentId = 0;

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
       SELECT 'TEST', 'Progress Administrator', $1, $2, r.id, true
       FROM system_roles r
       WHERE r.name = 'administrator'
       RETURNING id`,
      [adminEmail, passwordHash],
    )
  ).rows[0]!.id;

  const traineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id,
         job_role_id, is_active)
       SELECT 'TEST', 'Progress Trainee', $1, $2, r.id, j.id, true
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

  await database.query(
    `INSERT INTO progress
      (trainee_id, training_module_id, training_assignment_id,
       percentage, started_at, last_accessed_at)
     VALUES ($1, $2, $3, 40, now() - interval '2 days', now())`,
    [traineeId, manualModuleId, assignmentId],
  );

  const firstContent = await database.query<{ id: number }>(
    `SELECT id
     FROM training_content
     WHERE training_module_id = $1 AND is_active
     ORDER BY sequence_order
     LIMIT 1`,
    [manualModuleId],
  );
  if (firstContent.rows[0]) {
    await database.query(
      `INSERT INTO training_content_completion
        (trainee_id, training_assignment_id, training_module_id,
         training_content_id)
       VALUES ($1, $2, $3, $4)`,
      [traineeId, assignmentId, manualModuleId, firstContent.rows[0].id],
    );
  }

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

async function login(email: string): Promise<string> {
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

test('administrator progress monitoring is role-protected and read-only', async () => {
  assert.equal((await fetch(`${base}/api/admin/progress`)).status, 401);

  const traineeCookie = await login(traineeEmail);
  assert.equal(
    (
      await fetch(`${base}/api/admin/progress`, {
        headers: { Cookie: traineeCookie },
      })
    ).status,
    403,
  );

  const adminCookie = await login(adminEmail);
  const response = await fetch(`${base}/api/admin/progress`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  // There is deliberately no mutation route for Phase 9D monitoring.
  assert.equal(
    (
      await fetch(`${base}/api/admin/progress`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          Origin: env.clientUrl,
          'X-KISTS-Request': '1',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    404,
  );
});

test('administrator can inspect assignment learning, scenario, assessment and certificate state', async () => {
  const adminCookie = await login(adminEmail);
  const response = await fetch(`${base}/api/admin/progress`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    summary: {
      activeAssignments: number;
      inProgressAssignments: number;
    };
    modules: Array<{ slug: string }>;
    records: Array<{
      assignmentId: number;
      traineeEmail: string;
      trainingModuleSlug: string;
      progressPercentage: number;
      learningCompleted: number;
      learningTotal: number;
      scenarioCompleted: number;
      scenarioTotal: number;
      assessmentTotal: number;
      assessmentAttempts: number;
      latestAssessmentScore: number | null;
      certificateIssued: boolean;
      certificateNumber: string | null;
    }>;
  };

  assert.ok(payload.summary.activeAssignments >= 1);
  assert.ok(payload.summary.inProgressAssignments >= 1);
  assert.ok(
    payload.modules.some((module) => module.slug === 'manual-handling'),
  );

  const record = payload.records.find(
    (candidate) => candidate.assignmentId === assignmentId,
  );
  assert.ok(record);
  assert.equal(record.traineeEmail, traineeEmail);
  assert.equal(record.trainingModuleSlug, 'manual-handling');
  assert.equal(record.progressPercentage, 40);
  assert.ok(record.learningTotal >= 1);
  assert.equal(record.learningCompleted, 1);
  assert.ok(record.scenarioTotal >= 1);
  assert.equal(record.scenarioCompleted, 0);
  assert.ok(record.assessmentTotal >= 1);
  assert.equal(record.assessmentAttempts, 0);
  assert.equal(record.latestAssessmentScore, null);
  assert.equal(record.certificateIssued, false);
  assert.equal(record.certificateNumber, null);
});
