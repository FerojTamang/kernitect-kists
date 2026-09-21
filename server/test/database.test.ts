import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  schema,
  isolated,
  migrate,
  seed,
  quotedSchema,
  assertLocalDevelopmentDatabase,
} from './helpers/database.js';

test('migrations create all 24 domain tables and rerun without changes', async () =>
  isolated(async (client) => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [schema],
    );
    assert.equal(tables.rowCount, 25); // 24 domain tables + migration ledger.
    assert.deepEqual(await migrate(client, schema), []);
  }));

test('migration checksums reject edits to applied history', async () =>
  isolated(async (client) => {
    await client.query(
      "UPDATE schema_migrations SET checksum = 'changed' WHERE name = '001_core_tables.sql'",
    );
    await assert.rejects(migrate(client, schema), /Applied migration changed/);
  }));

test('development seed is repeatable and preserves disabled account hashes', async () =>
  isolated(async (client) => {
    const beforeUsers = await client.query(
      'SELECT id, password_hash, is_active FROM users ORDER BY id',
    );
    await seed(client, schema);
    await seed(client, schema);
    assert.deepEqual(
      (
        await client.query(
          'SELECT id, password_hash, is_active FROM users ORDER BY id',
        )
      ).rows,
      beforeUsers.rows,
    );
    assert.ok(
      beforeUsers.rows.every(
        (row) =>
          row.is_active === false &&
          String(row.password_hash).startsWith('scrypt$'),
      ),
    );
    assert.equal(
      (await client.query('SELECT * FROM training_assignments')).rowCount,
      2,
    );
    const scenario = await client.query<{
      isActive: boolean;
      resourceReference: string;
      hazards: number;
    }>(
      `SELECT s.is_active AS "isActive", s.resource_reference AS "resourceReference",
        count(h.id)::int AS hazards
       FROM scenarios s
       JOIN training_modules m ON m.id = s.training_module_id
       LEFT JOIN hazards h ON h.scenario_id = s.id
       WHERE m.slug = 'manual-handling' AND s.sequence_order = 1
       GROUP BY s.id`,
    );
    assert.equal(scenario.rows[0]?.isActive, true);
    assert.equal(
      scenario.rows[0]?.resourceReference,
      'asset://scenarios/manual-handling/manual-handling-warehouse.jpg',
    );
    assert.equal(scenario.rows[0]?.hazards, 5);
  }));

test('Forklift awareness module is active with learning and assessment but no scenario', async () =>
  isolated(async (client) => {
    const result = await client.query<{
      isActive: boolean;
      sections: number;
      scenarios: number;
      questions: number;
      passPercentage: string;
    }>(
      `SELECT m.is_active AS "isActive",
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_active)::int AS sections,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active)::int AS scenarios,
        COUNT(DISTINCT q.id)::int AS questions,
        MIN(a.pass_percentage)::text AS "passPercentage"
       FROM training_modules m
       LEFT JOIN training_content c ON c.training_module_id=m.id
       LEFT JOIN scenarios s ON s.training_module_id=m.id
       LEFT JOIN assessments a ON a.training_module_id=m.id AND a.is_active
       LEFT JOIN questions q ON q.assessment_id=a.id
       WHERE m.slug='forklift-pedestrian-safety'
       GROUP BY m.id`,
    );
    assert.deepEqual(result.rows[0], {
      isActive: true,
      sections: 8,
      scenarios: 0,
      questions: 10,
      passPercentage: '75.00',
    });
  }));

test('seed and reset safety checks reject remote and unrelated databases', () => {
  assert.throws(() =>
    assertLocalDevelopmentDatabase(
      'postgresql://demo:demo@remote.invalid/kists_dev',
    ),
  );
  assert.throws(() =>
    assertLocalDevelopmentDatabase(
      'postgresql://demo:demo@localhost/customer_data',
    ),
  );
  assert.equal(
    assertLocalDevelopmentDatabase(
      'postgresql://demo:demo@127.0.0.1/kists_test',
    ),
    'kists_test',
  );
  assert.throws(() => quotedSchema('public'));
});
