import type { CertificateRepository } from './certificate.repository.js';
import type { TraineeCertificateStatus } from './certificate.types.js';

export class CertificateService {
  constructor(private readonly repository: CertificateRepository) {}

  async status(traineeId: number): Promise<TraineeCertificateStatus> {
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
