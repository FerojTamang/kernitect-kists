import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { migrate, quotedSchema } from '../src/database/migrate.js';
import { assertLocalDevelopmentDatabase } from '../src/database/safety.js';
import { inTransaction } from '../src/database/transaction.js';
import { hashPassword } from '../src/modules/auth/auth.password.js';

const schema = `kists_test_${randomBytes(8).toString('hex')}`;
const database = new pg.Pool({
  connectionString: env.databaseUrl,
  options: `-c search_path=${schema},pg_catalog -c timezone=UTC`,
});

const password = randomBytes(24).toString('base64url');
const traineeEmail = 'support.trainee@example.invalid';
const otherTraineeEmail = 'support.other@example.invalid';
const adminEmail = 'support.admin@example.invalid';

let traineeId = 0;
let server: Server | undefined;
let base = '';
let schemaCreated = false;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);

  await inTransaction(database, async (client) => {
    await migrate(client, schema);

    await client.query(
      `INSERT INTO system_roles (name, description)
       VALUES ('trainee', 'Training learner'),
              ('administrator', 'System administrator')`,
    );
  });
  schemaCreated = true;

  const passwordHash = await hashPassword(password);

  traineeId = (
    await database.query<{ id: number }>(
      `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id)
       SELECT 'Support', 'Trainee', $1, $2, id
       FROM system_roles
       WHERE name = 'trainee'
       RETURNING id`,
      [traineeEmail, passwordHash],
    )
  ).rows[0]!.id;

  await database.query(
    `INSERT INTO users
      (first_name, last_name, email, password_hash, system_role_id)
     SELECT 'Other', 'Trainee', $1, $2, id
     FROM system_roles
     WHERE name = 'trainee'`,
    [otherTraineeEmail, passwordHash],
  );

  await database.query(
    `INSERT INTO users
      (first_name, last_name, email, password_hash, system_role_id)
     SELECT 'Support', 'Administrator', $1, $2, id
     FROM system_roles
     WHERE name = 'administrator'`,
    [adminEmail, passwordHash],
  );

  server = createApp(database).listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    if (schemaCreated)
      await database.query(`DROP SCHEMA ${quotedSchema(schema)} CASCADE`);
  } finally {
    await database.end();
  }
});

async function login(email: string) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: trustedHeaders(),
    body: JSON.stringify({ email, password }),
  });

  assert.equal(response.status, 200);

  return response.headers.get('set-cookie')!.split(';')[0]!;
}

function trustedHeaders(cookie?: string) {
  return {
    ...(cookie ? { Cookie: cookie } : {}),
    Origin: env.clientUrl,
    'X-KISTS-Request': '1',
    'Content-Type': 'application/json',
  };
}

test('support submission requires an authenticated trainee and trusted mutation', async () => {
  const anonymous = await fetch(`${base}/api/trainee/support/messages`, {
    method: 'POST',
    headers: trustedHeaders(),
    body: JSON.stringify({ issueType: 'technical_issue', message: 'Help' }),
  });

  assert.equal(anonymous.status, 401);

  const adminCookie = await login(adminEmail);

  const administrator = await fetch(
    `${base}/api/trainee/support/messages`,
    {
      method: 'POST',
      headers: trustedHeaders(adminCookie),
      body: JSON.stringify({
        issueType: 'technical_issue',
        message: 'Help',
      }),
    },
  );

  assert.equal(administrator.status, 403);

  const traineeCookie = await login(traineeEmail);

  const untrusted = await fetch(`${base}/api/trainee/support/messages`, {
    method: 'POST',
    headers: {
      Cookie: traineeCookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ issueType: 'technical_issue', message: 'Help' }),
  });

  assert.equal(untrusted.status, 403);
});

test('trainee support validation rejects invalid issue types and empty messages', async () => {
  const cookie = await login(traineeEmail);

  const invalidType = await fetch(
    `${base}/api/trainee/support/messages`,
    {
      method: 'POST',
      headers: trustedHeaders(cookie),
      body: JSON.stringify({ issueType: '', message: 'Help' }),
    },
  );

  assert.equal(invalidType.status, 400);

  const emptyMessage = await fetch(
    `${base}/api/trainee/support/messages`,
    {
      method: 'POST',
      headers: trustedHeaders(cookie),
      body: JSON.stringify({
        issueType: 'technical_issue',
        message: '   ',
      }),
    },
  );

  assert.equal(emptyMessage.status, 400);
});

test('trainee submission stores the authenticated session identity', async () => {
  const cookie = await login(traineeEmail);

  const response = await fetch(`${base}/api/trainee/support/messages`, {
    method: 'POST',
    headers: trustedHeaders(cookie),
    body: JSON.stringify({
      issueType: 'certificate_issue',
      message: '  My current certificate is not visible.  ',
      traineeId: 999999,
    }),
  });

  assert.equal(response.status, 201);

  const created = (await response.json()) as { id: number };

  const saved = await database.query<{
    traineeId: number;
    message: string;
  }>(
    `SELECT trainee_id AS "traineeId", message
     FROM support_messages
     WHERE id = $1`,
    [created.id],
  );

  assert.deepEqual(saved.rows[0], {
    traineeId,
    message: 'My current certificate is not visible.',
  });
});

test('administrator can list support messages while trainees cannot', async () => {
  const traineeCookie = await login(traineeEmail);

  const traineeResponse = await fetch(
    `${base}/api/admin/support/messages`,
    {
      headers: { Cookie: traineeCookie },
    },
  );

  assert.equal(traineeResponse.status, 403);

  const adminCookie = await login(adminEmail);

  const response = await fetch(`${base}/api/admin/support/messages`, {
    headers: { Cookie: adminCookie },
  });

  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    messages: Array<{
      traineeEmail: string;
      issueType: string;
      status: string;
    }>;
  };

  assert.deepEqual(body.messages[0], {
    ...body.messages[0],
    traineeEmail,
    issueType: 'certificate_issue',
    status: 'open',
  });
});

test('administrator can update support status and invalid status is rejected', async () => {
  const adminCookie = await login(adminEmail);

  const messageId = (
    await database.query<{ id: number }>(
      'SELECT id FROM support_messages LIMIT 1',
    )
  ).rows[0]!.id;

  const invalid = await fetch(
    `${base}/api/admin/support/messages/${messageId}/status`,
    {
      method: 'PATCH',
      headers: trustedHeaders(adminCookie),
      body: JSON.stringify({ status: 'resolved' }),
    },
  );

  assert.equal(invalid.status, 400);

  const updated = await fetch(
    `${base}/api/admin/support/messages/${messageId}/status`,
    {
      method: 'PATCH',
      headers: trustedHeaders(adminCookie),
      body: JSON.stringify({ status: 'in_progress' }),
    },
  );

  assert.equal(updated.status, 200);

  assert.equal(
    (
      await database.query<{ status: string }>(
        'SELECT status FROM support_messages WHERE id = $1',
        [messageId],
      )
    ).rows[0]!.status,
    'in_progress',
  );
});

test('support notifications persist, respect ownership and follow request and response events', async () => {
  const traineeCookie = await login(traineeEmail);
  const otherCookie = await login(otherTraineeEmail);
  const adminCookie = await login(adminEmail);

  const create = await fetch(`${base}/api/trainee/support/messages`, {
    method: 'POST',
    headers: trustedHeaders(traineeCookie),
    body: JSON.stringify({
      issueType: 'training_access',
      message: 'Please check my training access.',
    }),
  });

  assert.equal(create.status, 201);

  const { id } = (await create.json()) as { id: number };

  const adminNotifications = async () => {
    const response = await fetch(
      `${base}/api/admin/support/notifications`,
      { headers: { Cookie: adminCookie } },
    );

    assert.equal(response.status, 200);

    return response.json() as Promise<{
      unreadCount: number;
      notifications: Array<{ id: number }>;
    }>;
  };

  const traineeNotifications = async (cookie: string) => {
    const response = await fetch(
      `${base}/api/trainee/support/notifications`,
      { headers: { Cookie: cookie } },
    );

    assert.equal(response.status, 200);

    return response.json() as Promise<{
      unreadCount: number;
      notifications: Array<{ id: number; createdAt: string }>;
    }>;
  };

  const unreadAdmin = await adminNotifications();

  assert.ok(unreadAdmin.notifications.some((item) => item.id === id));
  assert.equal(unreadAdmin.unreadCount, unreadAdmin.notifications.length);
  assert.equal((await traineeNotifications(otherCookie)).unreadCount, 0);

  const forbiddenResponse = await fetch(
    `${base}/api/admin/support/messages/${id}/response`,
    {
      method: 'PATCH',
      headers: trustedHeaders(traineeCookie),
      body: JSON.stringify({ adminResponse: 'Not permitted' }),
    },
  );

  assert.equal(forbiddenResponse.status, 403);

  const forbiddenStatus = await fetch(
    `${base}/api/admin/support/messages/${id}/status`,
    {
      method: 'PATCH',
      headers: trustedHeaders(traineeCookie),
      body: JSON.stringify({ status: 'closed' }),
    },
  );

  assert.equal(forbiddenStatus.status, 403);

  const adminRead = await fetch(
    `${base}/api/admin/support/notifications/${id}/read`,
    {
      method: 'POST',
      headers: trustedHeaders(adminCookie),
      body: '{}',
    },
  );

  assert.equal(adminRead.status, 204);

  assert.equal(
    (await adminNotifications()).notifications.some(
      (item) => item.id === id,
    ),
    false,
  );

  const status = await fetch(
    `${base}/api/admin/support/messages/${id}/status`,
    {
      method: 'PATCH',
      headers: trustedHeaders(adminCookie),
      body: JSON.stringify({ status: 'in_progress' }),
    },
  );

  assert.equal(status.status, 200);

  assert.equal(
    (await adminNotifications()).notifications.some(
      (item) => item.id === id,
    ),
    false,
  );

  const saveResponse = (adminResponse: string) =>
    fetch(`${base}/api/admin/support/messages/${id}/response`, {
      method: 'PATCH',
      headers: trustedHeaders(adminCookie),
      body: JSON.stringify({ adminResponse }),
    });

  assert.equal(
    (await saveResponse('Your training access has been checked.')).status,
    200,
  );

  const own = await fetch(`${base}/api/trainee/support/messages`, {
    headers: { Cookie: traineeCookie },
  });

  assert.equal(own.status, 200);

  const ownMessages = (await own.json()) as {
    messages: Array<{ id: number; adminResponse: string | null }>;
  };

  assert.equal(
    ownMessages.messages.find((message) => message.id === id)?.adminResponse,
    'Your training access has been checked.',
  );

  const otherMessages = await fetch(
    `${base}/api/trainee/support/messages`,
    { headers: { Cookie: otherCookie } },
  );

  assert.equal(otherMessages.status, 200);

  assert.equal(
    (
      (await otherMessages.json()) as {
        messages: Array<{ id: number }>;
      }
    ).messages.some((message) => message.id === id),
    false,
  );

  const unreadTrainee = await traineeNotifications(traineeCookie);
  const notification = unreadTrainee.notifications.find(
    (item) => item.id === id,
  );

  assert.ok(notification);
  assert.equal((await traineeNotifications(otherCookie)).unreadCount, 0);

  const otherRead = await fetch(
    `${base}/api/trainee/support/notifications/${id}/read`,
    {
      method: 'POST',
      headers: trustedHeaders(otherCookie),
      body: JSON.stringify({ respondedAt: notification.createdAt }),
    },
  );

  assert.equal(otherRead.status, 404);

  const traineeRead = await fetch(
    `${base}/api/trainee/support/notifications/${id}/read`,
    {
      method: 'POST',
      headers: trustedHeaders(traineeCookie),
      body: JSON.stringify({ respondedAt: notification.createdAt }),
    },
  );

  assert.equal(traineeRead.status, 204);

  assert.equal(
    (await traineeNotifications(traineeCookie)).notifications.some(
      (item) => item.id === id,
    ),
    false,
  );

  assert.equal(
    (await saveResponse('A revised training access response.')).status,
    200,
  );

  assert.ok(
    (await traineeNotifications(traineeCookie)).notifications.some(
      (item) => item.id === id,
    ),
  );
});
