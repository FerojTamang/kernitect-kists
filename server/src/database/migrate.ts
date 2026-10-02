import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';

export const databaseDirectory = new URL('../../../database/', import.meta.url);

export function quotedSchema(schema: string): string {
  if (!/^kists(?:_test_[a-f0-9]+)?$/.test(schema)) {
    throw new Error(
      'Only the kists schema or a generated kists_test_ schema is allowed.',
    );
  }
  return `"${schema}"`;
}

export async function setSearchPath(
  client: PoolClient,
  schema: string,
): Promise<void> {
  await client.query(
    `SET LOCAL search_path TO ${quotedSchema(schema)}, pg_catalog`,
  );
  await client.query("SET LOCAL TIME ZONE 'UTC'");
}

/** Caller owns the transaction: the complete batch either commits or rolls back. */
export async function migrate(
  client: PoolClient,
  schema = 'kists',
): Promise<string[]> {
  const directory = new URL('migrations/', databaseDirectory);
  const names = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (
    !names.length ||
    names.some((name) => !/^\d{3}[a-z]?_[a-z0-9_]+\.sql$/.test(name))
  ) {
    throw new Error(
      'Migration filenames must follow NNN_description.sql or NNNa_description.sql.',
    );
  }
  if (
    new Set(names.map((name) => name.match(/^\d{3}[a-z]?/)![0])).size !==
    names.length
  ) {
    throw new Error('Migration sequence numbers must be unique.');
  }
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `kists:migrations:${schema}`,
  ]);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema(schema)}`);
  await setSearchPath(client, schema);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = await client.query<{ name: string; checksum: string }>(
    'SELECT name, checksum FROM schema_migrations ORDER BY name',
  );
  // This one additive insertion precedes already-applied 016–024 migrations.
  // Accept only that exact historical gap; all recorded checksums remain checked.
  const withoutForkliftBootstrap = names.filter(
    (name) => name !== '015a_forklift_module_bootstrap.sql',
  );
  const matchesHistory = (expected: string[]) =>
    applied.rows.every((row, index) => row.name === expected[index]);
  if (!matchesHistory(names) && !matchesHistory(withoutForkliftBootstrap)) {
    throw new Error(
      'Applied migration history is missing, reordered or ahead of these files.',
    );
  }
  const completed: string[] = [];
  for (const name of names) {
    const sql = await readFile(new URL(name, directory), 'utf8');
    // Git may check files out with CRLF on Windows. Line endings are not a migration edit.
    const checksum = createHash('sha256')
      .update(sql.replace(/\r\n/g, '\n'))
      .digest('hex');
    const existing = applied.rows.find((row) => row.name === name);
    if (existing) {
      if (existing.checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
      [name, checksum],
    );
    completed.push(name);
  }
  return completed;
}
