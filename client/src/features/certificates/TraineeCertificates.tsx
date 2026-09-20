import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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
    assessments: Array<{ assessmentId: number; title: string; attemptNumber: number; scorePercentage: number; passPercentage: number }>;
  }>;
}

export interface CertificateStatus {
  eligible: boolean;
  certificate: TraineeCertificate | null;
  completion: { requiredAssignments: number; completedAssignments: number; requiredAssessments: number; passedAssessments: number };
}

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
      if (requestError instanceof ApiError && requestError.status === 401) return;
      setError(requestError instanceof ApiError ? requestError.message : 'We could not load your certificate information. Please try again.');
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

function CertificateState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  return (
    <section className="certificate-state card" role={error ? 'alert' : 'status'}>
      <p className="eyebrow">Training records / Certificates</p>
      <h1>{loading ? 'Loading certificates' : 'Certificates unavailable'}</h1>
      <p>{loading ? 'Checking your current KISTS completion record…' : error}</p>
      {!loading ? <button onClick={retry}>Try again</button> : null}
    </section>
  );
}

export function CertificatePreview({ certificate }: { certificate: TraineeCertificate }) {
  const courseTitle = certificate.training[0]?.moduleTitle ?? 'KISTS Safety Training';
  const issueDate = formatDate(certificate.issuedAt);
  return (
    <div className="certificate-preview certificate-print-root" role="region" aria-label="Certificate preview">
      <article className="certificate-document" aria-label="KISTS digital certificate">
        <span className="certificate-corner certificate-corner-one" aria-hidden="true" /><span className="certificate-corner certificate-corner-two" aria-hidden="true" />
        <div className="certificate-document-inner">
          <header className="certificate-document-brand">
            <div className="certificate-branding-block">
              <img src={kernitectLogo} alt="Kernitect — People, Safety, Progress" />
              <strong>KISTS</strong><span>Kernitect Interactive<br />Safety Training System</span>
            </div>
            <div className="certificate-title-block"><h2><span>Certificate of</span>Completion</h2><span className="certificate-gold-ornament" aria-hidden="true">◆</span></div>
            <div className="certificate-document-number"><span>Certificate ID</span><strong>{certificate.certificateNumber}</strong></div>
          </header>
          <main className="certificate-document-body">
            <p>This is to certify that</p><h3>{certificate.traineeName}</h3><p>has successfully completed the</p>
            <h4>{courseTitle.toUpperCase()} SAFETY TRAINING</h4>
            <p className="certificate-description">including learning content, interactive 360° warehouse safety scenario,<br />and final assessment.</p>
          </main>
          <footer className="certificate-document-footer">
            <div className="certificate-signatory"><em>Ram Kumar Tamang</em><span className="certificate-signature-line" /><strong>Ram Kumar Tamang</strong><small>Logistics Manager</small></div>
            <dl className="certificate-metadata">
              <div><dt>Completion Date</dt><dd>{issueDate ?? 'Date unavailable'}</dd></div>
              <div><dt>Training Provider</dt><dd>Kernitect Interactive<br />Safety Training System</dd></div>
            </dl>
            <div className="certificate-seal" aria-label="Safer people, brighter tomorrow"><span>Safer</span><strong>People</strong><i>Brighter<br />Tomorrow</i></div>
          </footer>
          <div className="certificate-motto"><span />People&nbsp; | &nbsp;Safety&nbsp; | &nbsp;Progress<span /></div>
        </div>
      </article>
    </div>
  );
}

export function CertificateModal({ certificate, onClose, returnFocusRef }: { certificate: TraineeCertificate; onClose: () => void; returnFocusRef: RefObject<HTMLButtonElement | null> }) {
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
      const controls = document.querySelectorAll<HTMLElement>('.certificate-modal button:not([disabled])');
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
    <div className="certificate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-modal-title">
        <header className="certificate-modal-header certificate-screen-only">
          <h2 id="certificate-modal-title">Digital Certificate</h2>
          <div>
            <button className="certificate-button primary" type="button" onClick={() => window.print()}>Download certificate</button>
            <button ref={closeButtonRef} className="certificate-modal-close" type="button" onClick={onClose} aria-label="Close digital certificate">×</button>
          </div>
        </header>
        <div className="certificate-modal-content"><CertificatePreview certificate={certificate} /></div>
      </section>
    </div>,
    document.body,
  );
}

export function TraineeCertificates() {
  const { status, loading, error, load } = useCertificateStatus();
  if (loading || error || !status) return <CertificateState loading={loading} error={error} retry={() => void load()} />;
  return (
    <div className="certificate-library">
      <header className="certificate-library-header"><p className="eyebrow">Training records / Certificates</p><h1>My Certificates</h1><p>View and manage your official KISTS training certificates.</p></header>
      {!status.certificate ? (
        <section className="certificate-pending card" role="status">
          <span className="certificate-pending-icon" aria-hidden="true">○</span><h2>No certificates yet</h2>
          <p>Complete your required training and assessments to earn your first KISTS certificate.</p>
          <div className="certificate-progress-grid">
            <div><span>Required training</span><strong>{status.completion.completedAssignments} / {status.completion.requiredAssignments}</strong></div>
            <div><span>Required assessments passed</span><strong>{status.completion.passedAssessments} / {status.completion.requiredAssessments}</strong></div>
          </div>
          <Link className="certificate-button primary" to="/trainee/training">Return to My Training</Link>
        </section>
      ) : (
        <>
          <section className="certificate-library-summary" aria-label="Certificate summary">
            <article><span className="certificate-summary-icon" aria-hidden="true"><DashboardIcon name="Certificates" /></span><div><small>Certificates earned</small><strong>1</strong></div></article>
            <article><span className="certificate-summary-icon" aria-hidden="true">✓</span><div><small>Latest certificate</small><strong>{status.certificate.training[0]?.moduleTitle ?? 'KISTS Safety Training'}</strong></div></article>
            <article><span className="certificate-summary-icon" aria-hidden="true">◷</span><div><small>Latest issue date</small><strong>{formatDate(status.certificate.issuedAt) ?? 'Date unavailable'}</strong></div></article>
          </section>
          <section className="certificate-library-section" aria-labelledby="issued-certificates-title">
            <div className="certificate-library-section-heading"><div><p className="eyebrow">Official credentials</p><h2 id="issued-certificates-title">Issued Certificates</h2></div><span>1 certificate</span></div>
            <div className="certificate-library-grid">
              <article className="certificate-library-card">
                <div className="certificate-credential-mark" aria-hidden="true"><span>Certificate</span><strong>KISTS</strong><i>People · Safety · Progress</i></div>
                <div className="certificate-library-copy">
                  <div className="certificate-card-status"><span className="certificate-card-check" aria-hidden="true">✓</span><span className="certificate-issued-badge">Issued</span></div>
                  <h3>{status.certificate.training[0]?.moduleTitle ?? 'KISTS Safety Training'}</h3>
                  <p>Official KISTS training certificate confirming successful completion.</p>
                  <dl>
                    <div><dt>Issued</dt><dd>{formatDate(status.certificate.issuedAt) ?? 'Date unavailable'}</dd></div>
                    <div><dt>Certificate ID</dt><dd>{status.certificate.certificateNumber}</dd></div>
                  </dl>
                  <div className="certificate-card-actions"><Link className="certificate-button primary" to={`/trainee/certificates/${status.certificate.id}`}>View Certificate</Link></div>
                </div>
              </article>
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
  if (loading || error || !status) return <CertificateState loading={loading} error={error} retry={() => void load()} />;
  const certificate = status.certificate;
  if (!certificate || String(certificate.id) !== certificateId) {
    return <section className="certificate-state card" role="alert"><p className="eyebrow">Training records / Certificates</p><h1>Certificate not found</h1><p>This certificate is not available in your issued training records.</p><Link className="certificate-button primary" to="/trainee/certificates">Back to Certificates</Link></section>;
  }
  return (
    <div className="certificate-viewer-page">
      <Link className="certificate-back-link certificate-screen-only" to="/trainee/certificates">← Back to Certificates</Link>
      <header className="certificate-viewer-header certificate-screen-only"><div><p className="eyebrow">Training records / Certificates</p><h1>Digital Certificate</h1><p>View and download your official training certificate.</p></div><div className="certificate-viewer-actions">
        <button className="certificate-button primary" type="button" onClick={() => window.print()}>Download certificate</button><button className="certificate-button secondary" type="button" onClick={() => navigate('/trainee/certificates')}>Close</button>
      </div></header>
      <CertificatePreview certificate={certificate} />
    </div>
  );
}
