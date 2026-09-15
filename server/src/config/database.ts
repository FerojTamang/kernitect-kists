import pg from 'pg';
import { env } from './env.js';

// Connections are opened lazily. Repositories will use this pool for parameterized SQL.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', () => {
  // Do not log connection strings, credentials or database error details.
  console.error('An idle PostgreSQL connection encountered an error.');
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
