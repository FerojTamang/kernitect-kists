import type { Pool } from 'pg';
import type {
  CertificateCompletionSummary,
  CertificateRequirement,
  TraineeCertificate,
} from './certificate.types.js';

interface CertificateEvidenceRow {
  certificateId: number;
  certificateNumber: string;
  issuedAt: Date;
  traineeName: string;
  assignmentId: number;
  moduleTitle: string;
  completedAt: Date;
  assessmentId: number | null;
  assessmentTitle: string | null;
  attemptNumber: number | null;
  scorePercentage: string | null;
  passPercentage: string | null;
  isCurrent: boolean;
}

interface RequirementRow {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  completed: boolean;
}

interface CompletionRow {
  requiredAssignments: number;
  completedAssignments: number;
  requiredAssessments: number;
  passedAssessments: number;
}

export class CertificateRepository {
  constructor(private readonly database: Pool) {}

  async completionSummary(
    traineeId: number,
  ): Promise<CertificateCompletionSummary> {
    const result = await this.database.query<CompletionRow>(
      `SELECT
        COUNT(DISTINCT ta.id)::int AS "requiredAssignments",
        COUNT(DISTINCT ta.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM progress p
            WHERE p.training_assignment_id = ta.id
              AND p.completed_at IS NOT NULL
              AND p.percentage = 100
          )
        )::int AS "completedAssignments",
        COUNT(DISTINCT (ta.id, a.id)) FILTER (
          WHERE a.id IS NOT NULL
        )::int AS "requiredAssessments",
        COUNT(DISTINCT (ta.id, a.id)) FILTER (
          WHERE a.id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM assessment_attempts aa
              WHERE aa.training_assignment_id = ta.id
                AND aa.assessment_id = a.id
                AND aa.passed
            )
        )::int AS "passedAssessments"
      FROM training_assignments ta
      LEFT JOIN assessments a
        ON a.training_module_id = ta.training_module_id
       AND a.is_active
      WHERE ta.trainee_id = $1
        AND ta.required
        AND ta.status = 'active'`,
      [traineeId],
    );

    return (
      result.rows[0] ?? {
        requiredAssignments: 0,
        completedAssignments: 0,
        requiredAssessments: 0,
        passedAssessments: 0,
      }
    );
  }

  async eligibility(traineeId: number): Promise<boolean> {
    const result = await this.database.query<{ eligible: boolean }>(
      `SELECT eligible
      FROM certification_eligibility
      WHERE trainee_id = $1`,
      [traineeId],
    );
    return result.rows[0]?.eligible ?? false;
  }

  async requirements(traineeId: number): Promise<CertificateRequirement[]> {
    const result = await this.database.query<RequirementRow>(
      `SELECT assignment.id AS "assignmentId",
        assignment.training_module_id AS "moduleId",
        module.title AS "moduleTitle",
        (
          EXISTS (
            SELECT 1
            FROM progress
            WHERE training_assignment_id = assignment.id
              AND completed_at IS NOT NULL
              AND percentage = 100
          )
          AND NOT EXISTS (
            SELECT 1
            FROM scenarios scenario
            WHERE scenario.training_module_id = assignment.training_module_id
              AND scenario.is_active
              AND NOT EXISTS (
                SELECT 1
                FROM scenario_attempts attempt
                WHERE attempt.training_assignment_id = assignment.id
                  AND attempt.scenario_id = scenario.id
                  AND attempt.completed_at IS NOT NULL
              )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM assessments assessment
            WHERE assessment.training_module_id = assignment.training_module_id
              AND assessment.is_active
              AND NOT EXISTS (
                SELECT 1
                FROM assessment_attempts attempt
                WHERE attempt.training_assignment_id = assignment.id
                  AND attempt.assessment_id = assessment.id
                  AND attempt.submitted_at IS NOT NULL
                  AND attempt.passed
              )
          )
        ) AS completed
      FROM training_assignments assignment
      JOIN training_modules module
        ON module.id = assignment.training_module_id
      WHERE assignment.trainee_id = $1
        AND assignment.required
        AND assignment.status = 'active'
      ORDER BY assignment.assigned_at ASC, assignment.id ASC`,
      [traineeId],
    );
    return result.rows;
  }

  async certificatePortfolio(traineeId: number): Promise<{
    current: TraineeCertificate | null;
    history: TraineeCertificate[];
  }> {
    const result = await this.database.query<CertificateEvidenceRow>(
      `SELECT c.id AS "certificateId",
        c.certificate_number AS "certificateNumber",
        c.issued_at AS "issuedAt",
        concat_ws(' ', u.first_name, u.last_name) AS "traineeName",
        ca.training_assignment_id AS "assignmentId",
        ca.module_title_snapshot AS "moduleTitle",
        ca.completed_at_snapshot AS "completedAt",
        evidence.assessment_id AS "assessmentId",
        a.title AS "assessmentTitle",
        aa.attempt_number AS "attemptNumber",
        aa.score_percentage::text AS "scorePercentage",
        aa.pass_percentage_snapshot::text AS "passPercentage",
        (current_certificate.id IS NOT NULL) AS "isCurrent"
      FROM certificates c
      JOIN users u ON u.id = c.trainee_id
      JOIN certificate_assignments ca ON ca.certificate_id = c.id
      LEFT JOIN available_certificates current_certificate
        ON current_certificate.id = c.id
      LEFT JOIN certificate_assessment_attempts evidence
        ON evidence.certificate_id = c.id
       AND evidence.training_assignment_id = ca.training_assignment_id
      LEFT JOIN assessments a ON a.id = evidence.assessment_id
      LEFT JOIN assessment_attempts aa ON aa.id = evidence.assessment_attempt_id
      WHERE c.trainee_id = $1
        AND c.status = 'issued'
      ORDER BY c.issued_at DESC, c.id DESC, ca.id ASC,
        a.sequence_order ASC NULLS LAST`,
      [traineeId],
    );

    const certificates = new Map<
      number,
      { certificate: TraineeCertificate; isCurrent: boolean }
    >();

    for (const row of result.rows) {
      let entry = certificates.get(row.certificateId);
      if (!entry) {
        entry = {
          isCurrent: row.isCurrent,
          certificate: {
            id: row.certificateId,
            certificateNumber: row.certificateNumber,
            issuedAt: row.issuedAt.toISOString(),
            traineeName: row.traineeName,
            status: 'issued',
            training: [],
          },
        };
        certificates.set(row.certificateId, entry);
      }

      let item = entry.certificate.training.find(
        (training) => training.assignmentId === row.assignmentId,
      );
      if (!item) {
        item = {
          assignmentId: row.assignmentId,
          moduleTitle: row.moduleTitle,
          completedAt: row.completedAt.toISOString(),
          assessments: [],
        };
        entry.certificate.training.push(item);
      }

      if (
        row.assessmentId !== null &&
        row.assessmentTitle !== null &&
        row.attemptNumber !== null &&
        row.scorePercentage !== null &&
        row.passPercentage !== null
      ) {
        item.assessments.push({
          assessmentId: row.assessmentId,
          title: row.assessmentTitle,
          attemptNumber: row.attemptNumber,
          scorePercentage: Number(row.scorePercentage),
          passPercentage: Number(row.passPercentage),
        });
      }
    }

    const entries = [...certificates.values()];
    return {
      current:
        entries.find((entry) => entry.isCurrent)?.certificate ?? null,
      history: entries
        .filter((entry) => !entry.isCurrent)
        .map((entry) => entry.certificate),
    };
  }
}
