import type { Pool } from 'pg';

export class SettingsRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}
  async account(userId: number) {
    return (await this.database.query<{ passwordHash: string; avatarFilename: string | null }>(
      `SELECT password_hash AS "passwordHash", avatar_filename AS "avatarFilename" FROM users WHERE id=$1`, [userId],
    )).rows[0];
  }
  async updatePassword(userId: number, passwordHash: string) {
    await this.database.query('UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1', [userId, passwordHash]);
  }
  async updateAvatar(userId: number, filename: string | null) {
    const row = (await this.database.query<{ avatarFilename: string | null }>(
      `UPDATE users SET avatar_filename=$2, updated_at=now() WHERE id=$1 RETURNING avatar_filename AS "avatarFilename"`, [userId, filename],
    )).rows[0];
    return row?.avatarFilename ?? null;
  }
}
