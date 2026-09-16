import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import { inTransaction } from './transaction.js';
import { assertLocalDevelopmentDatabase } from './safety.js';

const command = process.argv[2];
try {
  if (!['migrate', 'seed', 'reset'].includes(command ?? ''))
    throw new Error('Use migrate, seed or reset.');
  if (command !== 'migrate') {
    const database = assertLocalDevelopmentDatabase(env.databaseUrl);
    if (
      command === 'reset' &&
      !process.argv.includes(`--confirm=${database}`)
    ) {
      throw new Error(
        `Reset deletes ONLY the kists schema and its data. Repeat with --confirm=${database} to reset and migrate (no automatic seed).`,
      );
    }
  }
  await inTransaction(pool, async (client) => {
    if (command === 'reset') {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('kists:migrations:kists'))",
      );
      await client.query('DROP SCHEMA IF EXISTS kists CASCADE');
    }
    if (command === 'seed') {
      // Require migrations explicitly; do not hide schema changes inside seeding.
      await seed(client);
      console.info('Development seed applied; demo accounts are disabled.');
    } else {
      const names = await migrate(client);
      console.info(
        names.length
          ? `Applied: ${names.join(', ')}`
          : 'Database migrations are up to date.',
      );
    }
  });
  console.info('Database transaction committed.');
} catch (error) {
  // PostgreSQL DETAIL can contain row data and password hashes; never print it.
  const isDatabaseError =
    typeof error === 'object' && error !== null && 'code' in error;
  console.error(
    isDatabaseError
      ? 'Database operation failed. Verify local connectivity and migration constraints; no partial transaction was committed.'
      : error instanceof Error
        ? error.message
        : 'Database operation failed.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
