import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before } from 'node:test';
import type { PoolClient } from 'pg';
import { pool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import {
  migrate,
  quotedSchema,
  setSearchPath,
} from '../../src/database/migrate.js';
import { seed, unusableDemoHash } from '../../src/database/seed.js';
import { assertLocalDevelopmentDatabase } from '../../src/database/safety.js';
import { inTransaction } from '../../src/database/transaction.js';

const schema = `kists_test_${randomBytes(10).toString('hex')}`;
let created = false;

before(async () => {
  assertLocalDevelopmentDatabase(env.databaseUrl);
  await inTransaction(pool, async (client) => {
    const applied = await migrate(client, schema);
    assert.equal(applied.length, 4);
    await seed(client, schema);
  });
  created = true;
});

after(async () => {
  try {
    if (created)
      await pool.query(`DROP SCHEMA ${quotedSchema(schema)} CASCADE`);
  } finally {
    await pool.end();
  }
});

async function isolated(
  action: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setSearchPath(client, schema);
    await action(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function rejectsSql(
  client: PoolClient,
  sql: string,
  params: unknown[],
  code: string,
): Promise<void> {
  await client.query('SAVEPOINT invalid_input');
  await assert.rejects(
    client.query(sql, params),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code,
  );
  await client.query('ROLLBACK TO SAVEPOINT invalid_input');
  await client.query('RELEASE SAVEPOINT invalid_input');
}

async function fixture(client: PoolClient) {
  const trainee = (
    await client.query<{ id: number }>(
      `INSERT INTO users
    (system_role_id, job_role_id, first_name, last_name, email, password_hash)
    SELECT r.id, j.id, 'TEST', 'Trainee', 'test.trainee@example.invalid', $1
    FROM system_roles r CROSS JOIN job_roles j
    WHERE r.name = 'trainee' AND j.name = 'Warehouse Operative' RETURNING id`,
      [unusableDemoHash()],
    )
  ).rows[0]!.id;
  const admin = (
    await client.query<{ id: number }>(
      "SELECT id FROM users WHERE email = 'demo.administrator@example.invalid'",
    )
  ).rows[0]!.id;
  const manual = (
    await client.query<{ id: number }>(
      "SELECT id FROM training_modules WHERE slug = 'manual-handling'",
    )
  ).rows[0]!.id;
  const forklift = (
    await client.query<{ id: number }>(
      "SELECT id FROM training_modules WHERE slug = 'forklift-pedestrian-safety'",
    )
  ).rows[0]!.id;
  const assessment = (
    await client.query<{ id: number }>(
      'SELECT id FROM assessments WHERE training_module_id = $1 ORDER BY sequence_order',
      [manual],
    )
  ).rows[0]!.id;
  return { trainee, admin, manual, forklift, assessment };
}

async function assign(
  client: PoolClient,
  trainee: number,
  module: number,
  admin: number,
  required = true,
): Promise<number> {
  return (
    await client.query<{ id: number }>(
      `INSERT INTO training_assignments
    (trainee_id, training_module_id, assigned_by, required) VALUES ($1, $2, $3, $4) RETURNING id`,
      [trainee, module, admin, required],
    )
  ).rows[0]!.id;
}

async function complete(client: PoolClient, assignment: number): Promise<void> {
  await client.query(
    `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id,
    percentage, started_at, completed_at, last_accessed_at)
    SELECT trainee_id, training_module_id, id, 100, now() - interval '1 hour', now(), now()
    FROM training_assignments WHERE id = $1`,
    [assignment],
  );
}

async function attempt(
  client: PoolClient,
  assignment: number,
  assessment: number,
  score?: number,
  number = 1,
): Promise<number> {
  return (
    await client.query<{ id: number }>(
      `INSERT INTO assessment_attempts
    (trainee_id, training_assignment_id, training_module_id, assessment_id, attempt_number,
     started_at, submitted_at, score_percentage)
    SELECT trainee_id, id, training_module_id, $2, $3, now() - interval '10 minutes',
      CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() END, $4
    FROM training_assignments WHERE id = $1 RETURNING id`,
      [assignment, assessment, number, score ?? null],
    )
  ).rows[0]!.id;
}

export {
  schema,
  isolated,
  rejectsSql,
  fixture,
  assign,
  complete,
  attempt,
  migrate,
  seed,
  quotedSchema,
  assertLocalDevelopmentDatabase,
};
