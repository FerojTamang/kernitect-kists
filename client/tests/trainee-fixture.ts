import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { assertLocalDevelopmentDatabase } from '../../server/src/database/safety';

// A fresh account preserves the demo trainee's progress and the suite's 0% baseline.
export const trainee = `browser.${randomUUID()}@example.invalid`;
let pool: pg.Pool | undefined;
let userId: number | undefined;

export async function createTrainee() {
  const databaseUrl = process.env.DATABASE_URL!;
  assertLocalDevelopmentDatabase(databaseUrl);
  pool = new pg.Pool({
    connectionString: databaseUrl,
    options: '-c search_path=kists,pg_catalog',
  });
  const result = await pool.query<{ id: number }>(
    `INSERT INTO users (system_role_id, job_role_id, first_name, last_name, email, password_hash)
     SELECT system_role_id, job_role_id, first_name, last_name, $1, password_hash
     FROM users WHERE email = 'alex.morgan@example.invalid' RETURNING id`,
    [trainee],
  );
  userId = result.rows[0]?.id;
  if (!userId)
    throw new Error(
      'The local Alex demo account is required for browser tests.',
    );
  await pool.query(
    `INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by, required)
     SELECT $1, a.training_module_id, a.assigned_by, a.required FROM training_assignments a
     JOIN users u ON u.id = a.trainee_id WHERE u.email = 'alex.morgan@example.invalid' AND a.status = 'active'`,
    [userId],
  );
}

export async function removeTrainee() {
  if (!pool) return;
  try {
    if (userId !== undefined) {
      // Only records owned by the account created above; never reset demo data.
      await pool.query('DELETE FROM progress WHERE trainee_id = $1', [userId]);
      await pool.query(
        'DELETE FROM training_assignments WHERE trainee_id = $1',
        [userId],
      );
      await pool.query('DELETE FROM users WHERE id = $1 AND email = $2', [
        userId,
        trainee,
      ]);
    }
  } finally {
    await pool.end();
  }
}
