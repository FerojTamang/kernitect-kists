import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import type { DashboardAssignment, TraineeDashboardData } from '../trainee/dashboard.types';
import './trainee-assessments.css';

interface AssessmentAttempt {
  attemptNumber: number;
  scorePercentage: number;
  passPercentage: number;
  passed: boolean;
  submittedAt: string;
}

interface AssessmentDetail {
  assignmentId: number;
  assessment: { title: string; description: string; passPercentage: number };
  questions: unknown[];
  latestAttempt: AssessmentAttempt | null;
}

interface ScenarioDetail {
  progress: { completed: boolean };
}

interface AssessmentRecord {
  assignment: DashboardAssignment;
  detail: AssessmentDetail | null;
  scenarioComplete: boolean;
  lockCode: string | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

async function assessmentRecord(assignment: DashboardAssignment): Promise<AssessmentRecord | null> {
  let scenarioComplete = false;
  try {
    const scenario = await apiRequest<ScenarioDetail>(`/trainee/training/${assignment.assignmentId}/scenario`);
    scenarioComplete = scenario.progress.completed;
  } catch (error) {
    if (!(error instanceof ApiError) || ![403, 404, 409].includes(error.status)) throw error;
  }

  try {
    const detail = await apiRequest<AssessmentDetail>(`/trainee/training/${assignment.assignmentId}/assessment`);
    return { assignment, detail, scenarioComplete, lockCode: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (error instanceof ApiError && error.status === 409) {
      return { assignment, detail: null, scenarioComplete, lockCode: error.code ?? 'ASSESSMENT_LOCKED' };
    }
    throw error;
  }
}

function AssessmentCard({ record }: { record: AssessmentRecord }) {
  const { assignment, detail } = record;
  const attempt = detail?.latestAttempt ?? null;
  const learningComplete = assignment.learningTotalSections > 0 && assignment.learningCompletedSections === assignment.learningTotalSections;
  const state = attempt?.passed ? 'passed' : detail ? attempt ? 'not-passed' : 'ready' : 'locked';
  const label = state === 'passed' ? 'Passed' : state === 'not-passed' ? 'Not passed' : state === 'ready' ? 'Ready to start' : 'Locked';
  const title = detail?.assessment.title ?? `${assignment.title} Final Assessment`;

  return <article className={`assessment-centre-card ${state}`}>
    <header><div><span className={`assessment-centre-status ${state}`}>{label}</span><p>{assignment.title}</p><h3>{title}</h3></div></header>
    <p className="assessment-centre-description">{detail?.assessment.description ?? 'Complete the required training stages before starting this assessment.'}</p>
    {detail ? <dl className="assessment-centre-metadata">
      <div><dt>Questions</dt><dd>{detail.questions.length}</dd></div>
      <div><dt>Pass mark</dt><dd>{detail.assessment.passPercentage}%</dd></div>
      {attempt ? <><div><dt>Latest score</dt><dd>{attempt.scorePercentage}%</dd></div><div><dt>Attempt</dt><dd>{attempt.attemptNumber}</dd></div><div><dt>Completed</dt><dd>{formatDate(attempt.submittedAt)}</dd></div></> : null}
    </dl> : null}
    <ul className="assessment-centre-prerequisites" aria-label={`${title} prerequisites`}>
      <li><span className={learningComplete ? 'complete' : ''} aria-hidden="true">{learningComplete ? '✓' : '○'}</span><strong>Learning</strong><em>{learningComplete ? 'Complete' : 'Incomplete'}</em></li>
      <li><span className={record.scenarioComplete ? 'complete' : ''} aria-hidden="true">{record.scenarioComplete ? '✓' : '○'}</span><strong>Interactive scenario</strong><em>{record.scenarioComplete ? 'Complete' : 'Incomplete'}</em></li>
    </ul>
    <footer>
      <Link className="assessment-centre-action secondary" to={`/trainee/training/${assignment.assignmentId}`}>{state === 'locked' ? 'Continue Training' : 'Review Training'}</Link>
      {state === 'ready' ? <Link className="assessment-centre-action primary" to={`/trainee/training/${assignment.assignmentId}/assessment`}>Start Assessment</Link> : null}
      {state === 'not-passed' ? <Link className="assessment-centre-action primary" to={`/trainee/training/${assignment.assignmentId}/assessment`}>Retry Assessment</Link> : null}
      {state === 'passed' ? <Link className="assessment-centre-action primary" to={`/trainee/training/${assignment.assignmentId}/assessment`}>View Result</Link> : null}
    </footer>
  </article>;
}

export function TraineeAssessments() {
  const [records, setRecords] = useState<AssessmentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const dashboard = await apiRequest<TraineeDashboardData>('/trainee/dashboard');
      const results = await Promise.all(dashboard.assignedTraining.map(assessmentRecord));
      setRecords(results.filter((record): record is AssessmentRecord => record !== null));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) return;
      setError('We could not load your assessments. Please try again.');
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const summary = useMemo(() => ({ total: records?.length ?? 0, passed: records?.filter((record) => record.detail?.latestAttempt?.passed).length ?? 0, available: records?.filter((record) => record.detail && !record.detail.latestAttempt?.passed).length ?? 0 }), [records]);

  if (error) return <section className="assessment-centre-state card" role="alert"><h1>Assessments unavailable</h1><p>{error}</p><button onClick={() => void load()}>Try again</button></section>;
  if (!records) return <section className="assessment-centre-state card" role="status"><h1>Loading your assessments</h1><p>Preparing your assessment record…</p></section>;
  return <div className="assessment-centre-page">
    <header className="assessment-centre-header"><p>My Training / Assessments</p><h1>My Assessments</h1><span>View your available assessments, completion status and previous results.</span></header>
    <section className="assessment-centre-summary" aria-label="Assessment summary"><article><small>Assessments</small><strong>{summary.total}</strong><span>Assigned to you</span></article><article><small>Passed</small><strong>{summary.passed}</strong><span>Completed successfully</span></article><article><small>Available</small><strong>{summary.available}</strong><span>Ready to start or retry</span></article></section>
    {records.length ? <section className="assessment-centre-list" aria-labelledby="assessment-list-title"><div><p>Assessment record</p><h2 id="assessment-list-title">Your Assessments</h2></div>{records.map((record) => <AssessmentCard key={record.assignment.assignmentId} record={record} />)}</section> : <section className="assessment-centre-empty card"><span aria-hidden="true">◇</span><h2>No assessments assigned</h2><p>Your assigned assessments will appear here after training is allocated to you.</p><Link className="assessment-centre-action primary" to="/trainee/training">Go to My Training</Link></section>}
  </div>;
}
