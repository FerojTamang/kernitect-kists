import { checkDatabaseConnection, pool } from '../config/database.js';

try {
  await checkDatabaseConnection();
  console.info('PostgreSQL connection successful.');
} catch {
  console.error(
    'PostgreSQL connection failed. Check DATABASE_URL and PostgreSQL availability.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
