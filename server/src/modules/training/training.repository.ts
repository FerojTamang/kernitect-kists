import type { Pool } from 'pg';
import type { TrainingSection } from './training.types.js';

interface TrainingModuleRow {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  percentage: string;
  startedAt: Date | null;
  assignmentCompletedAt: Date | null;
  lastAccessedAt: Date | null;
  sectionId: number | null;
  title: string | null;
  contentType: TrainingSection['contentType'] | null;
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number | null;
  isActive: boolean | null;
  contentCompletedAt: Date | null;
}

export class TrainingRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findAssignmentDetail(
    userId: number,
    assignmentId: number,
  ): Promise<TrainingModuleRow[]> {
    const result = await this.database.query<TrainingModuleRow>(
      `SELECT a.id AS "assignmentId", m.id AS "moduleId", m.title AS "moduleTitle",
        COALESCE(p.percentage, 0)::text AS percentage,
        p.started_at AS "startedAt", p.completed_at AS "assignmentCompletedAt",
        p.last_accessed_at AS "lastAccessedAt",
        c.id AS "sectionId", c.title, c.content_type AS "contentType",
        c.body, c.resource_reference AS "resourceReference",
        c.sequence_order AS "sequenceOrder", c.is_active AS "isActive",
        cc.completed_at AS "contentCompletedAt"
      FROM training_assignments a
      JOIN training_modules m ON m.id = a.training_module_id
      LEFT JOIN progress p ON p.training_assignment_id = a.id
      LEFT JOIN training_content c ON c.training_module_id = m.id AND c.is_active
      LEFT JOIN training_content_completion cc
        ON cc.training_assignment_id = a.id AND cc.training_content_id = c.id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND m.slug = 'manual-handling'
      ORDER BY c.sequence_order ASC, c.id ASC`,
      [assignmentId, userId],
    );
    return result.rows;
  }

  async touchProgress(userId: number, assignmentId: number): Promise<void> {
    await this.database.query(
      `UPDATE progress p
      SET started_at = COALESCE(p.started_at, clock_timestamp()),
          last_accessed_at = clock_timestamp(),
          updated_at = clock_timestamp()
      FROM training_assignments a
      WHERE a.id = p.training_assignment_id AND a.id = $1 AND a.trainee_id = $2
        AND a.status = 'active'`,
      [assignmentId, userId],
    );
  }

  async completeContent(
    userId: number,
    assignmentId: number,
    contentId: number,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO training_content_completion
        (trainee_id, training_assignment_id, training_module_id, training_content_id)
      SELECT a.trainee_id, a.id, a.training_module_id, c.id
      FROM training_assignments a
      JOIN training_content c ON c.training_module_id = a.training_module_id
      WHERE a.id = $1 AND a.trainee_id = $2 AND a.status = 'active'
        AND c.id = $3 AND c.is_active
      ON CONFLICT (training_assignment_id, training_content_id) DO NOTHING`,
      [assignmentId, userId, contentId],
    );
  }
}
