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

test('migrations create all 18 domain tables and rerun without changes', async () =>
  isolated(async (client) => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [schema],
    );
    assert.equal(tables.rowCount, 19); // 18 domain tables + migration ledger.
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
