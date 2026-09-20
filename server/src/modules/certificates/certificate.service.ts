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
    const [completion, certificate] = await Promise.all([
      this.repository.completionSummary(traineeId),
      this.repository.currentCertificate(traineeId),
    ]);

    const eligible =
      completion.requiredAssignments > 0 &&
      completion.completedAssignments === completion.requiredAssignments &&
      completion.passedAssessments === completion.requiredAssessments;

    return { eligible, certificate, completion };
  }
}
