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
const adminEmail = 'admin.dashboard@example.invalid';
const traineeEmail = 'admin.dashboard.trainee@example.invalid';

let server: Server;
let base = '';

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);

  await inTransaction(database, async (client) => {
    await migrate(client, schema);
    await seed(client, schema);

    // This isolated integration test creates its own administrator/trainee.
    // Remove the disabled development seed accounts and their assignments so
    // dashboard totals are deterministic and describe only this test fixture.
    await client.query(
      `DELETE FROM progress
       WHERE trainee_id IN (
         SELECT id
         FROM users
         WHERE first_name = 'DEMO'
           AND NOT is_active
           AND lower(email) IN (
             'demo.trainee@example.invalid',
             'demo.administrator@example.invalid'
           )
       )`,
    );
    await client.query(
      `DELETE FROM training_assignments
       WHERE trainee_id IN (
         SELECT id
         FROM users
         WHERE first_name = 'DEMO'
           AND NOT is_active
           AND lower(email) = 'demo.trainee@example.invalid'
       )
       OR assigned_by IN (
         SELECT id
         FROM users
         WHERE first_name = 'DEMO'
           AND NOT is_active
           AND lower(email) = 'demo.administrator@example.invalid'
       )`,
    );
    await client.query(
      `DELETE FROM users
       WHERE first_name = 'DEMO'
         AND NOT is_active
         AND lower(email) IN (
           'demo.trainee@example.invalid',
           'demo.administrator@example.invalid'
         )`,
    );
  });

  const passwordHash = await hashPassword(password);

  const adminId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, is_active)
       SELECT 'TEST', 'Administrator', $1, $2, r.id, true
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
       SELECT 'TEST', 'Warehouse Trainee', $1, $2, r.id, j.id, true
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

  await database.query(
    `INSERT INTO training_assignments
      (trainee_id, training_module_id, assigned_by, required)
     VALUES ($1, $2, $3, true)`,
    [traineeId, manualModuleId, adminId],
  );

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

test('administrator dashboard is role-protected and reports database-backed workforce training data', async () => {
  const anonymous = await fetch(`${base}/api/admin/dashboard`);
  assert.equal(anonymous.status, 401);

  const traineeCookie = await login(traineeEmail);
  const forbidden = await fetch(`${base}/api/admin/dashboard`, {
    headers: { Cookie: traineeCookie },
  });
  assert.equal(forbidden.status, 403);

  const adminCookie = await login(adminEmail);
  const response = await fetch(`${base}/api/admin/dashboard`, {
    headers: { Cookie: adminCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const payload = (await response.json()) as {
    administrator: {
      firstName: string;
      lastName: string;
      email: string;
    };
    summary: {
      totalTrainees: number;
      activeTrainees: number;
      activeAssignments: number;
      completedAssignments: number;
      certificatesIssued: number;
      completionRate: number;
    };
    trainees: Array<{
      firstName: string;
      lastName: string;
      jobRole: string | null;
      assignedCount: number;
      completedCount: number;
      progressPercentage: number;
      certificateIssued: boolean;
    }>;
    modules: Array<{
      title: string;
      assignedCount: number;
      completedCount: number;
      averageProgress: number;
    }>;
  };

  assert.deepEqual(payload.administrator, {
    firstName: 'TEST',
    lastName: 'Administrator',
    email: adminEmail,
  });
  assert.equal(payload.summary.totalTrainees, 1);
  assert.equal(payload.summary.activeTrainees, 1);
  assert.equal(payload.summary.activeAssignments, 1);
  assert.equal(payload.summary.completedAssignments, 0);
  assert.equal(payload.summary.certificatesIssued, 0);
  assert.equal(payload.summary.completionRate, 0);

  assert.equal(payload.trainees.length, 1);
  assert.equal(payload.trainees[0]!.firstName, 'TEST');
  assert.equal(payload.trainees[0]!.lastName, 'Warehouse Trainee');
  assert.equal(payload.trainees[0]!.jobRole, 'Warehouse Operative');
  assert.equal(payload.trainees[0]!.assignedCount, 1);
  assert.equal(payload.trainees[0]!.completedCount, 0);
  assert.equal(payload.trainees[0]!.progressPercentage, 0);
  assert.equal(payload.trainees[0]!.certificateIssued, false);

  const manualHandling = payload.modules.find(
    (module) => module.title === 'Manual Handling',
  );
  assert.ok(manualHandling);
  assert.equal(manualHandling.assignedCount, 1);
  assert.equal(manualHandling.completedCount, 0);
  assert.equal(manualHandling.averageProgress, 0);
});

test('administrator can list, create, edit and deactivate trainee accounts without exposing password hashes', async () => {
  const adminCookie = await login(adminEmail);
  const headers = {
    Cookie: adminCookie,
    Origin: env.clientUrl,
    'X-KISTS-Request': '1',
    'Content-Type': 'application/json',
  };

  const list = await fetch(`${base}/api/admin/users`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(list.status, 200);
  const initial = (await list.json()) as {
    users: Array<Record<string, unknown>>;
    jobRoles: Array<{ id: number; name: string }>;
  };
  assert.equal(initial.users.length, 1);
  assert.equal('passwordHash' in initial.users[0]!, false);
  const supervisor = initial.jobRoles.find(
    (role) => role.name === 'Supervisor',
  );
  assert.ok(supervisor);

  const created = await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'New',
      lastName: 'Trainee',
      email: 'new.trainee@example.invalid',
      password: 'StrongPassword123!',
      jobRoleId: supervisor.id,
      isActive: true,
    }),
  });
  assert.equal(created.status, 201);
  const { id } = (await created.json()) as { id: number };

  const duplicate = await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Duplicate',
      lastName: 'Email',
      email: 'NEW.TRAINEE@example.invalid',
      password: 'StrongPassword123!',
      jobRoleId: null,
      isActive: true,
    }),
  });
  assert.equal(duplicate.status, 409);

  const updated = await fetch(`${base}/api/admin/users/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      firstName: 'Updated',
      lastName: 'Trainee',
      email: 'new.trainee@example.invalid',
      jobRoleId: null,
      isActive: false,
    }),
  });
  assert.equal(updated.status, 200);

  const after = await fetch(`${base}/api/admin/users`, {
    headers: { Cookie: adminCookie },
  });
  const payload = (await after.json()) as {
    summary: { inactive: number; unassignedJobRole: number };
    users: Array<{
      id: number;
      firstName: string;
      isActive: boolean;
      jobRole: string | null;
    }>;
  };
  const changed = payload.users.find((user) => user.id === id);
  assert.deepEqual(
    changed && {
      firstName: changed.firstName,
      isActive: changed.isActive,
      jobRole: changed.jobRole,
    },
    { firstName: 'Updated', isActive: false, jobRole: null },
  );
  assert.equal(payload.summary.inactive, 1);
  assert.equal(payload.summary.unassignedJobRole, 1);
});

test('trainee cannot access administrator user management and mutations require trusted requests', async () => {
  const traineeCookie = await login(traineeEmail);
  assert.equal(
    (
      await fetch(`${base}/api/admin/users`, {
        headers: { Cookie: traineeCookie },
      })
    ).status,
    403,
  );
  const adminCookie = await login(adminEmail);
  const response = await fetch(`${base}/api/admin/users`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 403);
});
