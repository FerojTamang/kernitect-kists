import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../../services/api/request';
import './admin-progress.css';

type AssignmentStatus = 'active' | 'cancelled';

type ProgressRecord = {
  assignmentId: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  traineeJobRole: string | null;
  traineeIsActive: boolean;
  trainingModuleId: number;
  trainingModuleTitle: string;
  trainingModuleSlug: string;
  required: boolean;
  assignmentStatus: AssignmentStatus;
  progressPercentage: number;
  progressStage: string;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  learningCompleted: number;
  learningTotal: number;
  scenarioCompleted: number;
  scenarioTotal: number;
  assessmentTotal: number;
  assessmentPassed: number;
  assessmentAttempts: number;
  latestAssessmentAttemptNumber: number | null;
  latestAssessmentScore: number | null;
  latestAssessmentPassed: boolean | null;
  latestAssessmentSubmittedAt: string | null;
  certificateIssued: boolean;
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
};

type ProgressData = {
  summary: {
    activeAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    notStartedAssignments: number;
    assessmentPassedAssignments: number;
    certificatesIssued: number;
  };
  modules: Array<{ id: number; title: string; slug: string }>;
  records: ProgressRecord[];
};

type CompletionFilter = 'all' | 'complete' | 'in-progress' | 'not-started';
type AssessmentFilter = 'all' | 'passed' | 'not-passed' | 'not-attempted';
type CertificateFilter = 'all' | 'issued' | 'pending';

function stageLabel(completed: number, total: number) {
  if (total === 0) return 'Not required';
  if (completed >= total) return 'Complete';
  if (completed > 0) return `${completed} of ${total}`;
  return 'Not started';
}

function stageState(completed: number, total: number) {
  if (total === 0) return 'not-required';
  if (completed >= total) return 'complete';
  if (completed > 0) return 'in-progress';
  return 'not-started';
}

function StageBadge({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  return (
    <span className={badgeClass(stageState(completed, total))}>
      {stageLabel(completed, total)}
    </span>
  );
}

function assessmentLabel(record: ProgressRecord) {
  if (record.assessmentTotal === 0) return 'Not required';
  if (record.assessmentAttempts === 0) return 'Not attempted';
  if (record.assessmentPassed === record.assessmentTotal) return 'Passed';
  return 'Not passed';
}

function formatScore(score: number | null) {
  return score === null ? '—' : `${score}%`;
}

function completionState(
  record: ProgressRecord,
): Exclude<CompletionFilter, 'all'> {
  if (record.progressStage === 'Completed') return 'complete';
  if (record.progressStage !== 'Not started') return 'in-progress';
  return 'not-started';
}

function assessmentState(
  record: ProgressRecord,
): Exclude<AssessmentFilter, 'all'> | 'not-required' {
  if (record.assessmentTotal === 0) return 'not-required';
  if (record.assessmentAttempts === 0) return 'not-attempted';
  if (record.assessmentPassed === record.assessmentTotal) return 'passed';
  return 'not-passed';
}

function badgeClass(value: string) {
  return `admin-progress-badge admin-progress-badge--${value}`;
}

function ProgressSummary({ data }: { data: ProgressData }) {
  return (
    <section className="admin-progress-summary" aria-label="Progress summary">
      <article>
        <span>Active assignments</span>
        <strong>{data.summary.activeAssignments}</strong>
        <small>{data.summary.notStartedAssignments} not started</small>
      </article>
      <article>
        <span>Completed training</span>
        <strong>{data.summary.completedAssignments}</strong>
        <small>{data.summary.inProgressAssignments} in progress</small>
      </article>
      <article>
        <span>Assessments passed</span>
        <strong>{data.summary.assessmentPassedAssignments}</strong>
        <small>Assignment-level passes</small>
      </article>
      <article>
        <span>Certificates issued</span>
        <strong>{data.summary.certificatesIssued}</strong>
        <small>Current eligible certificates</small>
      </article>
    </section>
  );
}

function ProgressRow({ record }: { record: ProgressRecord }) {
  const completion = completionState(record);
  const assessment = assessmentState(record);

  return (
    <tr>
      <td>
        <strong>
          {record.traineeFirstName} {record.traineeLastName}
        </strong>
        <small>{record.traineeEmail}</small>
        <small>{record.traineeJobRole ?? 'Job role not assigned'}</small>
      </td>
      <td>
        <strong>{record.trainingModuleTitle}</strong>
        <small>{record.required ? 'Required' : 'Optional'} assignment</small>
      </td>
      <td>
        <StageBadge
          completed={record.learningCompleted}
          total={record.learningTotal}
        />
      </td>
      <td>
        <StageBadge
          completed={record.scenarioCompleted}
          total={record.scenarioTotal}
        />
      </td>
      <td>
        <span className={badgeClass(assessment)}>
          {assessmentLabel(record)}
        </span>
        <small>
          {record.assessmentAttempts} attempt
          {record.assessmentAttempts === 1 ? '' : 's'}
          {' · '}latest {formatScore(record.latestAssessmentScore)}
        </small>
      </td>
      <td>
        <div className="admin-progress-meter">
          <span aria-hidden="true">
            <i style={{ width: `${record.progressPercentage}%` }} />
          </span>
          <b>{record.progressPercentage}%</b>
        </div>
        <span className={badgeClass(completion)}>
          {completion === 'complete'
            ? 'Complete'
            : completion === 'in-progress'
              ? 'In progress'
              : 'Not started'}
        </span>
      </td>
      <td>
        <span
          className={badgeClass(
            record.certificateIssued ? 'issued' : 'pending',
          )}
        >
          {record.certificateIssued ? 'Issued' : 'Pending'}
        </span>
        {record.certificateNumber ? (
          <small className="admin-progress-certificate-id">
            {record.certificateNumber}
          </small>
        ) : null}
      </td>
    </tr>
  );
}

function ProgressCard({ record }: { record: ProgressRecord }) {
  const completion = completionState(record);
  const assessment = assessmentState(record);

  return (
    <article className="admin-progress-card">
      <header>
        <div>
          <strong>
            {record.traineeFirstName} {record.traineeLastName}
          </strong>
          <small>{record.traineeEmail}</small>
        </div>
        <span className={badgeClass(completion)}>
          {completion === 'complete'
            ? 'Complete'
            : completion === 'in-progress'
              ? 'In progress'
              : 'Not started'}
        </span>
      </header>

      <div className="admin-progress-card-training">
        <strong>{record.trainingModuleTitle}</strong>
        <span>{record.required ? 'Required' : 'Optional'}</span>
      </div>

      <dl>
        <div>
          <dt>Learning</dt>
          <dd>
            <StageBadge
              completed={record.learningCompleted}
              total={record.learningTotal}
            />
          </dd>
        </div>
        <div>
          <dt>360° scenario</dt>
          <dd>
            <StageBadge
              completed={record.scenarioCompleted}
              total={record.scenarioTotal}
            />
          </dd>
        </div>
        <div>
          <dt>Assessment</dt>
          <dd>
            <span className={badgeClass(assessment)}>
              {assessmentLabel(record)}
            </span>
            <small>
              {formatScore(record.latestAssessmentScore)} latest score
            </small>
          </dd>
        </div>
        <div>
          <dt>Certificate</dt>
          <dd>
            <span
              className={badgeClass(
                record.certificateIssued ? 'issued' : 'pending',
              )}
            >
              {record.certificateIssued ? 'Issued' : 'Pending'}
            </span>
          </dd>
        </div>
      </dl>

      <div className="admin-progress-card-meter">
        <span>
          <i style={{ width: `${record.progressPercentage}%` }} />
        </span>
        <strong>{record.progressPercentage}% overall</strong>
      </div>
    </article>
  );
}

export function AdminProgress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [moduleId, setModuleId] = useState('all');
  const [completion, setCompletion] = useState<CompletionFilter>('all');
  const [assessment, setAssessment] = useState<AssessmentFilter>('all');
  const [certificate, setCertificate] = useState<CertificateFilter>('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest<ProgressData>('/admin/progress'));
    } catch (requestError) {
      if (!(requestError instanceof ApiError && requestError.status === 401)) {
        setError(
          'We could not load trainee progress and results. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void apiRequest<ProgressData>('/admin/progress')
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((requestError) => {
        if (
          !cancelled &&
          !(requestError instanceof ApiError && requestError.status === 401)
        ) {
          setError(
            'We could not load trainee progress and results. Please try again.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLocaleLowerCase();

    return data.records.filter((record) => {
      const matchesSearch =
        !term ||
        [
          record.traineeFirstName,
          record.traineeLastName,
          record.traineeEmail,
          record.traineeJobRole ?? '',
          record.trainingModuleTitle,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(term);
      const matchesModule =
        moduleId === 'all' || record.trainingModuleId === Number(moduleId);
      const matchesCompletion =
        completion === 'all' || completionState(record) === completion;
      const matchesAssessment =
        assessment === 'all' || assessmentState(record) === assessment;
      const matchesCertificate =
        certificate === 'all' ||
        (certificate === 'issued'
          ? record.certificateIssued
          : !record.certificateIssued);

      return (
        matchesSearch &&
        matchesModule &&
        matchesCompletion &&
        matchesAssessment &&
        matchesCertificate
      );
    });
  }, [assessment, certificate, completion, data, moduleId, search]);

  const filtersActive =
    search.trim() !== '' ||
    moduleId !== 'all' ||
    completion !== 'all' ||
    assessment !== 'all' ||
    certificate !== 'all';

  function resetFilters() {
    setSearch('');
    setModuleId('all');
    setCompletion('all');
    setAssessment('all');
    setCertificate('all');
  }

  if (loading) {
    return (
      <div className="admin-progress">
        <div className="admin-progress-state">
          <h1>Loading progress &amp; results</h1>
          <p>Preparing trainee training records…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-progress">
        <div className="admin-progress-state">
          <h1>Progress unavailable</h1>
          <p>{error}</p>
          <button
            className="admin-progress-primary"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-progress">
      <header className="admin-progress-header">
        <div>
          <p className="admin-progress-eyebrow">Training monitoring</p>
          <h1>Progress &amp; results</h1>
          <p>
            Review each trainee assignment from learning through the 360°
            scenario, assessment and certification.
          </p>
        </div>
        <div className="admin-progress-readonly">
          <strong>Read-only monitoring</strong>
        </div>
      </header>

      <ProgressSummary data={data} />

      <section className="admin-progress-filters" aria-label="Progress filters">
        <label className="admin-progress-search">
          <span>Search trainees</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, job role or training"
          />
        </label>
        <label>
          <span>Training module</span>
          <select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
          >
            <option value="all">All modules</option>
            {data.modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Completion</span>
          <select
            value={completion}
            onChange={(event) =>
              setCompletion(event.target.value as CompletionFilter)
            }
          >
            <option value="all">All completion states</option>
            <option value="complete">Complete</option>
            <option value="in-progress">In progress</option>
            <option value="not-started">Not started</option>
          </select>
        </label>
        <label>
          <span>Assessment</span>
          <select
            value={assessment}
            onChange={(event) =>
              setAssessment(event.target.value as AssessmentFilter)
            }
          >
            <option value="all">All assessment states</option>
            <option value="passed">Passed</option>
            <option value="not-passed">Not passed</option>
            <option value="not-attempted">Not attempted</option>
          </select>
        </label>
        <label>
          <span>Certificate</span>
          <select
            value={certificate}
            onChange={(event) =>
              setCertificate(event.target.value as CertificateFilter)
            }
          >
            <option value="all">All certificate states</option>
            <option value="issued">Issued</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <div className="admin-progress-filter-meta">
          <span>
            Showing <strong>{filteredRecords.length}</strong> of{' '}
            <strong>{data.records.length}</strong> assignments
          </span>
          {filtersActive ? (
            <button type="button" onClick={resetFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section
        className="admin-progress-panel"
        aria-label="Trainee progress records"
      >
        <div className="admin-progress-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Training</th>
                <th>Learning</th>
                <th>360° scenario</th>
                <th>Assessment</th>
                <th>Overall</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <ProgressRow key={record.assignmentId} record={record} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-progress-cards">
          {filteredRecords.map((record) => (
            <ProgressCard key={record.assignmentId} record={record} />
          ))}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="admin-progress-empty">
            <strong>No matching progress records</strong>
            <p>Try changing the search or filters to see more assignments.</p>
            {filtersActive ? (
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
