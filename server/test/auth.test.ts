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

test('valid trainee login returns only safe profile fields', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const body = (await response.json()) as { user: AuthUser };
  assert.equal(body.user.systemRole, 'trainee');
  assert.equal(body.user.jobRole, 'Warehouse Operative');
  assert.deepEqual(Object.keys(body.user).sort(), [
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
  assert.equal(body.assignedTraining[1]?.progressPercentage, 0);
  assert.equal(body.assignedTraining[1]?.status, 'not_started');
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
    }>;
    resumeSectionIndex: number;
  };
  assert.equal(body.assignmentId, assignmentId);
  assert.equal(body.moduleTitle, 'Manual Handling');
  assert.equal(body.status, 'in_progress');
  assert.equal(body.progress.assignmentPercentage, 60);
  assert.equal(body.progress.learningProgressPercentage, 0);
  assert.equal(body.progress.totalSections, 4);
  assert.deepEqual(
    body.sections.map((section) => section.title),
    [
      'Introduction',
      'Risks and Injuries',
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
  assert.equal(contentIds.length, 4);

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

  for (const [index, contentId] of contentIds.entries()) {
    const response = await completeTrainingContent(
      cookie,
      assignmentId,
      contentId,
    );
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
    assert.equal(body.progress.learningProgressPercentage, (index + 1) * 25);
    assert.equal(body.progress.completedSections, index + 1);
    assert.equal(body.progress.totalSections, 4);
    assert.equal(body.resumeSectionIndex, index < 3 ? index + 1 : 0);
    assert.ok(body.sections[index]!.completedAt);
  }

  const repeated = await completeTrainingContent(
    cookie,
    assignmentId,
    contentIds[3]!,
  );
  assert.equal(repeated.status, 200);
  assert.equal(
    (
      await database.query(
        'SELECT count(*)::integer AS count FROM training_content_completion WHERE training_assignment_id = $1',
        [assignmentId],
      )
    ).rows[0].count,
    4,
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

test('repeated failed login is rate-limited with a retry hint', async () => {
  let response: Response | undefined;
  for (let index = 0; index < 11; index++)
    response = await login('limited@example.invalid');
  assert.equal(response?.status, 429);
  assert.ok(response?.headers.get('retry-after'));
});
