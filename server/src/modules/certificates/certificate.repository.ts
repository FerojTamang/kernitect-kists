import type { Pool } from 'pg';
import type {
  CertificateCompletionSummary,
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

  async currentCertificate(
    traineeId: number,
  ): Promise<TraineeCertificate | null> {
    const result = await this.database.query<CertificateEvidenceRow>(
      `SELECT c.id AS "certificateId",
        c.certificate_number AS "certificateNumber",
        c.issued_at AS "issuedAt",
        concat_ws(' ', u.first_name, u.last_name) AS "traineeName",
        ca.training_assignment_id AS "assignmentId",
        m.title AS "moduleTitle",
        ca.completed_at_snapshot AS "completedAt",
        evidence.assessment_id AS "assessmentId",
        a.title AS "assessmentTitle",
        aa.attempt_number AS "attemptNumber",
        aa.score_percentage::text AS "scorePercentage",
        aa.pass_percentage_snapshot::text AS "passPercentage"
      FROM available_certificates c
      JOIN users u ON u.id = c.trainee_id
      JOIN certificate_assignments ca ON ca.certificate_id = c.id
      JOIN training_assignments ta ON ta.id = ca.training_assignment_id
      JOIN training_modules m ON m.id = ta.training_module_id
      LEFT JOIN certificate_assessment_attempts evidence
        ON evidence.certificate_id = c.id
       AND evidence.training_assignment_id = ca.training_assignment_id
      LEFT JOIN assessments a ON a.id = evidence.assessment_id
      LEFT JOIN assessment_attempts aa ON aa.id = evidence.assessment_attempt_id
      WHERE c.trainee_id = $1
      ORDER BY ta.id ASC, a.sequence_order ASC NULLS LAST`,
      [traineeId],
    );

    const first = result.rows[0];
    if (!first) return null;

    const training = new Map<number, TraineeCertificate['training'][number]>();

    for (const row of result.rows) {
      let item = training.get(row.assignmentId);
      if (!item) {
        item = {
          assignmentId: row.assignmentId,
          moduleTitle: row.moduleTitle,
          completedAt: row.completedAt.toISOString(),
          assessments: [],
        };
        training.set(row.assignmentId, item);
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

    return {
      id: first.certificateId,
      certificateNumber: first.certificateNumber,
      issuedAt: first.issuedAt.toISOString(),
      traineeName: first.traineeName,
      status: 'issued',
      training: [...training.values()],
    };
  }
}
