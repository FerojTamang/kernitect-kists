import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import './certificate.css';

interface CertificateAssessmentEvidence {
  assessmentId: number;
  title: string;
  attemptNumber: number;
  scorePercentage: number;
  passPercentage: number;
}

interface CertificateTrainingEvidence {
  assignmentId: number;
  moduleTitle: string;
  completedAt: string;
  assessments: CertificateAssessmentEvidence[];
}

interface TraineeCertificate {
  id: number;
  certificateNumber: string;
  issuedAt: string;
  traineeName: string;
  status: 'issued';
  training: CertificateTrainingEvidence[];
}

interface CertificateStatus {
  eligible: boolean;
  certificate: TraineeCertificate | null;
  completion: {
    requiredAssignments: number;
    completedAssignments: number;
    requiredAssessments: number;
    passedAssessments: number;
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function TraineeCertificates() {
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCertificate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await apiRequest<CertificateStatus>('/trainee/certificates'));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'We could not load your certificate information. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCertificate(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCertificate]);

  if (loading) {
    return (
      <section className="certificate-state card" role="status">
        <p className="eyebrow">Training records / Certificates</p>
        <h1>Loading certificates</h1>
        <p>Checking your current KISTS completion record...</p>
      </section>
    );
  }

  if (error || !status) {
    return (
      <section className="certificate-state card" role="alert">
        <p className="eyebrow">Training records / Certificates</p>
        <h1>Certificates unavailable</h1>
        <p>{error ?? 'Please try again.'}</p>
        <button type="button" onClick={() => void loadCertificate()}>
          Try again
        </button>
      </section>
    );
  }

  if (!status.certificate) {
    return (
      <div className="certificate-page">
        <header className="certificate-page-header">
          <p className="eyebrow">Training records / Certificates</p>
          <h1>Digital certificates</h1>
          <p>
            KISTS makes a certificate available automatically after all required
            assigned training and associated assessment conditions are complete.
          </p>
        </header>

        <section className="certificate-pending card" role="status">
          <span className="certificate-pending-icon" aria-hidden="true">
            ○
          </span>
          <h2>Certificate not available yet</h2>
          <p>
            Complete all required training and pass its active assessments
            before your digital certificate becomes available.
          </p>
          <div className="certificate-progress-grid">
            <div>
              <span>Required training</span>
              <strong>
                {status.completion.completedAssignments} /{' '}
                {status.completion.requiredAssignments}
              </strong>
            </div>
            <div>
              <span>Required assessments passed</span>
              <strong>
                {status.completion.passedAssessments} /{' '}
                {status.completion.requiredAssessments}
              </strong>
            </div>
          </div>
          <Link className="certificate-button primary" to="/trainee/training">
            Return to My Training
          </Link>
        </section>
      </div>
    );
  }

  const certificate = status.certificate;

  return (
    <div className="certificate-page">
      <header className="certificate-page-header certificate-screen-only">
        <div>
          <p className="eyebrow">Training records / Certificates</p>
          <h1>Your digital certificate</h1>
          <p>
            This certificate is backed by your recorded KISTS training
            completion and passing assessment evidence.
          </p>
        </div>
        <button
          className="certificate-button primary"
          type="button"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </header>

      <article
        className="certificate-sheet"
        aria-label="KISTS digital certificate"
      >
        <div className="certificate-brand">
          <span className="certificate-brand-mark">K</span>
          <div>
            <strong>Kernitect</strong>
            <span>Interactive Safety Training System</span>
          </div>
        </div>

        <p className="certificate-overline">Digital training certificate</p>
        <h2>Certificate of Completion</h2>
        <p className="certificate-intro">This certifies that</p>
        <p className="certificate-name">{certificate.traineeName}</p>
        <p className="certificate-copy">
          has successfully completed all required KISTS training and associated
          assessment conditions recorded at the time of issue.
        </p>

        <div className="certificate-training-list">
          {certificate.training.map((training) => (
            <section key={training.assignmentId}>
              <div className="certificate-module-row">
                <div>
                  <span>Completed training</span>
                  <strong>{training.moduleTitle}</strong>
                </div>
                <time dateTime={training.completedAt}>
                  {formatDate(training.completedAt)}
                </time>
              </div>
              {training.assessments.map((assessment) => (
                <div
                  className="certificate-assessment-row"
                  key={assessment.assessmentId}
                >
                  <span>{assessment.title}</span>
                  <span>
                    Score {assessment.scorePercentage}% · Pass mark{' '}
                    {assessment.passPercentage}% · Attempt{' '}
                    {assessment.attemptNumber}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>

        <footer className="certificate-footer">
          <div>
            <span>Certificate number</span>
            <strong>{certificate.certificateNumber}</strong>
          </div>
          <div>
            <span>Issued</span>
            <strong>{formatDate(certificate.issuedAt)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Issued</strong>
          </div>
        </footer>
      </article>

      <div className="certificate-actions certificate-screen-only">
        <Link className="certificate-button secondary" to="/trainee/training">
          My Training
        </Link>
        <Link className="certificate-button secondary" to="/trainee/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
