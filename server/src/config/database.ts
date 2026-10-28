import pg from 'pg';
import { readFileSync } from 'node:fs';
import { env } from './env.js';

// Use the Supabase CA certificate only for Supabase connections.
// Local PostgreSQL continues using its existing connection settings.
const databaseUrl = new URL(env.databaseUrl);
const isSupabase = databaseUrl.hostname.endsWith('.supabase.co');

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ...(isSupabase
    ? {
        ssl: {
          ca: readFileSync(
            new URL('../../certs/prod-ca-2021.crt', import.meta.url),
            'utf8',
          ),
          rejectUnauthorized: true,
        },
      }
    : {}),
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  options: '-c search_path=kists,pg_catalog -c timezone=UTC',
});

pool.on('error', () => {
  console.error('An idle PostgreSQL connection encountered an error.');
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
