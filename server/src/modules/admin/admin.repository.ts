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
          FROM available_certificates c
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
        )::int AS "completedCount"
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
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      jobRoleId: number | null;
      jobRole: string | null;
      isActive: boolean;
      assignedCount: number;
      completedCount: number;
      progressPercentage: string;
      avatarUrl: string | null;
      requiredTrainingModuleIds: number[];
    }>(`SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email,
      u.job_role_id AS "jobRoleId", j.name AS "jobRole", u.is_active AS "isActive",
      CASE WHEN u.avatar_filename IS NULL THEN NULL ELSE '/api/admin/users/' || u.id || '/avatar' END AS "avatarUrl",
      COUNT(ta.id) FILTER (WHERE ta.status = 'active' AND ta.required)::int AS "assignedCount",
      COUNT(ta.id) FILTER (WHERE ta.status = 'active' AND ta.required AND p.completed_at IS NOT NULL AND p.percentage = 100)::int AS "completedCount",
      COALESCE(ROUND(AVG(COALESCE(p.percentage, 0)) FILTER (WHERE ta.status = 'active' AND ta.required), 0), 0)::text AS "progressPercentage",
      COALESCE(array_agg(ta.training_module_id ORDER BY ta.training_module_id)
        FILTER (WHERE ta.status = 'active' AND ta.required), '{}')::int[] AS "requiredTrainingModuleIds"
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
    return (
      await this.database.query<{
        id: number;
        name: string;
        description: string;
      }>(`SELECT id, name, description FROM job_roles ORDER BY name`)
    ).rows;
  }

  async createTrainee(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    jobRoleId: number | null;
    isActive: boolean;
  }) {
    const result = await this.database.query<{ id: number }>(
      `INSERT INTO users
      (system_role_id, job_role_id, first_name, last_name, email, password_hash, is_active)
      SELECT r.id, $1, $2, $3, $4, $5, $6 FROM system_roles r WHERE r.name = 'trainee'
      RETURNING id`,
      [
        input.jobRoleId,
        input.firstName,
        input.lastName,
        input.email,
        input.passwordHash,
        input.isActive,
      ],
    );
    return result.rows[0]!.id;
  }

  async createTraineeWithAssignments(
    input: {
      firstName: string;
      lastName: string;
      email: string;
      passwordHash: string;
      jobRoleId: number | null;
      isActive: boolean;
    },
    requiredTrainingModuleIds: number[],
    assignedBy: number,
  ): Promise<number | null> {
    // One statement makes account, assignments and progress all-or-nothing.
    const result = await this.database.query<{ id: number }>(
      `WITH selected_modules AS (
        SELECT m.id FROM training_modules m
        WHERE m.is_active AND m.id = ANY($8::int[])
      ), created_user AS (
        INSERT INTO users
          (system_role_id, job_role_id, first_name, last_name, email, password_hash, is_active)
        SELECT r.id, $1, $2, $3, $4, $5, $6
        FROM system_roles r WHERE r.name = 'trainee'
          AND (SELECT COUNT(*) FROM selected_modules) = cardinality($8::int[])
        RETURNING id
      ), inserted_assignments AS (
        INSERT INTO training_assignments
          (trainee_id, training_module_id, assigned_by, required, status)
        SELECT created_user.id, selected_modules.id, $7, true, 'active'
        FROM created_user CROSS JOIN selected_modules
        RETURNING id, trainee_id, training_module_id
      ), inserted_progress AS (
        INSERT INTO progress
          (trainee_id, training_module_id, training_assignment_id)
        SELECT trainee_id, training_module_id, id FROM inserted_assignments
        RETURNING id
      )
      SELECT id FROM created_user`,
      [
        input.jobRoleId,
        input.firstName,
        input.lastName,
        input.email,
        input.passwordHash,
        input.isActive,
        assignedBy,
        requiredTrainingModuleIds,
      ],
    );
    return result.rows[0]?.id ?? null;
  }

  async updateTrainee(
    id: number,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      jobRoleId: number | null;
      isActive: boolean;
    },
  ) {
    const result = await this.database.query<{ id: number }>(
      `UPDATE users u SET
      first_name=$2, last_name=$3, email=$4, job_role_id=$5, is_active=$6, updated_at=now()
      FROM system_roles r WHERE u.id=$1 AND r.id=u.system_role_id AND r.name='trainee'
      RETURNING u.id`,
      [
        id,
        input.firstName,
        input.lastName,
        input.email,
        input.jobRoleId,
        input.isActive,
      ],
    );
    return result.rows.length > 0;
  }

  async updateTraineeWithRequirements(
    id: number,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      jobRoleId: number | null;
      isActive: boolean;
    },
    requiredTrainingModuleIds: number[],
    assignedBy: number,
  ) {
    const result = await this.database.query<{ id: number }>(
      `WITH updated_user AS (
        UPDATE users u SET first_name=$2, last_name=$3, email=$4, job_role_id=$5,
          is_active=$6, updated_at=now()
        FROM system_roles r
        WHERE u.id=$1 AND r.id=u.system_role_id AND r.name='trainee'
        RETURNING u.id
      ), selected_modules AS (
        SELECT unnest($7::int[]) AS module_id
      ), upserted_assignments AS (
        INSERT INTO training_assignments
          (trainee_id, training_module_id, assigned_by, required, status)
        SELECT updated_user.id, selected_modules.module_id, $8, true, 'active'
        FROM updated_user CROSS JOIN selected_modules
        ON CONFLICT (trainee_id, training_module_id) DO UPDATE
          SET required=true, status='active', updated_at=now()
        RETURNING id, trainee_id, training_module_id
      ), inserted_progress AS (
        INSERT INTO progress (trainee_id, training_module_id, training_assignment_id)
        SELECT trainee_id, training_module_id, id FROM upserted_assignments
        ON CONFLICT (training_assignment_id) DO NOTHING
      ), demoted_requirements AS (
        UPDATE training_assignments ta SET required=false, updated_at=now()
        WHERE ta.trainee_id IN (SELECT id FROM updated_user)
          AND ta.status='active' AND ta.required
          AND NOT (ta.training_module_id = ANY($7::int[]))
      )
      SELECT id FROM updated_user`,
      [
        id,
        input.firstName,
        input.lastName,
        input.email,
        input.jobRoleId,
        input.isActive,
        requiredTrainingModuleIds,
        assignedBy,
      ],
    );
    return result.rows.length > 0;
  }

  async activeTrainingModuleCount(ids: number[]) {
    return Number(
      (
        await this.database.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM training_modules WHERE is_active AND id = ANY($1::int[])`,
          [ids],
        )
      ).rows[0]?.count ?? 0,
    );
  }

  async jobRoleExists(id: number) {
    return (
      (await this.database.query(`SELECT 1 FROM job_roles WHERE id=$1`, [id]))
        .rowCount === 1
    );
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

  async trainingLibrary() {
    return (
      await this.database.query<{
        id: number;
        title: string;
        slug: string;
        description: string;
        isActive: boolean;
        learningSectionCount: number;
        scenarioCount: number;
        hazardCount: number;
        assessmentCount: number;
        questionCount: number;
        passPercentage: string | null;
        activeAssignmentCount: number;
      }>(`SELECT m.id,m.title,m.slug,m.description,m.is_active AS "isActive",
      COUNT(DISTINCT c.id) FILTER (WHERE c.is_active)::int AS "learningSectionCount",
      COUNT(DISTINCT s.id)::int AS "scenarioCount",COUNT(DISTINCT h.id)::int AS "hazardCount",
      COUNT(DISTINCT a.id)::int AS "assessmentCount",COUNT(DISTINCT q.id)::int AS "questionCount",
      MIN(a.pass_percentage)::text AS "passPercentage",
      COUNT(DISTINCT ta.id) FILTER (WHERE ta.status='active')::int AS "activeAssignmentCount"
      FROM training_modules m LEFT JOIN training_content c ON c.training_module_id=m.id
      LEFT JOIN scenarios s ON s.training_module_id=m.id LEFT JOIN hazards h ON h.scenario_id=s.id
      LEFT JOIN LATERAL (
        SELECT id,pass_percentage FROM assessments
        WHERE training_module_id=m.id AND is_active
        ORDER BY sequence_order ASC LIMIT 1
      ) a ON true LEFT JOIN questions q ON q.assessment_id=a.id
      LEFT JOIN training_assignments ta ON ta.training_module_id=m.id
      GROUP BY m.id ORDER BY m.created_at,m.id`)
    ).rows;
  }

  async trainingModule(id: number) {
    return (
      await this.database.query<{
        id: number;
        title: string;
        slug: string;
        description: string;
        isActive: boolean;
      }>(
        `SELECT id,title,slug,description,is_active AS "isActive" FROM training_modules WHERE id=$1`,
        [id],
      )
    ).rows[0];
  }
  async learningSections(moduleId: number) {
    return (
      await this.database.query<{
        id: number;
        title: string;
        contentType: string;
        sequenceOrder: number;
        isActive: boolean;
      }>(
        `SELECT id,title,content_type AS "contentType",sequence_order AS "sequenceOrder",is_active AS "isActive"
       FROM training_content WHERE training_module_id=$1 ORDER BY sequence_order,id`,
        [moduleId],
      )
    ).rows;
  }
  async moduleScenarios(moduleId: number) {
    return (
      await this.database.query<{
        id: number;
        title: string;
        description: string;
        isActive: boolean;
        sequenceOrder: number;
        hazardCount: number;
      }>(
        `SELECT s.id,s.title,s.description,s.is_active AS "isActive",s.sequence_order AS "sequenceOrder",
       COUNT(h.id)::int AS "hazardCount" FROM scenarios s LEFT JOIN hazards h ON h.scenario_id=s.id
       WHERE s.training_module_id=$1 GROUP BY s.id ORDER BY s.sequence_order,s.id`,
        [moduleId],
      )
    ).rows;
  }
  async moduleAssessments(moduleId: number) {
    return (
      await this.database.query<{
        id: number;
        title: string;
        description: string;
        passPercentage: string;
        isActive: boolean;
        hasAttempts: boolean;
      }>(
        `SELECT a.id,a.title,a.description,a.pass_percentage::text AS "passPercentage",a.is_active AS "isActive",
       EXISTS(SELECT 1 FROM assessment_attempts aa WHERE aa.assessment_id=a.id) AS "hasAttempts"
       FROM assessments a WHERE a.training_module_id=$1 ORDER BY a.sequence_order,a.id`,
        [moduleId],
      )
    ).rows;
  }
  async assessmentQuestions(assessmentIds: number[]) {
    if (!assessmentIds.length) return [];
    return (
      await this.database.query<{
        assessmentId: number;
        questionId: number;
        questionText: string;
        questionOrder: number;
        optionId: number;
        optionText: string;
        isCorrect: boolean;
        optionOrder: number;
      }>(
        `SELECT q.assessment_id AS "assessmentId",q.id AS "questionId",q.question_text AS "questionText",
       q.sequence_order AS "questionOrder",o.id AS "optionId",o.option_text AS "optionText",
       o.is_correct AS "isCorrect",o.sequence_order AS "optionOrder"
       FROM questions q JOIN answer_options o ON o.question_id=q.id
       WHERE q.assessment_id=ANY($1::int[]) ORDER BY q.assessment_id,q.sequence_order,o.sequence_order`,
        [assessmentIds],
      )
    ).rows;
  }
  async createTrainingModule(input: {
    title: string;
    slug: string;
    description: string;
  }) {
    return (
      await this.database.query<{ id: number }>(
        `INSERT INTO training_modules(title,slug,description,is_active) VALUES($1,$2,$3,false) RETURNING id`,
        [input.title, input.slug, input.description],
      )
    ).rows[0]!.id;
  }
  async updateTrainingModule(
    id: number,
    input: { title: string; description: string; isActive: boolean },
  ) {
    return (
      (
        await this.database.query(
          `UPDATE training_modules SET title=$2,description=$3,is_active=$4,updated_at=now() WHERE id=$1`,
          [id, input.title, input.description, input.isActive],
        )
      ).rowCount === 1
    );
  }
  async assessmentForModule(moduleId: number, assessmentId: number) {
    return (
      await this.database.query<{ hasAttempts: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM assessment_attempts aa WHERE aa.assessment_id=a.id) AS "hasAttempts"
       FROM assessments a WHERE a.id=$2 AND a.training_module_id=$1`,
        [moduleId, assessmentId],
      )
    ).rows[0];
  }
  async questionForAssessment(assessmentId: number, questionId: number) {
    return (
      (
        await this.database.query(
          `SELECT 1 FROM questions WHERE id=$2 AND assessment_id=$1`,
          [assessmentId, questionId],
        )
      ).rowCount === 1
    );
  }
  async createAssessmentQuestion(
    assessmentId: number,
    questionText: string,
    options: Array<{ optionText: string; isCorrect: boolean }>,
  ) {
    return (
      await this.database.query<{ id: number }>(
        `WITH next_order AS(
      SELECT COALESCE(MAX(sequence_order),0)+1 AS value FROM questions WHERE assessment_id=$1),inserted AS(
      INSERT INTO questions(assessment_id,question_text,question_type,sequence_order)
      SELECT $1,$2,'single_choice',value FROM next_order RETURNING id),option_values AS(
      SELECT * FROM jsonb_to_recordset($3::jsonb) AS value("optionText" text,"isCorrect" boolean,"sequenceOrder" integer)),saved AS(
      INSERT INTO answer_options(question_id,option_text,is_correct,sequence_order)
      SELECT inserted.id,value."optionText",value."isCorrect",value."sequenceOrder" FROM inserted CROSS JOIN option_values value)
      SELECT id FROM inserted`,
        [
          assessmentId,
          questionText,
          JSON.stringify(
            options.map((o, i) => ({ ...o, sequenceOrder: i + 1 })),
          ),
        ],
      )
    ).rows[0]!.id;
  }
  async updateAssessmentQuestion(
    assessmentId: number,
    questionId: number,
    questionText: string,
    options: Array<{ optionText: string; isCorrect: boolean }>,
  ) {
    return (
      (
        await this.database.query<{ id: number }>(
          `WITH updated AS(
      UPDATE questions SET question_text=$3,updated_at=now() WHERE id=$2 AND assessment_id=$1 RETURNING id),deleted AS(
      DELETE FROM answer_options WHERE question_id IN(SELECT id FROM updated) RETURNING id),option_values AS(
      SELECT * FROM jsonb_to_recordset($4::jsonb) AS value("optionText" text,"isCorrect" boolean,"sequenceOrder" integer)),saved AS(
      INSERT INTO answer_options(question_id,option_text,is_correct,sequence_order)
      SELECT updated.id,value."optionText",value."isCorrect",value."sequenceOrder" FROM updated CROSS JOIN option_values value
      CROSS JOIN(SELECT COUNT(*) FROM deleted) completed_delete) SELECT id FROM updated`,
          [
            assessmentId,
            questionId,
            questionText,
            JSON.stringify(
              options.map((o, i) => ({ ...o, sequenceOrder: i + 1 })),
            ),
          ],
        )
      ).rows.length === 1
    );
  }
  async deleteAssessmentQuestion(assessmentId: number, questionId: number) {
    return (
      (
        await this.database.query(
          `DELETE FROM questions WHERE id=$2 AND assessment_id=$1`,
          [assessmentId, questionId],
        )
      ).rowCount === 1
    );
  }
}
