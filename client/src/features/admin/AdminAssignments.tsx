import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../../services/api/request';
import './admin-assignments.css';

type AssignmentStatus = 'active' | 'cancelled';

type Assignment = {
  id: number;
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
  status: AssignmentStatus;
  assignedAt: string;
  dueAt: string | null;
  assignedByFirstName: string;
  assignedByLastName: string;
  progressPercentage: number;
  completedAt: string | null;
  progressStage: string;
};

type TraineeOption = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
};

type ModuleOption = {
  id: number;
  title: string;
  slug: string;
  description: string;
};

type AssignmentsData = {
  summary: {
    total: number;
    active: number;
    required: number;
    optional: number;
    completed: number;
  };
  trainees: TraineeOption[];
  modules: ModuleOption[];
  assignments: Assignment[];
};

type AssignmentForm = {
  traineeId: string;
  trainingModuleId: string;
  required: boolean;
};

const emptyForm: AssignmentForm = {
  traineeId: '',
  trainingModuleId: '',
  required: true,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function AdminAssignments() {
  const [data, setData] = useState<AssignmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [requirementFilter, setRequirementFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest<AssignmentsData>('/admin/assignments'));
    } catch (requestError) {
      if (!(requestError instanceof ApiError && requestError.status === 401)) {
        setError('We could not load training assignments. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void apiRequest<AssignmentsData>('/admin/assignments')
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((requestError) => {
        if (
          !cancelled &&
          !(requestError instanceof ApiError && requestError.status === 401)
        ) {
          setError('We could not load training assignments. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assignments = useMemo(
    () =>
      data?.assignments.filter((assignment) => {
        const query = search.trim().toLowerCase();
        const searchable =
          `${assignment.traineeFirstName} ${assignment.traineeLastName} ${assignment.traineeEmail} ${assignment.trainingModuleTitle} ${assignment.traineeJobRole ?? ''}`.toLowerCase();
        return (
          (!query || searchable.includes(query)) &&
          (moduleFilter === 'all' ||
            String(assignment.trainingModuleId) === moduleFilter) &&
          (requirementFilter === 'all' ||
            String(assignment.required) === requirementFilter) &&
          (statusFilter === 'all' || assignment.status === statusFilter)
        );
      }) ?? [],
    [data, moduleFilter, requirementFilter, search, statusFilter],
  );
  const hasActiveFilters =
    search.trim() !== '' ||
    moduleFilter !== 'all' ||
    requirementFilter !== 'all' ||
    statusFilter !== 'all';

  function openDialog() {
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await apiRequest<{ id: number }>('/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({
          traineeId: Number(form.traineeId),
          trainingModuleId: Number(form.trainingModuleId),
          required: form.required,
        }),
      });
      setDialogOpen(false);
      await load();
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : 'The training assignment could not be created.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-assignments">
        <div className="admin-assignments-state">
          <h1>Loading training assignments</h1>
          <p>Preparing trainee and module assignment information…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-assignments">
        <div className="admin-assignments-state">
          <h1>Assignments unavailable</h1>
          <p>{error}</p>
          <button
            className="admin-assignments-primary"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-assignments">
      <header className="admin-assignments-header">
        <div>
          <p className="admin-assignments-eyebrow">Training administration</p>
          <h1>Training assignments</h1>
          <p>
            Assign active training modules to trainees and track required or
            optional learning.
          </p>
        </div>
        <button className="admin-assignments-primary" onClick={openDialog}>
          ＋ Assign training
        </button>
      </header>

      <section
        className="admin-assignments-stats"
        aria-label="Training assignment summary"
      >
        <article>
          <span>▤</span>
          <div>
            <strong>{data.summary.active}</strong>
            <p>Active assignments</p>
          </div>
        </article>
        <article>
          <span>!</span>
          <div>
            <strong>{data.summary.required}</strong>
            <p>Required</p>
          </div>
        </article>
        <article>
          <span>○</span>
          <div>
            <strong>{data.summary.optional}</strong>
            <p>Optional</p>
          </div>
        </article>
        <article>
          <span>✓</span>
          <div>
            <strong>{data.summary.completed}</strong>
            <p>Completed</p>
          </div>
        </article>
      </section>

      <section className="admin-assignments-panel">
        <div
          className={`admin-assignments-toolbar${hasActiveFilters ? ' has-active-filters' : ''}`}
        >
          <label className="admin-assignments-search">
            <span>⌕</span>
            <input
              aria-label="Search assignments"
              placeholder="Search trainee, email or training"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter by training module"
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
          >
            <option value="all">All modules</option>
            {data.modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by assignment requirement"
            value={requirementFilter}
            onChange={(event) => setRequirementFilter(event.target.value)}
          >
            <option value="all">Required &amp; optional</option>
            <option value="true">Required</option>
            <option value="false">Optional</option>
          </select>
          <select
            aria-label="Filter by assignment status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              className="admin-assignments-clear"
              onClick={() => {
                setSearch('');
                setModuleFilter('all');
                setRequirementFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="admin-assignments-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Training module</th>
                <th>Requirement</th>
                <th>Assignment status</th>
                <th>Progress</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <strong>
                      {assignment.traineeFirstName} {assignment.traineeLastName}
                    </strong>
                    <small>{assignment.traineeEmail}</small>
                    <small>
                      {assignment.traineeJobRole ?? 'Job role not assigned'}
                      {!assignment.traineeIsActive ? ' · Inactive account' : ''}
                    </small>
                  </td>
                  <td>
                    <strong>{assignment.trainingModuleTitle}</strong>
                    <small>{assignment.trainingModuleSlug}</small>
                  </td>
                  <td>
                    <span
                      className={`admin-assignment-requirement ${assignment.required ? 'required' : 'optional'}`}
                    >
                      {assignment.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-assignment-status ${assignment.status}`}
                    >
                      {assignment.status === 'active' ? 'Active' : 'Cancelled'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-assignment-progress">
                      <span>
                        <i
                          style={{ width: `${assignment.progressPercentage}%` }}
                        />
                      </span>
                      <b>{assignment.progressPercentage}%</b>
                    </div>
                    <small className="admin-assignment-stage">
                      {assignment.progressStage}
                    </small>
                  </td>
                  <td>
                    <span>{formatDate(assignment.assignedAt)}</span>
                    <small>
                      by {assignment.assignedByFirstName}{' '}
                      {assignment.assignedByLastName}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 ? (
            <p className="admin-assignments-empty">
              No training assignments match these filters.
            </p>
          ) : null}
        </div>
      </section>

      <section className="admin-assignments-note">
        <div>
          <span>i</span>
          <div>
            <strong>Assignment rules</strong>
            <p>
              Each trainee can receive a training module only once. Required
              assignments contribute to certification requirements; optional
              assignments do not block certification.
            </p>
          </div>
        </div>
      </section>

      {dialogOpen ? (
        <div
          className="admin-assignments-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <aside
            className="admin-assignments-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-form-title"
          >
            <button
              className="admin-assignments-close"
              aria-label="Close"
              onClick={() => setDialogOpen(false)}
            >
              ×
            </button>
            <p className="admin-assignments-eyebrow">New assignment</p>
            <h2 id="assignment-form-title">Assign training</h2>
            <p>Create a database-backed training assignment for one trainee.</p>

            <div className="admin-assignments-info">
              <strong>Create training assignment</strong>
              <span>
                Existing trainee/module combinations cannot be assigned twice.
              </span>
            </div>

            <form onSubmit={save}>
              <label>
                Trainee
                <select
                  aria-label="Trainee"
                  required
                  value={form.traineeId}
                  onChange={(event) =>
                    setForm({ ...form, traineeId: event.target.value })
                  }
                >
                  <option value="">Select trainee</option>
                  {data.trainees.map((trainee) => (
                    <option key={trainee.id} value={trainee.id}>
                      {trainee.firstName} {trainee.lastName}
                      {trainee.jobRole ? ` — ${trainee.jobRole}` : ''}
                      {!trainee.isActive ? ' — inactive' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Training module
                <select
                  aria-label="Training module"
                  required
                  value={form.trainingModuleId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      trainingModuleId: event.target.value,
                    })
                  }
                >
                  <option value="">Select active module</option>
                  {data.modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend>Assignment requirement</legend>
                <label className="admin-assignment-choice">
                  <input
                    type="radio"
                    name="assignment-requirement"
                    checked={form.required}
                    onChange={() => setForm({ ...form, required: true })}
                  />
                  <span>
                    <strong>Required training</strong>
                    <small>
                      Must be completed for the existing certification rules.
                    </small>
                  </span>
                </label>
                <label className="admin-assignment-choice">
                  <input
                    type="radio"
                    name="assignment-requirement"
                    checked={!form.required}
                    onChange={() => setForm({ ...form, required: false })}
                  />
                  <span>
                    <strong>Optional training</strong>
                    <small>
                      Available to the trainee but does not block certification.
                    </small>
                  </span>
                </label>
              </fieldset>

              {formError ? (
                <p className="admin-assignments-form-error" role="alert">
                  {formError}
                </p>
              ) : null}

              <button className="admin-assignments-primary" disabled={saving}>
                {saving ? 'Assigning…' : 'Assign training'}
              </button>
              <button
                type="button"
                className="admin-assignments-secondary"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
