import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import kernitectLogo from '../../assets/branding/kernitect-logo-on-light.png';
import { ApiError, apiRequest } from '../../services/api/request';
import { DashboardIcon } from '../trainee/DashboardIcon';
import './certificate.css';

export interface TraineeCertificate {
  id: number;
  certificateNumber: string;
  issuedAt: string;
  traineeName: string;
  status: 'issued';
  training: Array<{
    assignmentId: number;
    moduleTitle: string;
    completedAt: string;
    assessments: Array<{
      assessmentId: number;
      title: string;
      attemptNumber: number;
      scorePercentage: number;
      passPercentage: number;
    }>;
  }>;
}

export interface CertificateStatus {
  eligible: boolean;
  certificate: TraineeCertificate | null;
  history: TraineeCertificate[];
  requirements: Array<{
    assignmentId: number;
    moduleId: number;
    moduleTitle: string;
    completed: boolean;
  }>;
  completion: {
    requiredAssignments: number;
    completedAssignments: number;
    requiredAssessments: number;
    passedAssessments: number;
  };
}

function certificateTrainingLabel(certificate: TraineeCertificate): string {
  const titles = certificate.training.map((training) => training.moduleTitle);
  if (titles.length === 0) return 'KISTS Safety Training';
  return titles.join(' · ');
}

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function useCertificateStatus() {
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return { status, loading, error, load };
}

function CertificateState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  return (
    <section
      className="certificate-state card"
      role={error ? 'alert' : 'status'}
    >
      <p className="eyebrow">Training records / Certificates</p>
      <h1>{loading ? 'Loading certificates' : 'Certificates unavailable'}</h1>
      <p>
        {loading ? 'Checking your current KISTS completion record…' : error}
      </p>
      {!loading ? <button onClick={retry}>Try again</button> : null}
    </section>
  );
}

export function CertificatePreview({
  certificate,
}: {
  certificate: TraineeCertificate;
}) {
  const issueDate = formatDate(certificate.issuedAt);
  return (
    <div
      className="certificate-preview certificate-print-root"
      role="region"
      aria-label="Certificate preview"
    >
      <article
        className="certificate-document"
        aria-label="KISTS digital certificate"
      >
        <span
          className="certificate-corner certificate-corner-one"
          aria-hidden="true"
        />
        <span
          className="certificate-corner certificate-corner-two"
          aria-hidden="true"
        />
        <div className="certificate-document-inner">
          <header className="certificate-document-brand">
            <div className="certificate-branding-block">
              <img
                src={kernitectLogo}
                alt="Kernitect — People, Safety, Progress"
              />
              <strong>KISTS</strong>
              <span>
                Kernitect Interactive
                <br />
                Safety Training System
              </span>
            </div>
            <div className="certificate-title-block">
              <h2>
                <span>Certificate of</span>Completion
              </h2>
              <span className="certificate-gold-ornament" aria-hidden="true">
                ◆
              </span>
            </div>
            <div className="certificate-document-number">
              <span>Certificate ID</span>
              <strong>{certificate.certificateNumber}</strong>
            </div>
          </header>
          <main className="certificate-document-body">
            <p>This is to certify that</p>
            <h3>{certificate.traineeName}</h3>
            <p>
              has successfully completed the following required KISTS training:
            </p>
            <ul className="certificate-training-list">
              {certificate.training.map((training) => (
                <li key={training.assignmentId}>{training.moduleTitle}</li>
              ))}
            </ul>
            <p className="certificate-description">
              All required learning, interactive safety scenarios where
              applicable,
              <br />
              and final assessments have been completed.
            </p>
          </main>
          <footer className="certificate-document-footer">
            <div className="certificate-signatory">
              <em>Ram Kumar Tamang</em>
              <span className="certificate-signature-line" />
              <strong>Ram Kumar Tamang</strong>
              <small>Logistics Manager</small>
            </div>
            <dl className="certificate-metadata">
              <div>
                <dt>Completion Date</dt>
                <dd>{issueDate ?? 'Date unavailable'}</dd>
              </div>
              <div>
                <dt>Training Provider</dt>
                <dd>
                  Kernitect Interactive
                  <br />
                  Safety Training System
                </dd>
              </div>
            </dl>
            <div
              className="certificate-seal"
              aria-label="Safer people, brighter tomorrow"
            >
              <span>Safer</span>
              <strong>People</strong>
              <i>
                Brighter
                <br />
                Tomorrow
              </i>
            </div>
          </footer>
          <div className="certificate-motto">
            <span />
            People&nbsp; | &nbsp;Safety&nbsp; | &nbsp;Progress
            <span />
          </div>
        </div>
      </article>
    </div>
  );
}

export function CertificateModal({
  certificate,
  onClose,
  returnFocusRef,
}: {
  certificate: TraineeCertificate;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = document.querySelectorAll<HTMLElement>(
        '.certificate-modal button:not([disabled])',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [onClose, returnFocusRef]);

  return createPortal(
    <div
      className="certificate-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="certificate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-modal-title"
      >
        <header className="certificate-modal-header certificate-screen-only">
          <h2 id="certificate-modal-title">Digital Certificate</h2>
          <div>
            <button
              className="certificate-button primary"
              type="button"
              onClick={() => window.print()}
            >
              Download certificate
            </button>
            <button
              ref={closeButtonRef}
              className="certificate-modal-close"
              type="button"
              onClick={onClose}
              aria-label="Close digital certificate"
            >
              ×
            </button>
          </div>
        </header>
        <div className="certificate-modal-content">
          <CertificatePreview certificate={certificate} />
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CertificateLibraryCard({
  certificate,
  current,
}: {
  certificate: TraineeCertificate;
  current: boolean;
}) {
  return (
    <article className="certificate-library-card">
      <div className="certificate-credential-mark" aria-hidden="true">
        <span>Certificate</span>
        <strong>KISTS</strong>
        <i>People · Safety · Progress</i>
      </div>
      <div className="certificate-library-copy">
        <div className="certificate-card-status">
          <span className="certificate-card-check" aria-hidden="true">
            ✓
          </span>
          <span className="certificate-issued-badge">
            {current ? 'Current' : 'Issued'}
          </span>
        </div>
        <h3>{certificateTrainingLabel(certificate)}</h3>
        <p>
          Official KISTS training certificate confirming successful completion.
        </p>
        <ul className="certificate-card-training" aria-label="Covered training">
          {certificate.training.map((training) => (
            <li key={training.assignmentId}>{training.moduleTitle}</li>
          ))}
        </ul>
        <dl>
          <div>
            <dt>Issued</dt>
            <dd>{formatDate(certificate.issuedAt) ?? 'Date unavailable'}</dd>
          </div>
          <div>
            <dt>Certificate ID</dt>
            <dd>{certificate.certificateNumber}</dd>
          </div>
        </dl>
        <div className="certificate-card-actions">
          <Link
            className="certificate-button primary"
            to={`/trainee/certificates/${certificate.id}`}
          >
            {current ? 'View Certificate' : 'View'}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function TraineeCertificates() {
  const { status, loading, error, load } = useCertificateStatus();
  if (loading || error || !status)
    return (
      <CertificateState
        loading={loading}
        error={error}
        retry={() => void load()}
      />
    );
  const certificateCount = status.history.length + (status.certificate ? 1 : 0);
  const hasCertificates = certificateCount > 0;
  const {
    completedAssignments,
    requiredAssignments,
    passedAssessments,
    requiredAssessments,
  } = status.completion;
  const requiredTotal = requiredAssignments + requiredAssessments;
  const completedTotal = completedAssignments + passedAssessments;
  const requirementProgress = requiredTotal
    ? Math.min(100, Math.round((completedTotal / requiredTotal) * 100))
    : 0;
  const trainingProgress = requiredAssignments
    ? Math.min(100, (completedAssignments / requiredAssignments) * 100)
    : 0;
  const assessmentProgress = requiredAssessments
    ? Math.min(100, (passedAssessments / requiredAssessments) * 100)
    : 0;
  return (
    <div className="certificate-library">
      <header className="certificate-library-header">
        <p className="eyebrow">Training records / Certificates</p>
        <h1>My Certificates</h1>
        <p>View and manage your official KISTS training certificates.</p>
      </header>
      {!hasCertificates ? (
        <section className="certificate-pending card" role="status">
          <span className="certificate-pending-icon" aria-hidden="true">
            <DashboardIcon name="Certificates" />
          </span>
          <span className="certificate-pending-badge">
            Certificate progress
          </span>
          <h2>Certificate in progress</h2>
          <p className="certificate-pending-intro">
            Complete all required KISTS training and final assessments to unlock
            your digital certificate.
          </p>
          <div className="certificate-overall-progress">
            <div className="certificate-progress-heading">
              <span>Overall requirements</span>
              <strong>{requirementProgress}% complete</strong>
            </div>
            <div
              className="certificate-progress-track"
              role="progressbar"
              aria-label="Overall certificate requirements complete"
              aria-valuenow={requirementProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${requirementProgress}%` }} />
            </div>
          </div>
          <div className="certificate-progress-grid">
            <div className={trainingProgress === 100 ? 'is-complete' : ''}>
              <span className="certificate-requirement-icon" aria-hidden="true">
                <DashboardIcon name="My Training" />
              </span>
              <span className="certificate-requirement-label">
                Required training
              </span>
              <strong>
                {completedAssignments} / {requiredAssignments} completed
              </strong>
              <div
                className="certificate-progress-track"
                role="progressbar"
                aria-label="Required training completed"
                aria-valuenow={trainingProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${trainingProgress}%` }} />
              </div>
            </div>
            <div className={assessmentProgress === 100 ? 'is-complete' : ''}>
              <span className="certificate-requirement-icon" aria-hidden="true">
                <DashboardIcon name="Assessments" />
              </span>
              <span className="certificate-requirement-label">
                Required assessments
              </span>
              <strong>
                {passedAssessments} / {requiredAssessments} passed
              </strong>
              <div
                className="certificate-progress-track"
                role="progressbar"
                aria-label="Required assessments passed"
                aria-valuenow={assessmentProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${assessmentProgress}%` }} />
              </div>
            </div>
          </div>
          <p className="certificate-pending-note">
            Your certificate will become available automatically once all
            required training and assessment conditions are complete.
          </p>
          <Link className="certificate-button primary" to="/trainee/training">
            Continue Training
          </Link>
        </section>
      ) : status.certificate ? (
        <>
          <section
            className="certificate-library-summary"
            aria-label="Certificate summary"
          >
            <article>
              <span className="certificate-summary-icon" aria-hidden="true">
                <DashboardIcon name="Certificates" />
              </span>
              <div>
                <small>Certificates earned</small>
                <strong>{certificateCount}</strong>
              </div>
            </article>
            <article>
              <span className="certificate-summary-icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <small>Current certificate</small>
                <strong>{certificateTrainingLabel(status.certificate)}</strong>
              </div>
            </article>
            <article>
              <span className="certificate-summary-icon" aria-hidden="true">
                ◷
              </span>
              <div>
                <small>Current issue date</small>
                <strong>
                  {formatDate(status.certificate.issuedAt) ??
                    'Date unavailable'}
                </strong>
              </div>
            </article>
          </section>
          <section
            className="certificate-library-section"
            aria-labelledby="issued-certificates-title"
          >
            <div className="certificate-library-section-heading">
              <div>
                <p className="eyebrow">Current certification</p>
                <h2 id="issued-certificates-title">Current Certificate</h2>
              </div>
            </div>
            <div className="certificate-library-grid">
              <CertificateLibraryCard
                certificate={status.certificate}
                current
              />
            </div>
          </section>
          {status.history.length ? (
            <section
              className="certificate-library-section"
              aria-labelledby="certificate-history-title"
            >
              <div className="certificate-library-section-heading">
                <div>
                  <p className="eyebrow">Training record</p>
                  <h2 id="certificate-history-title">Previous Certificates</h2>
                </div>
                <span>{status.history.length} previous</span>
              </div>
              <div className="certificate-library-grid certificate-history-grid">
                {status.history.map((certificate) => (
                  <CertificateLibraryCard
                    key={certificate.id}
                    certificate={certificate}
                    current={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className="certificate-current-pending card" role="status">
            <p className="eyebrow">Current certification</p>
            <h2>Additional required training outstanding</h2>
            <p>
              Complete every current requirement to receive an updated KISTS
              certificate.
            </p>
            <ul>
              {status.requirements.map((requirement) => (
                <li
                  className={requirement.completed ? 'completed' : ''}
                  key={requirement.assignmentId}
                >
                  <span aria-hidden="true">
                    {requirement.completed ? '✓' : '○'}
                  </span>
                  <span>{requirement.moduleTitle}</span>
                </li>
              ))}
            </ul>
            <strong>Certificate status: Pending</strong>
            <Link className="certificate-button primary" to="/trainee/training">
              Return to My Training
            </Link>
          </section>
          <section
            className="certificate-library-section"
            aria-labelledby="previous-certificates-title"
          >
            <div className="certificate-library-section-heading">
              <div>
                <p className="eyebrow">Training record</p>
                <h2 id="previous-certificates-title">Previous Certificates</h2>
              </div>
              <span>{status.history.length} previous</span>
            </div>
            <div className="certificate-library-grid certificate-history-grid">
              {status.history.map((certificate) => (
                <CertificateLibraryCard
                  key={certificate.id}
                  certificate={certificate}
                  current={false}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function TraineeCertificateDetail() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const { status, loading, error, load } = useCertificateStatus();
  if (loading || error || !status)
    return (
      <CertificateState
        loading={loading}
        error={error}
        retry={() => void load()}
      />
    );
  const certificate = [status.certificate, ...status.history].find(
    (item): item is TraineeCertificate =>
      item !== null && String(item.id) === certificateId,
  );
  if (!certificate) {
    return (
      <section className="certificate-state card" role="alert">
        <p className="eyebrow">Training records / Certificates</p>
        <h1>Certificate not found</h1>
        <p>
          This certificate is not available in your issued training records.
        </p>
        <Link className="certificate-button primary" to="/trainee/certificates">
          Back to Certificates
        </Link>
      </section>
    );
  }
  return (
    <div className="certificate-viewer-page">
      <Link
        className="certificate-back-link certificate-screen-only"
        to="/trainee/certificates"
      >
        ← Back to Certificates
      </Link>
      <header className="certificate-viewer-header certificate-screen-only">
        <div>
          <p className="eyebrow">Training records / Certificates</p>
          <h1>Digital Certificate</h1>
          <p>View and download your official training certificate.</p>
        </div>
        <div className="certificate-viewer-actions">
          <button
            className="certificate-button primary"
            type="button"
            onClick={() => window.print()}
          >
            Download certificate
          </button>
          <button
            className="certificate-button secondary"
            type="button"
            onClick={() => navigate('/trainee/certificates')}
          >
            Close
          </button>
        </div>
      </header>
      <CertificatePreview certificate={certificate} />
    </div>
  );
}
