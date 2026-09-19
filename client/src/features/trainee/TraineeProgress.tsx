import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import type { CertificateStatus, TraineeCertificate } from '../certificates/TraineeCertificates';
import type { DashboardAssignment, TraineeDashboardData } from './dashboard.types';
import './trainee-progress.css';

interface ScenarioRecord {
  progress: { completedHazards: number; totalHazards: number; completed: boolean };
}

interface AssessmentRecord {
  latestAttempt: { scorePercentage: number; passed: boolean } | null;
}

interface ProgressRecord {
  assignment: DashboardAssignment;
  scenario: ScenarioRecord | null;
  assessment: AssessmentRecord | null;
  certificate: TraineeCertificate | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function statusLabel(status: DashboardAssignment['status']) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

async function optionalRequest<T>(path: string): Promise<T | null> {
  try {
    return await apiRequest<T>(path);
  } catch (error) {
    if (error instanceof ApiError && [403, 404, 409].includes(error.status)) return null;
    throw error;
  }
}

function StageRow({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return <li><span className={`progress-stage-icon ${complete ? 'complete' : ''}`} aria-hidden="true">{complete ? '✓' : '•'}</span><strong>{label}</strong><span>{value}</span></li>;
}

function TrainingProgressCard({ record }: { record: ProgressRecord }) {
  const { assignment, scenario, assessment, certificate } = record;
  const attempt = assessment?.latestAttempt ?? null;
  const learningComplete = assignment.learningTotalSections > 0 && assignment.learningCompletedSections === assignment.learningTotalSections;
  return (
    <article className="trainee-progress-card">
      <header>
        <div className="progress-module-title"><span className={`progress-module-check ${assignment.status}`} aria-hidden="true">{assignment.status === 'completed' ? '✓' : '◇'}</span><div><p>Assigned training</p><h3>{assignment.title}</h3></div></div>
        <span className={`progress-status-badge ${assignment.status}`}>{statusLabel(assignment.status)}</span>
      </header>
      <div className="progress-card-overall"><div><span>Overall progress</span><strong>{assignment.progressPercentage}%</strong></div><div className="progress-card-track" role="progressbar" aria-label={`${assignment.title} overall progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={assignment.progressPercentage}><span style={{ width: `${assignment.progressPercentage}%` }} /></div></div>
      <ul className="progress-stage-list" aria-label={`${assignment.title} completion stages`}>
        <StageRow label="Learning content" value={assignment.learningTotalSections > 0 ? `${assignment.learningCompletedSections} of ${assignment.learningTotalSections} sections${learningComplete ? ' · Complete' : ''}` : 'No learning sections available'} complete={learningComplete} />
        {scenario ? <StageRow label="Interactive scenario" value={`${scenario.progress.completedHazards} of ${scenario.progress.totalHazards} safety points${scenario.progress.completed ? ' · Complete' : ''}`} complete={scenario.progress.completed} /> : null}
        {assessment ? <StageRow label="Final assessment" value={attempt ? `${attempt.scorePercentage}% · ${attempt.passed ? 'Passed' : 'Not passed'}` : 'Not attempted'} complete={Boolean(attempt?.passed)} /> : null}
        {certificate ? <StageRow label="Digital certificate" value="Issued" complete /> : null}
      </ul>
      {certificate ? <div className="progress-certificate-meta"><span>Issued {formatDate(certificate.issuedAt)}</span><span>{certificate.certificateNumber}</span></div> : null}
      <footer>
        <Link className="progress-action secondary" to={`/trainee/training/${assignment.assignmentId}`}>{assignment.status === 'completed' ? 'Review Training' : 'Continue Training'}</Link>
        {certificate ? <Link className="progress-action primary" to={`/trainee/certificates/${certificate.id}`}>View Certificate</Link> : null}
      </footer>
    </article>
  );
}

export function TraineeProgress() {
  const [records, setRecords] = useState<ProgressRecord[] | null>(null);
  const [dashboard, setDashboard] = useState<TraineeDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dashboardData, certificateStatus] = await Promise.all([
        apiRequest<TraineeDashboardData>('/trainee/dashboard'),
        apiRequest<CertificateStatus>('/trainee/certificates'),
      ]);
      const detailedRecords = await Promise.all(dashboardData.assignedTraining.map(async (assignment) => {
        const [scenario, assessment] = await Promise.all([
          optionalRequest<ScenarioRecord>(`/trainee/training/${assignment.assignmentId}/scenario`),
          optionalRequest<AssessmentRecord>(`/trainee/training/${assignment.assignmentId}/assessment`),
        ]);
        const certificate = certificateStatus.certificate?.training.some((item) => item.assignmentId === assignment.assignmentId) ? certificateStatus.certificate : null;
        return { assignment, scenario, assessment, certificate };
      }));
      setDashboard(dashboardData);
      setRecords(detailedRecords);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) return;
      setError('We could not load your training progress. Please try again.');
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const assessmentSummary = useMemo(() => {
    const assessments = records?.map((record) => record.assessment).filter((item): item is AssessmentRecord => item !== null) ?? [];
    return { total: assessments.length, passed: assessments.filter((item) => item.latestAttempt?.passed).length };
  }, [records]);
  const certificatesEarned = records?.filter((record) => record.certificate).length ?? 0;

  if (error) return <section className="trainee-progress-state card" role="alert"><h1>Progress unavailable</h1><p>{error}</p><button onClick={() => void load()}>Try again</button></section>;
  if (!dashboard || !records) return <section className="trainee-progress-state card" role="status"><h1>Loading your progress</h1><p>Preparing your KISTS training record…</p></section>;

  return (
    <div className="trainee-progress-page">
      <header className="trainee-progress-header"><p className="eyebrow">My Training / Progress</p><h1>My Progress</h1><p>Track your training completion, assessment results and certificates.</p></header>
      {records.length === 0 ? <section className="trainee-progress-empty card"><span aria-hidden="true">◇</span><h2>No training assigned yet</h2><p>Your assigned training and completion records will appear here.</p></section> : <>
        <section className="trainee-progress-summary" aria-label="Training progress summary">
          <article><small>Overall progress</small><strong>{dashboard.summary.overallProgressPercentage}%</strong><span>Across assigned training</span></article>
          <article><small>Training completed</small><strong>{dashboard.summary.completed} / {dashboard.summary.totalAssigned}</strong><span>Assigned modules</span></article>
          <article><small>Assessments passed</small><strong>{assessmentSummary.passed} / {assessmentSummary.total}</strong><span>Available assessments</span></article>
          <article><small>Certificates earned</small><strong>{certificatesEarned}</strong><span>Issued credentials</span></article>
        </section>
        <section className="trainee-progress-records" aria-labelledby="training-progress-title"><div className="trainee-progress-section-heading"><p>Training records</p><h2 id="training-progress-title">Training Progress</h2></div><div className="trainee-progress-grid">{records.map((record) => <TrainingProgressCard key={record.assignment.assignmentId} record={record} />)}</div></section>
      </>}
    </div>
  );
}
