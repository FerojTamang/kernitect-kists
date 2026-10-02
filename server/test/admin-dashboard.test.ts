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
      completionRate: number;
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
  assert.equal(manualHandling.completionRate, 0);
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
    trainingModules: Array<{ id: number; title: string }>;
  };
  assert.equal(initial.users.length, 1);
  assert.equal('passwordHash' in initial.users[0]!, false);
  assert.equal(initial.users[0]!.avatarUrl, null);
  assert.ok(Array.isArray(initial.users[0]!.requiredTrainingModuleIds));
  assert.ok(initial.trainingModules.length >= 1);
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
      requiredTrainingModuleIds: [initial.trainingModules[0]!.id],
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
      assignedCount: number;
      requiredTrainingModuleIds: number[];
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
  assert.deepEqual(changed?.requiredTrainingModuleIds, [
    initial.trainingModules[0]!.id,
  ]);
  assert.equal(changed?.assignedCount, 1);

  const removedRequirement = await fetch(`${base}/api/admin/users/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      firstName: 'Updated',
      lastName: 'Trainee',
      email: 'new.trainee@example.invalid',
      jobRoleId: null,
      isActive: false,
      requiredTrainingModuleIds: [],
    }),
  });
  assert.equal(removedRequirement.status, 200);
  const retained = await database.query<{
    required: boolean;
    status: string;
    progressCount: number;
  }>(
    `SELECT ta.required, ta.status,
      COUNT(p.id)::int AS "progressCount"
     FROM training_assignments ta
     LEFT JOIN progress p ON p.training_assignment_id = ta.id
     WHERE ta.trainee_id=$1 AND ta.training_module_id=$2
     GROUP BY ta.id`,
    [id, initial.trainingModules[0]!.id],
  );
  assert.deepEqual(retained.rows[0], {
    required: false,
    status: 'active',
    progressCount: 1,
  });
  const afterRemoval = (await (
    await fetch(`${base}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    })
  ).json()) as {
    users: Array<{
      id: number;
      assignedCount: number;
      requiredTrainingModuleIds: number[];
    }>;
  };
  const removedUser = afterRemoval.users.find((user) => user.id === id);
  assert.equal(removedUser?.assignedCount, 0);
  assert.deepEqual(removedUser?.requiredTrainingModuleIds, []);

  const readdedRequirement = await fetch(`${base}/api/admin/users/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      firstName: 'Updated',
      lastName: 'Trainee',
      email: 'new.trainee@example.invalid',
      jobRoleId: null,
      isActive: false,
      requiredTrainingModuleIds: [initial.trainingModules[0]!.id],
    }),
  });
  assert.equal(readdedRequirement.status, 200);
  const afterReadd = await database.query<{
    assignmentCount: number;
    requiredCount: number;
    progressCount: number;
  }>(
    `SELECT COUNT(DISTINCT ta.id)::int AS "assignmentCount",
      COUNT(DISTINCT ta.id) FILTER (
        WHERE ta.status='active' AND ta.required
      )::int AS "requiredCount",
      COUNT(DISTINCT p.id)::int AS "progressCount"
     FROM training_assignments ta
     LEFT JOIN progress p ON p.training_assignment_id = ta.id
     WHERE ta.trainee_id=$1 AND ta.training_module_id=$2`,
    [id, initial.trainingModules[0]!.id],
  );
  assert.deepEqual(afterReadd.rows[0], {
    assignmentCount: 1,
    requiredCount: 1,
    progressCount: 1,
  });
  assert.equal(payload.summary.inactive, 1);
  assert.equal(payload.summary.unassignedJobRole, 1);
});

test('administrator can manage module metadata and draft assessment questions safely', async () => {
  const adminCookie = await login(adminEmail);
  const headers = {
    Cookie: adminCookie,
    Origin: env.clientUrl,
    'X-KISTS-Request': '1',
    'Content-Type': 'application/json',
  };
  const libraryResponse = await fetch(`${base}/api/admin/training-content`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(libraryResponse.status, 200);
  const library = (await libraryResponse.json()) as {
    summary: { totalModules: number; assessmentQuestions: number };
    modules: Array<{ id: number; slug: string; questionCount: number }>;
  };
  assert.ok(library.summary.totalModules >= 2);
  assert.ok(library.summary.assessmentQuestions >= 10);
  const manual = library.modules.find(
    (module) => module.slug === 'manual-handling',
  );
  assert.ok(manual);

  const created = await fetch(`${base}/api/admin/training-content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'TEST Safe Loading',
      description: 'Draft authoring module.',
    }),
  });
  assert.equal(created.status, 201);
  const createdId = ((await created.json()) as { id: number }).id;
  const updated = await fetch(
    `${base}/api/admin/training-content/${createdId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title: 'TEST Safe Loading Updated',
        description: 'Updated metadata.',
        isActive: true,
      }),
    },
  );
  assert.equal(updated.status, 200);
  const createdDetail = await fetch(
    `${base}/api/admin/training-content/${createdId}`,
    { headers: { Cookie: adminCookie } },
  );
  assert.equal(createdDetail.status, 200);
  const savedModule = (await createdDetail.json()) as {
    title: string;
    description: string;
    isActive: boolean;
  };
  assert.equal(savedModule.title, 'TEST Safe Loading Updated');
  assert.equal(savedModule.description, 'Updated metadata.');
  assert.equal(savedModule.isActive, true);

  const detailResponse = await fetch(
    `${base}/api/admin/training-content/${manual.id}`,
    { headers: { Cookie: adminCookie } },
  );
  const detail = (await detailResponse.json()) as {
    assessments: Array<{ id: number }>;
  };
  const assessmentId = detail.assessments[0]!.id;
  const invalid = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionText: 'Invalid',
        options: [{ optionText: 'Only', isCorrect: true }],
      }),
    },
  );
  assert.equal(invalid.status, 400);
  const added = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionText: 'What is the safest choice?',
        options: [
          { optionText: 'Plan the lift', isCorrect: true },
          { optionText: 'Rush', isCorrect: false },
        ],
      }),
    },
  );
  assert.equal(added.status, 201);
  const questionId = ((await added.json()) as { id: number }).id;
  const edited = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions/${questionId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        questionText: 'What should happen before lifting?',
        options: [
          { optionText: 'Assess the load', isCorrect: true },
          { optionText: 'Lift immediately', isCorrect: false },
        ],
      }),
    },
  );
  assert.equal(edited.status, 200);
  const deleted = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions/${questionId}`,
    { method: 'DELETE', headers, body: '{}' },
  );
  assert.equal(deleted.status, 204);

  const protectedQuestion = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionText: 'Protected question',
        options: [
          { optionText: 'Correct', isCorrect: true },
          { optionText: 'Incorrect', isCorrect: false },
        ],
      }),
    },
  );
  assert.equal(protectedQuestion.status, 201);
  const protectedQuestionId = (
    (await protectedQuestion.json()) as { id: number }
  ).id;
  await database.query(
    `INSERT INTO assessment_attempts
      (trainee_id,training_assignment_id,training_module_id,assessment_id,pass_percentage_snapshot,attempt_number)
     SELECT ta.trainee_id,ta.id,ta.training_module_id,$1,a.pass_percentage,1
     FROM training_assignments ta JOIN assessments a ON a.id=$1
     WHERE ta.training_module_id=$2 LIMIT 1`,
    [assessmentId, manual.id],
  );
  const blocked = await fetch(
    `${base}/api/admin/training-content/${manual.id}/assessments/${assessmentId}/questions/${protectedQuestionId}`,
    {
      method: 'DELETE',
      headers,
      body: '{}',
    },
  );
  assert.equal(blocked.status, 409);
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

test('Add trainee optionally creates required assignments atomically', async () => {
  const adminCookie = await login(adminEmail);
  const headers = {
    Cookie: adminCookie,
    Origin: env.clientUrl,
    'X-KISTS-Request': '1',
    'Content-Type': 'application/json',
  };
  const usersResponse = await fetch(`${base}/api/admin/users`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(usersResponse.status, 200);
  const usersData = (await usersResponse.json()) as {
    trainingModules: Array<{ id: number; slug: string }>;
  };
  const manual = usersData.trainingModules.find(
    (module) => module.slug === 'manual-handling',
  );
  const forklift = usersData.trainingModules.find(
    (module) => module.slug === 'forklift-pedestrian-safety',
  );
  assert.ok(manual && forklift);
  const create = (email: string, requiredTrainingModuleIds: number[]) =>
    fetch(`${base}/api/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'New',
        lastName: 'Trainee',
        email,
        password: 'StrongPassword123!',
        jobRoleId: null,
        isActive: true,
        requiredTrainingModuleIds,
      }),
    });

  const empty = await create('no.training@example.invalid', []);
  assert.equal(empty.status, 201);
  const emptyId = ((await empty.json()) as { id: number }).id;
  assert.equal(
    (
      await database.query(
        'SELECT id FROM training_assignments WHERE trainee_id=$1',
        [emptyId],
      )
    ).rowCount,
    0,
  );

  const assigned = await create('assigned.training@example.invalid', [
    manual.id,
    forklift.id,
    manual.id,
  ]);
  assert.equal(assigned.status, 201);
  const assignedId = ((await assigned.json()) as { id: number }).id;
  const rows = await database.query<{
    trainingModuleId: number;
    assignedBy: number;
    required: boolean;
    progressId: number | null;
  }>(
    `SELECT ta.training_module_id AS "trainingModuleId",
       ta.assigned_by AS "assignedBy", ta.required,
       p.id AS "progressId"
     FROM training_assignments ta
     LEFT JOIN progress p ON p.training_assignment_id=ta.id
     WHERE ta.trainee_id=$1 ORDER BY ta.training_module_id`,
    [assignedId],
  );
  assert.deepEqual(
    rows.rows.map((row) => row.trainingModuleId),
    [manual.id, forklift.id].sort((a, b) => a - b),
  );
  assert.ok(rows.rows.every((row) => row.required && row.progressId !== null));
  const administrator = await database.query<{ id: number }>(
    'SELECT id FROM users WHERE email=$1',
    [adminEmail],
  );
  assert.ok(
    rows.rows.every((row) => row.assignedBy === administrator.rows[0]!.id),
  );
  const assignmentList = await fetch(`${base}/api/admin/assignments`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(assignmentList.status, 200);
  assert.equal(
    (
      (await assignmentList.json()) as {
        assignments: Array<{ traineeId: number }>;
      }
    ).assignments.filter((assignment) => assignment.traineeId === assignedId)
      .length,
    2,
  );

  const inactive = await database.query<{ id: number }>(
    `INSERT INTO training_modules (title, slug, description, is_active)
     VALUES ('Unavailable Training', 'unavailable-training', '', false) RETURNING id`,
  );
  const rejected = await create('partial.training@example.invalid', [
    manual.id,
    inactive.rows[0]!.id,
  ]);
  assert.equal(rejected.status, 400);
  assert.equal(
    (
      await database.query('SELECT id FROM users WHERE email=$1', [
        'partial.training@example.invalid',
      ])
    ).rowCount,
    0,
  );
});
