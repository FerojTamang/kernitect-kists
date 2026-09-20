import type { Pool } from 'pg';

export class CertificateIssuanceService {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async issueIfEligible(traineeId: number): Promise<void> {
    await this.database.query(
      `INSERT INTO certificates (trainee_id, certificate_number)
      SELECT $1::integer,
        'KISTS-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
        upper(substr(md5(
          random()::text || clock_timestamp()::text || ($1::integer)::text
        ), 1, 12))
      WHERE EXISTS (
        SELECT 1
        FROM training_assignments required_assignment
        WHERE required_assignment.trainee_id = $1::integer
          AND required_assignment.required
          AND required_assignment.status = 'active'
      )
        AND NOT EXISTS (
          SELECT 1
          FROM training_assignments required_assignment
          WHERE required_assignment.trainee_id = $1::integer
            AND required_assignment.required
            AND required_assignment.status = 'active'
            AND (
              NOT EXISTS (
                SELECT 1
                FROM progress p
                WHERE p.training_assignment_id = required_assignment.id
                  AND p.completed_at IS NOT NULL
                  AND p.percentage = 100
              )
              OR EXISTS (
                SELECT 1
                FROM assessments required_assessment
                WHERE required_assessment.training_module_id =
                  required_assignment.training_module_id
                  AND required_assessment.is_active
                  AND NOT EXISTS (
                    SELECT 1
                    FROM assessment_attempts passed_attempt
                    WHERE passed_attempt.training_assignment_id =
                      required_assignment.id
                      AND passed_attempt.assessment_id =
                        required_assessment.id
                      AND passed_attempt.passed
                  )
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM certificates current_certificate
          WHERE current_certificate.trainee_id = $1::integer
            AND current_certificate.status = 'issued'
        )
      ON CONFLICT DO NOTHING`,
      [traineeId],
    );
  }
}
