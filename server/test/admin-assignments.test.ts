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
const adminEmail = 'admin.assignments@example.invalid';
const traineeEmail = 'admin.assignments.trainee@example.invalid';

let server: Server;
let base = '';
let traineeId = 0;
let schemaCreated = false;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);

  await inTransaction(database, async (client) => {
    await migrate(client, schema);
    await seed(client, schema);
  });
  schemaCreated = true;

  const passwordHash = await hashPassword(password);

  await database.query(
    `INSERT INTO users
      (first_name, last_name, email, password_hash, system_role_id, is_active)
     SELECT 'TEST', 'Assignment Administrator', $1, $2, r.id, true
     FROM system_roles r
     WHERE r.name = 'administrator'`,
    [adminEmail, passwordHash],
  );

  traineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id,
         job_role_id, is_active)
       SELECT 'TEST', 'Assignment Trainee', $1, $2, r.id, j.id, true
       FROM system_roles r
       CROSS JOIN job_roles j
       WHERE r.name = 'trainee'
         AND j.name = 'Warehouse Operative'
       RETURNING id`,
      [traineeEmail, passwordHash],
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

  if (schemaCreated)
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

test('training assignment management is administrator-only and mutations require trusted requests', async () => {
  assert.equal((await fetch(`${base}/api/admin/assignments`)).status, 401);

  const traineeCookie = await login(traineeEmail);
  assert.equal(
    (
      await fetch(`${base}/api/admin/assignments`, {
        headers: { Cookie: traineeCookie },
      })
    ).status,
    403,
  );

  const adminCookie = await login(adminEmail);
  const untrustedMutation = await fetch(`${base}/api/admin/assignments`, {
    method: 'POST',
    headers: {
      Cookie: adminCookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      traineeId,
      trainingModuleId: 1,
      required: true,
    }),
  });
  assert.equal(untrustedMutation.status, 403);
});

test('administrator can create required and optional assignments with progress state and duplicate protection', async () => {
  await database.query(
    `INSERT INTO training_modules (title, slug, description, is_active)
     VALUES ('Optional Test Training', 'optional-test-training', 'Active optional-assignment fixture.', true)`,
  );
  const adminCookie = await login(adminEmail);
  const headers = {
    Cookie: adminCookie,
    Origin: env.clientUrl,
    'X-KISTS-Request': '1',
    'Content-Type': 'application/json',
  };

  const initialResponse = await fetch(`${base}/api/admin/assignments`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(initialResponse.status, 200);
  assert.equal(initialResponse.headers.get('cache-control'), 'no-store');

  const initial = (await initialResponse.json()) as {
    trainees: Array<{ id: number; email: string }>;
    modules: Array<{ id: number; title: string; slug: string }>;
  };
  assert.ok(initial.trainees.some((trainee) => trainee.id === traineeId));

  const manualHandling = initial.modules.find(
    (module) => module.slug === 'manual-handling',
  );
  const optionalModule = initial.modules.find(
    (module) => module.slug === 'optional-test-training',
  );
  assert.ok(manualHandling);
  assert.ok(optionalModule);
  const forklift = initial.modules.find(
    (module) => module.slug === 'forklift-pedestrian-safety',
  );
  assert.ok(forklift);

  const required = await fetch(`${base}/api/admin/assignments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      traineeId,
      trainingModuleId: manualHandling.id,
      required: true,
    }),
  });
  assert.equal(required.status, 201);
  const requiredId = ((await required.json()) as { id: number }).id;

  const progress = await database.query<{
    percentage: string;
    completedAt: Date | null;
  }>(
    `SELECT percentage::text AS percentage, completed_at AS "completedAt"
     FROM progress
     WHERE training_assignment_id = $1`,
    [requiredId],
  );
  assert.equal(progress.rows.length, 1);
  assert.equal(Number(progress.rows[0]!.percentage), 0);
  assert.equal(progress.rows[0]!.completedAt, null);

  const duplicate = await fetch(`${base}/api/admin/assignments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      traineeId,
      trainingModuleId: manualHandling.id,
      required: false,
    }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(
    ((await duplicate.json()) as { error: { code: string } }).error.code,
    'ASSIGNMENT_EXISTS',
  );

  const optional = await fetch(`${base}/api/admin/assignments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      traineeId,
      trainingModuleId: optionalModule.id,
      required: false,
    }),
  });
  assert.equal(optional.status, 201);

  const forkliftAssignment = await fetch(`${base}/api/admin/assignments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      traineeId,
      trainingModuleId: forklift.id,
      required: true,
    }),
  });
  assert.equal(forkliftAssignment.status, 201);

  const list = await fetch(`${base}/api/admin/assignments`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(list.status, 200);
  const payload = (await list.json()) as {
    assignments: Array<{
      traineeId: number;
      traineeEmail: string;
      trainingModuleSlug: string;
      required: boolean;
      status: string;
      progressPercentage: number;
    }>;
  };

  const created = payload.assignments.filter(
    (assignment) => assignment.traineeId === traineeId,
  );
  assert.equal(created.length, 3);
  assert.deepEqual(
    created
      .map((assignment) => ({
        slug: assignment.trainingModuleSlug,
        required: assignment.required,
        status: assignment.status,
        progress: assignment.progressPercentage,
      }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
    [
      {
        slug: 'forklift-pedestrian-safety',
        required: true,
        status: 'active',
        progress: 0,
      },
      {
        slug: 'manual-handling',
        required: true,
        status: 'active',
        progress: 0,
      },
      {
        slug: 'optional-test-training',
        required: false,
        status: 'active',
        progress: 0,
      },
    ],
  );
});
