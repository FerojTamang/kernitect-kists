import { randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PoolClient } from 'pg';
import { databaseDirectory, setSearchPath } from './migrate.js';

/** No usable demo password is retained. Authentication is deliberately not implemented. */
export function unusableDemoHash(): string {
  const salt = randomBytes(16);
  const hash = scryptSync(randomBytes(32), salt, 64);
  return `scrypt$N=16384,r=8,p=1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function seed(
  client: PoolClient,
  schema = 'kists',
): Promise<void> {
  await setSearchPath(client, schema);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `kists:seed:${schema}`,
  ]);
  await client.query(
    await readFile(new URL('seeds/development.sql', databaseDirectory), 'utf8'),
  );
  for (const role of ['administrator', 'trainee']) {
    await client.query(
      `INSERT INTO users
      (system_role_id, job_role_id, first_name, last_name, email, password_hash, is_active)
      SELECT r.id, CASE WHEN r.name = 'trainee' THEN j.id ELSE NULL END,
        'DEMO', $1, $2, $3, false
      FROM system_roles r CROSS JOIN job_roles j
      WHERE r.name = $4 AND j.name = 'Warehouse Operative'
      ON CONFLICT (lower(email)) DO NOTHING`,
      [
        role === 'trainee' ? 'Trainee' : 'Administrator',
        `demo.${role}@example.invalid`,
        unusableDemoHash(),
        role,
      ],
    );
  }
  const demoUsers = await client.query<{
    id: number;
    name: string;
  }>(`SELECT u.id, r.name
    FROM users u JOIN system_roles r ON r.id = u.system_role_id
    WHERE u.first_name = 'DEMO' AND NOT u.is_active
      AND lower(u.email) = 'demo.' || r.name || '@example.invalid'`);
  const trainee = demoUsers.rows.find((row) => row.name === 'trainee');
  const admin = demoUsers.rows.find((row) => row.name === 'administrator');
  if (!trainee || !admin)
    throw new Error(
      'Demo account identifiers are already used by non-demo or active accounts. Seed rolled back.',
    );
  await client.query(
    `INSERT INTO training_assignments (trainee_id, training_module_id, assigned_by, required)
    SELECT $1, id, $2, slug = 'manual-handling' FROM training_modules
    WHERE slug IN ('manual-handling', 'forklift-pedestrian-safety')
    ON CONFLICT (trainee_id, training_module_id) DO NOTHING`,
    [trainee.id, admin.id],
  );
  await client.query(
    `INSERT INTO progress (trainee_id, training_module_id, training_assignment_id)
    SELECT trainee_id, training_module_id, id FROM training_assignments WHERE trainee_id = $1
    ON CONFLICT (training_assignment_id) DO NOTHING`,
    [trainee.id],
  );
}
