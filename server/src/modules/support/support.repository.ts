import type { Pool } from 'pg';
import type { SupportIssueType, SupportStatus } from './support.types.js';

export interface SupportMessageRow {
  id: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  issueType: SupportIssueType;
  message: string;
  status: SupportStatus;
  createdAt: Date;
  updatedAt: Date;
  adminResponse: string | null;
  respondedAt: Date | null;
  respondedBy: number | null;
}

export interface SupportNotificationRow {
  id: number;
  issueType: SupportIssueType;
  createdAt: Date;
  traineeFirstName?: string;
  traineeLastName?: string;
}

export class SupportRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async create(
    traineeId: number,
    issueType: SupportIssueType,
    message: string,
  ) {
    const result = await this.database.query<{ id: number }>(
      `INSERT INTO support_messages (trainee_id, issue_type, message)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [traineeId, issueType, message],
    );
    return result.rows[0]!.id;
  }

  async list(): Promise<SupportMessageRow[]> {
    const result = await this.database.query<SupportMessageRow>(
      `SELECT message.id,
        trainee.id AS "traineeId",
        trainee.first_name AS "traineeFirstName",
        trainee.last_name AS "traineeLastName",
        trainee.email AS "traineeEmail",
        message.issue_type AS "issueType",
        message.message,
        message.status,
        message.created_at AS "createdAt",
        message.updated_at AS "updatedAt",
        message.admin_response AS "adminResponse",
        message.responded_at AS "respondedAt",
        message.responded_by AS "respondedBy"
       FROM support_messages message
       JOIN users trainee ON trainee.id = message.trainee_id
       ORDER BY message.created_at DESC, message.id DESC`,
    );
    return result.rows;
  }

  async listForTrainee(traineeId: number): Promise<SupportMessageRow[]> {
    const result = await this.database.query<SupportMessageRow>(
      `SELECT message.id,
        trainee.id AS "traineeId",
        trainee.first_name AS "traineeFirstName",
        trainee.last_name AS "traineeLastName",
        trainee.email AS "traineeEmail",
        message.issue_type AS "issueType",
        message.message,
        message.status,
        message.created_at AS "createdAt",
        message.updated_at AS "updatedAt",
        message.admin_response AS "adminResponse",
        message.responded_at AS "respondedAt",
        message.responded_by AS "respondedBy"
       FROM support_messages message
       JOIN users trainee ON trainee.id = message.trainee_id
       WHERE message.trainee_id = $1
       ORDER BY message.created_at DESC, message.id DESC`,
      [traineeId],
    );
    return result.rows;
  }

  async saveResponse(id: number, administratorId: number, response: string) {
    const result = await this.database.query<{ respondedAt: Date }>(
      `UPDATE support_messages
       SET admin_response = $3,
           responded_at = now(),
           responded_by = $2,
           trainee_response_seen_at = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING responded_at AS "respondedAt"`,
      [id, administratorId, response],
    );
    return result.rows[0];
  }

  async adminNotifications(): Promise<SupportNotificationRow[]> {
    const result = await this.database.query<SupportNotificationRow>(
      `SELECT message.id, message.issue_type AS "issueType",
         message.created_at AS "createdAt",
         trainee.first_name AS "traineeFirstName",
         trainee.last_name AS "traineeLastName"
       FROM support_messages message
       JOIN users trainee ON trainee.id = message.trainee_id
       WHERE message.admin_seen_at IS NULL
       ORDER BY message.created_at DESC, message.id DESC`,
    );
    return result.rows;
  }

  async traineeNotifications(
    traineeId: number,
  ): Promise<SupportNotificationRow[]> {
    const result = await this.database.query<SupportNotificationRow>(
      `SELECT id, issue_type AS "issueType", responded_at AS "createdAt"
       FROM support_messages
       WHERE trainee_id = $1 AND responded_at IS NOT NULL
         AND trainee_response_seen_at IS NULL
       ORDER BY responded_at DESC, id DESC`,
      [traineeId],
    );
    return result.rows;
  }

  async markAdminNotificationRead(id: number): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE support_messages SET admin_seen_at = COALESCE(admin_seen_at, now())
       WHERE id = $1`,
      [id],
    );
    return result.rowCount === 1;
  }

  async markTraineeNotificationRead(
    id: number,
    traineeId: number,
    respondedAt: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE support_messages
       SET trainee_response_seen_at = COALESCE(trainee_response_seen_at, now())
       WHERE id = $1 AND trainee_id = $2
         AND date_trunc('milliseconds', responded_at) = $3::timestamptz`,
      [id, traineeId, respondedAt],
    );
    return result.rowCount === 1;
  }

  async updateStatus(id: number, status: SupportStatus): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE support_messages
       SET status = $2, updated_at = now()
       WHERE id = $1`,
      [id, status],
    );
    return result.rowCount === 1;
  }
}
