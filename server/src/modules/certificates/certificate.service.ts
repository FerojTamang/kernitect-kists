import type { CertificateRepository } from './certificate.repository.js';
import type { CertificateIssuanceService } from './certificate-issuance.service.js';
import type { TraineeCertificateStatus } from './certificate.types.js';

export class CertificateService {
  constructor(
    private readonly repository: CertificateRepository,
    private readonly issuance: CertificateIssuanceService,
  ) {}

  async status(traineeId: number): Promise<TraineeCertificateStatus> {
    // Reconcile trainees who became eligible after their requirements changed.
    // The shared issuance operation is idempotent and preserves existing issues.
    await this.issuance.issueIfEligible(traineeId);
    const [completion, eligible, requirements, portfolio] = await Promise.all([
      this.repository.completionSummary(traineeId),
      this.repository.eligibility(traineeId),
      this.repository.requirements(traineeId),
      this.repository.certificatePortfolio(traineeId),
    ]);

    return {
      eligible,
      certificate: portfolio.current,
      history: portfolio.history,
      requirements,
      completion,
    };
  }
}
