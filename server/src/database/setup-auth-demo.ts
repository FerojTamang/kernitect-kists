import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { hashPassword } from '../modules/auth/auth.password.js';
import { inTransaction } from './transaction.js';
import { assertLocalDevelopmentDatabase } from './safety.js';

try {
  assertLocalDevelopmentDatabase(env.databaseUrl);
  const password = process.env.KISTS_DEMO_PASSWORD;
  if (!password || password === 'change-me-for-local-development') {
    throw new Error(
      'Set a unique KISTS_DEMO_PASSWORD in ignored server/.env before running demo setup.',
    );
  }
  const passwordHash = await hashPassword(password);
  await inTransaction(pool, async (client) => {
    for (const account of [
      {
        email: 'alex.morgan@example.invalid',
        first: 'Alex',
        last: 'Morgan',
        role: 'trainee',
        job: 'Warehouse Operative',
      },
      {
        email: 'kists.administrator@example.invalid',
        first: 'KISTS',
        last: 'Administrator',
        role: 'administrator',
        job: null,
      },
    ]) {
      const existing = await client.query<{
        first_name: string;
        last_name: string;
        name: string;
      }>(
        `SELECT u.first_name, u.last_name, r.name FROM users u JOIN system_roles r ON r.id = u.system_role_id
        WHERE lower(u.email) = $1 FOR UPDATE OF u`,
        [account.email],
      );
      if (
        existing.rows.some(
          (row) =>
            row.first_name !== account.first ||
            row.last_name !== account.last ||
            row.name !== account.role,
        )
      ) {
        throw new Error(
          'A reserved auth-demo email belongs to another account. No changes committed.',
        );
      }
      const result = await client.query<{ id: number }>(
        `INSERT INTO users
        (first_name, last_name, email, password_hash, system_role_id, job_role_id, is_active)
        SELECT $1, $2, $3, $4, r.id, j.id, true FROM system_roles r
        LEFT JOIN job_roles j ON j.name = $6 WHERE r.name = $5 AND ($6::text IS NULL OR j.id IS NOT NULL)
        ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash,
          job_role_id = EXCLUDED.job_role_id, is_active = true RETURNING id`,
        [
          account.first,
          account.last,
          account.email,
          passwordHash,
          account.role,
          account.job,
        ],
      );
      if (!result.rows[0])
        throw new Error('Run migrations and db:seed before auth-demo setup.');
      await client.query(
        'UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE user_id = $1 AND revoked_at IS NULL',
        [result.rows[0].id],
      );
    }
    const trainee = await client.query<{ id: number }>(
      `SELECT u.id FROM users u JOIN system_roles r ON r.id = u.system_role_id
       WHERE lower(u.email) = 'alex.morgan@example.invalid' AND r.name = 'trainee'`,
    );
    const administrator = await client.query<{ id: number }>(
      `SELECT u.id FROM users u JOIN system_roles r ON r.id = u.system_role_id
       WHERE lower(u.email) = 'kists.administrator@example.invalid' AND r.name = 'administrator'`,
    );
    if (!trainee.rows[0] || !administrator.rows[0])
      throw new Error('Auth demo users were not created.');
    await client.query(
      `INSERT INTO training_assignments
        (trainee_id, training_module_id, assigned_by, required)
       SELECT $1, m.id, $2, true FROM training_modules m
       WHERE m.slug IN ('manual-handling', 'forklift-pedestrian-safety')
       ON CONFLICT (trainee_id, training_module_id) DO UPDATE SET
         status = 'active', required = EXCLUDED.required`,
      [trainee.rows[0].id, administrator.rows[0].id],
    );
    await client.query(
      `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id)
       SELECT trainee_id, training_module_id, id FROM training_assignments
       WHERE trainee_id = $1 AND status = 'active'
       ON CONFLICT (training_assignment_id) DO NOTHING`,
      [trainee.rows[0].id],
    );
    await client.query(
      `DELETE FROM training_content_completion
       WHERE training_assignment_id IN (
         SELECT a.id FROM training_assignments a
         JOIN training_modules m ON m.id = a.training_module_id
         WHERE a.trainee_id = $1 AND m.slug = 'manual-handling'
       )`,
      [trainee.rows[0].id],
    );
    await client.query(
      `UPDATE progress p SET percentage = 60,
        started_at = COALESCE(p.started_at, clock_timestamp() - interval '45 minutes'),
        last_accessed_at = clock_timestamp(), completed_at = NULL
       FROM training_assignments a JOIN training_modules m ON m.id = a.training_module_id
       WHERE p.training_assignment_id = a.id AND a.trainee_id = $1
         AND m.slug = 'manual-handling'`,
      [trainee.rows[0].id],
    );
  });
  console.info(
    'Fictional local login accounts configured: alex.morgan@example.invalid and kists.administrator@example.invalid. Passwords were not printed.',
  );
} catch (error) {
  console.error(
    error instanceof Error && !('code' in error)
      ? error.message
      : 'Demo setup failed. Check local configuration and run migrations/seed first.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
