import pg from 'pg';
import { readFileSync } from 'node:fs';
import { env } from './env.js';

// Use the Supabase CA certificate only for Supabase connections.
// Render provides the certificate as a secret file in production.
const databaseUrl = new URL(env.databaseUrl);
const isSupabase = databaseUrl.hostname.endsWith('.supabase.co');

const certificatePath =
  process.env.NODE_ENV === 'production'
    ? '/etc/secrets/prod-ca-2021.crt'
    : new URL('../../certs/prod-ca-2021.crt', import.meta.url);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ...(isSupabase
    ? {
        ssl: {
          ca: readFileSync(certificatePath, 'utf8'),
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
