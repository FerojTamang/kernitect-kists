import type { Pool } from 'pg';

interface SummaryRow {
  totalTrainees: number;
  activeTrainees: number;
  activeAssignments: number;
  completedAssignments: number;
  certificatesIssued: number;
}

interface TraineeRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
  assignedCount: number;
  completedCount: number;
  progressPercentage: string;
  latestAssessmentScore: string | null;
  latestAssessmentPassed: boolean | null;
  certificateIssued: boolean;
}

interface ModuleRow {
  id: number;
  title: string;
  slug: string;
  assignedCount: number;
  completedCount: number;
  averageProgress: string;
}

interface AssignmentRow {
  id: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  traineeJobRole: string | null;
  traineeIsActive: boolean;
  trainingModuleId: number;
  trainingModuleTitle: string;
  trainingModuleSlug: string;
  required: boolean;
  status: 'active' | 'cancelled';
  assignedAt: Date;
  dueAt: Date | null;
  assignedByFirstName: string;
  assignedByLastName: string;
  progressPercentage: string;
  completedAt: Date | null;
}

interface AssignmentTraineeRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
}

interface AssignmentModuleRow {
  id: number;
  title: string;
  slug: string;
  description: string;
}

interface ProgressRow {
  assignmentId: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  traineeJobRole: string | null;
  traineeIsActive: boolean;
  trainingModuleId: number;
  trainingModuleTitle: string;
  trainingModuleSlug: string;
  required: boolean;
  assignmentStatus: 'active' | 'cancelled';
  progressPercentage: string;
  startedAt: Date | null;
  completedAt: Date | null;
  lastAccessedAt: Date | null;
  learningCompleted: number;
  learningTotal: number;
  scenarioCompleted: number;
  scenarioTotal: number;
  assessmentTotal: number;
  assessmentPassed: number;
  assessmentAttempts: number;
  latestAssessmentAttemptNumber: number | null;
  latestAssessmentScore: string | null;
  latestAssessmentPassed: boolean | null;
  latestAssessmentSubmittedAt: Date | null;
  certificateNumber: string | null;
  certificateIssuedAt: Date | null;
}

export class AdminRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async summary(): Promise<SummaryRow> {
    const result = await this.database.query<SummaryRow>(
      `SELECT
        (
          SELECT COUNT(*)::int
          FROM users u
          JOIN system_roles r ON r.id = u.system_role_id
          WHERE r.name = 'trainee'
        ) AS "totalTrainees",
        (
          SELECT COUNT(*)::int
          FROM users u
          JOIN system_roles r ON r.id = u.system_role_id
          WHERE r.name = 'trainee'
            AND u.is_active
        ) AS "activeTrainees",
        (
          SELECT COUNT(*)::int
          FROM training_assignments ta
          WHERE ta.status = 'active'
        ) AS "activeAssignments",
        (
          SELECT COUNT(*)::int
          FROM training_assignments ta
          JOIN progress p
            ON p.training_assignment_id = ta.id
           AND p.completed_at IS NOT NULL
           AND p.percentage = 100
          WHERE ta.status = 'active'
        ) AS "completedAssignments",
        (
          SELECT COUNT(*)::int
          FROM certificates c
          WHERE c.status = 'issued'
        ) AS "certificatesIssued"`,
    );

    return result.rows[0]!;
  }

  async recentTrainees(limit = 6): Promise<TraineeRow[]> {
    const result = await this.database.query<TraineeRow>(
      `SELECT
        u.id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.email,
        j.name AS "jobRole",
        u.is_active AS "isActive",
        assignment_summary.assigned_count AS "assignedCount",
        assignment_summary.completed_count AS "completedCount",
        assignment_summary.progress_percentage::text AS "progressPercentage",
        latest_assessment.score_percentage::text AS "latestAssessmentScore",
        latest_assessment.passed AS "latestAssessmentPassed",
        EXISTS (
          SELECT 1
          FROM certificates c
          WHERE c.trainee_id = u.id
            AND c.status = 'issued'
        ) AS "certificateIssued"
      FROM users u
      JOIN system_roles r
        ON r.id = u.system_role_id
       AND r.name = 'trainee'
      LEFT JOIN job_roles j
        ON j.id = u.job_role_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS assigned_count,
          COUNT(*) FILTER (
            WHERE p.completed_at IS NOT NULL
              AND p.percentage = 100
          )::int AS completed_count,
          COALESCE(
            ROUND(AVG(COALESCE(p.percentage, 0)), 0),
            0
          ) AS progress_percentage
        FROM training_assignments ta
        LEFT JOIN progress p
          ON p.training_assignment_id = ta.id
        WHERE ta.trainee_id = u.id
          AND ta.status = 'active'
      ) assignment_summary ON true
      LEFT JOIN LATERAL (
        SELECT
          aa.score_percentage,
          aa.passed
        FROM assessment_attempts aa
        WHERE aa.trainee_id = u.id
          AND aa.submitted_at IS NOT NULL
        ORDER BY aa.submitted_at DESC, aa.id DESC
        LIMIT 1
      ) latest_assessment ON true
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $1`,
      [limit],
    );

    return result.rows;
  }

  async moduleOverview(limit = 4): Promise<ModuleRow[]> {
    const result = await this.database.query<ModuleRow>(
      `SELECT
        m.id,
        m.title,
        m.slug,
        COUNT(ta.id) FILTER (
          WHERE ta.status = 'active'
        )::int AS "assignedCount",
        COUNT(ta.id) FILTER (
          WHERE ta.status = 'active'
            AND p.completed_at IS NOT NULL
            AND p.percentage = 100
        )::int AS "completedCount",
        COALESCE(
          ROUND(
            AVG(COALESCE(p.percentage, 0)) FILTER (
              WHERE ta.status = 'active'
            ),
            0
          ),
          0
        )::text AS "averageProgress"
      FROM training_modules m
      LEFT JOIN training_assignments ta
        ON ta.training_module_id = m.id
      LEFT JOIN progress p
        ON p.training_assignment_id = ta.id
      WHERE m.is_active
      GROUP BY m.id, m.title, m.slug
      ORDER BY
        COUNT(ta.id) FILTER (WHERE ta.status = 'active') DESC,
        m.title ASC
      LIMIT $1`,
      [limit],
    );

    return result.rows;
  }

  async users() {
    const result = await this.database.query<{
      id: number; firstName: string; lastName: string; email: string;
      jobRoleId: number | null; jobRole: string | null; isActive: boolean;
      assignedCount: number; completedCount: number; progressPercentage: string;
    }>(`SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email,
      u.job_role_id AS "jobRoleId", j.name AS "jobRole", u.is_active AS "isActive",
      COUNT(ta.id) FILTER (WHERE ta.status = 'active')::int AS "assignedCount",
      COUNT(ta.id) FILTER (WHERE ta.status = 'active' AND p.completed_at IS NOT NULL AND p.percentage = 100)::int AS "completedCount",
      COALESCE(ROUND(AVG(COALESCE(p.percentage, 0)) FILTER (WHERE ta.status = 'active'), 0), 0)::text AS "progressPercentage"
      FROM users u
      JOIN system_roles r ON r.id = u.system_role_id AND r.name = 'trainee'
      LEFT JOIN job_roles j ON j.id = u.job_role_id
      LEFT JOIN training_assignments ta ON ta.trainee_id = u.id
      LEFT JOIN progress p ON p.training_assignment_id = ta.id
      GROUP BY u.id, j.name
      ORDER BY u.last_name, u.first_name, u.id`);
    return result.rows;
  }

  async jobRoles() {
    return (await this.database.query<{ id: number; name: string; description: string }>(
      `SELECT id, name, description FROM job_roles ORDER BY name`,
    )).rows;
  }

  async createTrainee(input: { firstName: string; lastName: string; email: string; passwordHash: string; jobRoleId: number | null; isActive: boolean }) {
    const result = await this.database.query<{ id: number }>(`INSERT INTO users
      (system_role_id, job_role_id, first_name, last_name, email, password_hash, is_active)
      SELECT r.id, $1, $2, $3, $4, $5, $6 FROM system_roles r WHERE r.name = 'trainee'
      RETURNING id`, [input.jobRoleId, input.firstName, input.lastName, input.email, input.passwordHash, input.isActive]);
    return result.rows[0]!.id;
  }

  async updateTrainee(id: number, input: { firstName: string; lastName: string; email: string; jobRoleId: number | null; isActive: boolean }) {
    const result = await this.database.query<{ id: number }>(`UPDATE users u SET
      first_name=$2, last_name=$3, email=$4, job_role_id=$5, is_active=$6, updated_at=now()
      FROM system_roles r WHERE u.id=$1 AND r.id=u.system_role_id AND r.name='trainee'
      RETURNING u.id`, [id, input.firstName, input.lastName, input.email, input.jobRoleId, input.isActive]);
    return result.rows.length > 0;
  }

  async jobRoleExists(id: number) {
    return (await this.database.query(`SELECT 1 FROM job_roles WHERE id=$1`, [id])).rowCount === 1;
  }

  async assignments(): Promise<AssignmentRow[]> {
    const result = await this.database.query<AssignmentRow>(
      `SELECT
        ta.id,
        trainee.id AS "traineeId",
        trainee.first_name AS "traineeFirstName",
        trainee.last_name AS "traineeLastName",
        trainee.email AS "traineeEmail",
        j.name AS "traineeJobRole",
        trainee.is_active AS "traineeIsActive",
        m.id AS "trainingModuleId",
        m.title AS "trainingModuleTitle",
        m.slug AS "trainingModuleSlug",
        ta.required,
        ta.status,
        ta.assigned_at AS "assignedAt",
        ta.due_at AS "dueAt",
        assigner.first_name AS "assignedByFirstName",
        assigner.last_name AS "assignedByLastName",
        COALESCE(p.percentage, 0)::text AS "progressPercentage",
        p.completed_at AS "completedAt"
      FROM training_assignments ta
      JOIN users trainee ON trainee.id = ta.trainee_id
      LEFT JOIN job_roles j ON j.id = trainee.job_role_id
      JOIN training_modules m ON m.id = ta.training_module_id
      JOIN users assigner ON assigner.id = ta.assigned_by
      LEFT JOIN progress p ON p.training_assignment_id = ta.id
      ORDER BY ta.assigned_at DESC, ta.id DESC`,
    );

    return result.rows;
  }

  async assignmentTrainees(): Promise<AssignmentTraineeRow[]> {
    const result = await this.database.query<AssignmentTraineeRow>(
      `SELECT
        u.id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.email,
        j.name AS "jobRole",
        u.is_active AS "isActive"
      FROM users u
      JOIN system_roles r
        ON r.id = u.system_role_id
       AND r.name = 'trainee'
      LEFT JOIN job_roles j ON j.id = u.job_role_id
      ORDER BY u.is_active DESC, u.last_name ASC, u.first_name ASC, u.id ASC`,
    );

    return result.rows;
  }

  async assignmentModules(): Promise<AssignmentModuleRow[]> {
    const result = await this.database.query<AssignmentModuleRow>(
      `SELECT id, title, slug, description
      FROM training_modules
      WHERE is_active
      ORDER BY title ASC, id ASC`,
    );

    return result.rows;
  }

  async traineeExistsForAssignment(id: number): Promise<boolean> {
    const result = await this.database.query(
      `SELECT 1
      FROM users u
      JOIN system_roles r ON r.id = u.system_role_id
      WHERE u.id = $1 AND r.name = 'trainee'`,
      [id],
    );
    return result.rowCount === 1;
  }

  async activeTrainingModuleExists(id: number): Promise<boolean> {
    const result = await this.database.query(
      `SELECT 1 FROM training_modules WHERE id = $1 AND is_active`,
      [id],
    );
    return result.rowCount === 1;
  }

  async createAssignment(input: {
    traineeId: number;
    trainingModuleId: number;
    assignedBy: number;
    required: boolean;
  }): Promise<number> {
    const result = await this.database.query<{ id: number }>(
      `WITH inserted_assignment AS (
        INSERT INTO training_assignments
          (trainee_id, training_module_id, assigned_by, required)
        VALUES ($1, $2, $3, $4)
        RETURNING id, trainee_id, training_module_id
      ), inserted_progress AS (
        INSERT INTO progress
          (trainee_id, training_module_id, training_assignment_id)
        SELECT trainee_id, training_module_id, id
        FROM inserted_assignment
        ON CONFLICT (training_assignment_id) DO NOTHING
        RETURNING training_assignment_id
      )
      SELECT id FROM inserted_assignment`,
      [
        input.traineeId,
        input.trainingModuleId,
        input.assignedBy,
        input.required,
      ],
    );

    return result.rows[0]!.id;
  }

  async progressRecords(): Promise<ProgressRow[]> {
    const result = await this.database.query<ProgressRow>(
      `SELECT
        ta.id AS "assignmentId",
        trainee.id AS "traineeId",
        trainee.first_name AS "traineeFirstName",
        trainee.last_name AS "traineeLastName",
        trainee.email AS "traineeEmail",
        j.name AS "traineeJobRole",
        trainee.is_active AS "traineeIsActive",
        m.id AS "trainingModuleId",
        m.title AS "trainingModuleTitle",
        m.slug AS "trainingModuleSlug",
        ta.required,
        ta.status AS "assignmentStatus",
        COALESCE(p.percentage, 0)::text AS "progressPercentage",
        p.started_at AS "startedAt",
        p.completed_at AS "completedAt",
        p.last_accessed_at AS "lastAccessedAt",
        learning.completed::int AS "learningCompleted",
        learning.total::int AS "learningTotal",
        scenario.completed::int AS "scenarioCompleted",
        scenario.total::int AS "scenarioTotal",
        assessment.total::int AS "assessmentTotal",
        assessment.passed::int AS "assessmentPassed",
        assessment.attempts::int AS "assessmentAttempts",
        latest_assessment.attempt_number AS "latestAssessmentAttemptNumber",
        latest_assessment.score_percentage::text AS "latestAssessmentScore",
        latest_assessment.passed AS "latestAssessmentPassed",
        latest_assessment.submitted_at AS "latestAssessmentSubmittedAt",
        current_certificate.certificate_number AS "certificateNumber",
        current_certificate.issued_at AS "certificateIssuedAt"
      FROM training_assignments ta
      JOIN users trainee ON trainee.id = ta.trainee_id
      LEFT JOIN job_roles j ON j.id = trainee.job_role_id
      JOIN training_modules m ON m.id = ta.training_module_id
      LEFT JOIN progress p ON p.training_assignment_id = ta.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(tc.id) FILTER (WHERE tc.is_active) AS total,
          COUNT(tcc.training_content_id) FILTER (WHERE tc.is_active) AS completed
        FROM training_content tc
        LEFT JOIN training_content_completion tcc
          ON tcc.training_content_id = tc.id
         AND tcc.training_assignment_id = ta.id
        WHERE tc.training_module_id = ta.training_module_id
      ) learning ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(s.id) FILTER (WHERE s.is_active) AS total,
          COUNT(sa.id) FILTER (
            WHERE s.is_active
              AND sa.completed_at IS NOT NULL
          ) AS completed
        FROM scenarios s
        LEFT JOIN scenario_attempts sa
          ON sa.scenario_id = s.id
         AND sa.training_assignment_id = ta.id
        WHERE s.training_module_id = ta.training_module_id
      ) scenario ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(a.id) FILTER (WHERE a.is_active) AS total,
          COUNT(a.id) FILTER (
            WHERE a.is_active
              AND EXISTS (
                SELECT 1
                FROM assessment_attempts passed_attempt
                WHERE passed_attempt.training_assignment_id = ta.id
                  AND passed_attempt.assessment_id = a.id
                  AND passed_attempt.submitted_at IS NOT NULL
                  AND passed_attempt.passed
              )
          ) AS passed,
          (
            SELECT COUNT(*)
            FROM assessment_attempts submitted_attempt
            JOIN assessments submitted_assessment
              ON submitted_assessment.id = submitted_attempt.assessment_id
             AND submitted_assessment.is_active
            WHERE submitted_attempt.training_assignment_id = ta.id
              AND submitted_attempt.submitted_at IS NOT NULL
          ) AS attempts
        FROM assessments a
        WHERE a.training_module_id = ta.training_module_id
      ) assessment ON true
      LEFT JOIN LATERAL (
        SELECT
          aa.attempt_number,
          aa.score_percentage,
          aa.passed,
          aa.submitted_at
        FROM assessment_attempts aa
        JOIN assessments a
          ON a.id = aa.assessment_id
         AND a.is_active
        WHERE aa.training_assignment_id = ta.id
          AND aa.submitted_at IS NOT NULL
        ORDER BY aa.submitted_at DESC, aa.id DESC
        LIMIT 1
      ) latest_assessment ON true
      LEFT JOIN LATERAL (
        SELECT c.certificate_number, c.issued_at
        FROM available_certificates c
        WHERE c.trainee_id = ta.trainee_id
        ORDER BY c.issued_at DESC, c.id DESC
        LIMIT 1
      ) current_certificate ON true
      ORDER BY
        CASE WHEN ta.status = 'active' THEN 0 ELSE 1 END,
        trainee.last_name ASC,
        trainee.first_name ASC,
        m.title ASC,
        ta.id ASC`,
    );

    return result.rows;
  }

}
