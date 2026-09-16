import type { Pool } from 'pg';
import type { AuthUser, Credentials } from './auth.types.js';

export class AuthRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findCredentials(email: string): Promise<Credentials | undefined> {
    return (
      await this.database.query<Credentials>(
        `SELECT id, password_hash AS "passwordHash", is_active AS "isActive"
      FROM users WHERE lower(email) = $1`,
        [email],
      )
    ).rows[0];
  }

  async createSession(
    userId: number,
    verifiedHash: string,
    tokenHash: string,
    lifetimeSeconds: number,
    previousTokenHash: string | null,
  ): Promise<boolean> {
    // Recheck credentials under a row lock; account/password changes cannot race login.
    const result = await this.database.query(
      `WITH eligible AS (
      SELECT id FROM users WHERE id = $1 AND is_active AND password_hash = $2 FOR SHARE
    ), revoked AS (
      UPDATE auth_sessions SET revoked_at = clock_timestamp()
      WHERE token_hash = $5 AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM eligible)
    ) INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      SELECT id, $3, now() + ($4 * interval '1 second') FROM eligible RETURNING id`,
      [userId, verifiedHash, tokenHash, lifetimeSeconds, previousTokenHash],
    );
    return result.rowCount === 1;
  }

  async findSessionUser(tokenHash: string): Promise<AuthUser | undefined> {
    return (
      await this.database.query<AuthUser>(
        `UPDATE auth_sessions s SET last_used_at = clock_timestamp()
      FROM users u JOIN system_roles r ON r.id = u.system_role_id
      LEFT JOIN job_roles j ON j.id = u.job_role_id
      WHERE s.user_id = u.id AND s.token_hash = $1 AND s.revoked_at IS NULL
        AND s.expires_at > clock_timestamp() AND u.is_active
        AND r.name IN ('trainee', 'administrator')
      RETURNING u.id, u.first_name AS "firstName", u.last_name AS "lastName",
        u.email, r.name AS "systemRole", j.name AS "jobRole"`,
        [tokenHash],
      )
    ).rows[0];
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.database.query(
      'UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash],
    );
  }
}
