import type { Pool } from 'pg';

interface DashboardRow {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: 'trainee';
  jobRole: string | null;
  assignmentId: number;
  moduleId: number;
  title: string;
  description: string;
  required: boolean;
  assignedAt: Date;
  dueAt: Date | null;
  percentage: string;
  startedAt: Date | null;
  completedAt: Date | null;
  learningCompletedSections: string;
  learningTotalSections: string;
}

export class TraineeRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findDashboard(userId: number): Promise<DashboardRow[]> {
    const result = await this.database.query<DashboardRow>(
      `SELECT u.id AS "userId", u.first_name AS "firstName", u.last_name AS "lastName",
        u.email, r.name AS "systemRole", j.name AS "jobRole",
        a.id AS "assignmentId", m.id AS "moduleId", m.title, m.description,
        a.required, a.assigned_at AS "assignedAt", a.due_at AS "dueAt",
        COALESCE(p.percentage, 0)::text AS percentage,
        p.started_at AS "startedAt", p.completed_at AS "completedAt",
        (SELECT count(*) FROM training_content c
         WHERE c.training_module_id = m.id AND c.is_active
           AND EXISTS (
             SELECT 1 FROM training_content_completion cc
             WHERE cc.training_assignment_id = a.id AND cc.training_content_id = c.id
           ))::text AS "learningCompletedSections",
        (SELECT count(*) FROM training_content c
         WHERE c.training_module_id = m.id AND c.is_active)::text AS "learningTotalSections"
      FROM users u
      JOIN system_roles r ON r.id = u.system_role_id
      LEFT JOIN job_roles j ON j.id = u.job_role_id
      JOIN training_assignments a
        ON a.trainee_id = u.id AND a.status = 'active' AND a.required
      JOIN training_modules m ON m.id = a.training_module_id AND m.is_active
      LEFT JOIN progress p ON p.training_assignment_id = a.id
      WHERE u.id = $1 AND r.name = 'trainee' AND u.is_active
      ORDER BY a.assigned_at ASC, a.id ASC`,
      [userId],
    );
    return result.rows;
  }
}
