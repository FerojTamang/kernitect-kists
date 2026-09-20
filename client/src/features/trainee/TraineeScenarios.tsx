import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import warehouseSceneImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import { ApiError, apiRequest } from '../../services/api/request';
import type { DashboardAssignment, TraineeDashboardData } from './dashboard.types';
import './trainee-scenarios.css';

interface ScenarioDetail {
  assignmentId: number;
  scenario: { title: string; description: string };
  progress: { completedHazards: number; totalHazards: number; completed: boolean };
}

interface ScenarioRecord { assignment: DashboardAssignment; detail: ScenarioDetail | null }

async function loadRecord(assignment: DashboardAssignment): Promise<ScenarioRecord | null> {
  try {
    return { assignment, detail: await apiRequest<ScenarioDetail>(`/trainee/training/${assignment.assignmentId}/scenario`) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (error instanceof ApiError && error.status === 409 && error.code === 'SCENARIO_LOCKED') return { assignment, detail: null };
    throw error;
  }
}

function ScenarioCard({ record }: { record: ScenarioRecord }) {
  const { assignment, detail } = record;
  const learningComplete = assignment.learningTotalSections > 0 && assignment.learningCompletedSections >= assignment.learningTotalSections;
  const state = !detail ? 'locked' : detail.progress.completed ? 'completed' : detail.progress.completedHazards > 0 ? 'in-progress' : 'ready';
  const status = state === 'in-progress' ? 'In progress' : state === 'completed' ? 'Completed' : state === 'ready' ? 'Ready' : 'Locked';
  const action = state === 'locked' ? 'Continue Learning' : state === 'completed' ? 'Review Scenario' : state === 'in-progress' ? 'Continue Scenario' : 'Start Scenario';
  const destination = state === 'locked' ? `/trainee/training/${assignment.assignmentId}` : `/trainee/training/${assignment.assignmentId}/scenario`;
  const title = detail?.scenario.title ?? 'Interactive Warehouse Safety Scenario';
  return <article className="scenario-library-card">
    <img className="scenario-library-image" src={warehouseSceneImage} alt="Warehouse worker preparing for an interactive manual handling scenario" />
    <div className="scenario-library-body">
      <div className="scenario-library-heading-row"><span className="scenario-library-kicker">{assignment.title}</span><span className={`scenario-library-status ${state}`}>{status}</span></div>
      <h2>{title}</h2>
      <p>{detail?.scenario.description ?? 'Complete the required learning content before putting your safety knowledge into practice.'}</p>
      <ul className="scenario-library-meta" aria-label={`${title} details`}>
        {detail ? <li>{detail.progress.completedHazards} of {detail.progress.totalHazards} safety points completed</li> : null}
        <li>360° interactive scenario</li>
        <li className={learningComplete ? 'complete' : ''}>{learningComplete ? 'Learning complete' : `${assignment.learningCompletedSections} of ${assignment.learningTotalSections} learning sections complete`}</li>
      </ul>
      {state === 'locked' ? <p className="scenario-library-prerequisite">Complete all required learning sections and knowledge checks to unlock this scenario.</p> : null}
      <Link className={`scenario-library-action ${state === 'locked' ? 'secondary' : 'primary'}`} to={destination}>{action} <span aria-hidden="true">→</span></Link>
    </div>
  </article>;
}

export function TraineeScenarios() {
  const [records, setRecords] = useState<ScenarioRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadScenarios = useCallback(async () => {
    setError(null);
    try {
      const dashboard = await apiRequest<TraineeDashboardData>('/trainee/dashboard');
      const results = await Promise.all(dashboard.assignedTraining.map(loadRecord));
      setRecords(results.filter((record): record is ScenarioRecord => record !== null));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) return;
      setError('We could not load your assigned scenarios. Please try again.');
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadScenarios(), 0); return () => window.clearTimeout(timer); }, [loadScenarios]);
  if (error) return <ScenarioLibraryState title="Scenarios unavailable" detail={error}><button className="scenario-library-action primary" type="button" onClick={() => void loadScenarios()}>Try again <span aria-hidden="true">↻</span></button></ScenarioLibraryState>;
  if (!records) return <ScenarioLibraryState title="Loading your scenarios" detail="Preparing your interactive safety activities…" loading />;
  return <div className="scenario-library-page">
    <header className="scenario-library-header"><div><p className="eyebrow">My Training / Scenarios</p><h1>Safety Scenarios</h1><p className="lead">Practise workplace safety decisions in interactive training environments.</p></div><Link className="secondary-link" to="/trainee/training">← My Training</Link></header>
    <section className="scenario-library-intro" aria-label="Scenario access"><span className="scenario-library-intro-icon" aria-hidden="true">◇</span><div><strong>Scenario access</strong><p>Complete the required learning content before starting a scenario.</p></div></section>
    <section className="scenario-library-list" aria-label="Assigned scenarios">{records.length ? records.map((record) => <ScenarioCard key={record.assignment.assignmentId} record={record} />) : <div className="scenario-library-empty card"><h2>No scenarios assigned</h2><p>Your assigned interactive training scenarios will appear here.</p></div>}</section>
  </div>;
}

function ScenarioLibraryState({ title, detail, loading = false, children }: { title: string; detail: string; loading?: boolean; children?: ReactNode }) {
  return <section className="scenario-library-state card" role={loading ? 'status' : 'alert'}><p className="eyebrow">KISTS / Scenarios</p><h1>{title}</h1><p>{detail}</p>{children}</section>;
}
