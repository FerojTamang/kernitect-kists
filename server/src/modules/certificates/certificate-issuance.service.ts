import type { Pool } from 'pg';

export class CertificateIssuanceService {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async issueIfEligible(traineeId: number): Promise<void> {
    await this.database.query(
      `INSERT INTO certificates (
        trainee_id,
        certificate_number,
        requirement_fingerprint
      )
      SELECT eligibility.trainee_id,
        'KISTS-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
        upper(substr(md5(
          random()::text || clock_timestamp()::text || ($1::integer)::text
        ), 1, 12)),
        current_requirement_fingerprint(eligibility.trainee_id)
      FROM certification_eligibility eligibility
      WHERE eligibility.trainee_id = $1::integer
        AND eligibility.eligible
        AND NOT EXISTS (
          SELECT 1
          FROM certificates existing_certificate
          WHERE existing_certificate.trainee_id = eligibility.trainee_id
            AND existing_certificate.requirement_fingerprint =
              current_requirement_fingerprint(eligibility.trainee_id)
        )
      ON CONFLICT DO NOTHING`,
      [traineeId],
    );
  }
}
