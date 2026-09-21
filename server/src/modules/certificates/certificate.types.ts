export interface CertificateAssessmentEvidence {
  assessmentId: number;
  title: string;
  attemptNumber: number;
  scorePercentage: number;
  passPercentage: number;
}

export interface CertificateTrainingEvidence {
  assignmentId: number;
  moduleTitle: string;
  completedAt: string;
  assessments: CertificateAssessmentEvidence[];
}

export interface TraineeCertificate {
  id: number;
  certificateNumber: string;
  issuedAt: string;
  traineeName: string;
  status: 'issued';
  training: CertificateTrainingEvidence[];
}

export interface CertificateRequirement {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  completed: boolean;
}

export interface CertificateCompletionSummary {
  requiredAssignments: number;
  completedAssignments: number;
  requiredAssessments: number;
  passedAssessments: number;
}

export interface TraineeCertificateStatus {
  eligible: boolean;
  certificate: TraineeCertificate | null;
  history: TraineeCertificate[];
  requirements: CertificateRequirement[];
  completion: CertificateCompletionSummary;
}
