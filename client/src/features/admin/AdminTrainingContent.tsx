import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import { DashboardIcon } from '../trainee/DashboardIcon';
import manualHandlingImage from '../../assets/images/dashboard/manual-handling.jpg';
import forkliftImage from '../../assets/images/dashboard/forklift-pedestrian-safety.jpg';
import fallbackImage from '../../assets/images/dashboard/dashboard-hero.jpg';
import './admin-training-content.css';

type Summary = {
  id: number;
  title: string;
  slug: string;
  description: string;
  isActive: boolean;
  learningSectionCount: number;
  scenarioCount: number;
  hazardCount: number;
  assessmentCount: number;
  questionCount: number;
  passPercentage: number | null;
  activeAssignmentCount: number;
};
type Library = {
  summary: {
    totalModules: number;
    activeModules: number;
    draftModules: number;
    assessmentQuestions: number;
  };
  modules: Summary[];
};
type Option = {
  id?: number;
  optionText: string;
  isCorrect: boolean;
  sequenceOrder?: number;
};
type Question = {
  id: number;
  questionText: string;
  sequenceOrder: number;
  options: Option[];
};
type Detail = Summary & {
  learningSections: Array<{
    id: number;
    title: string;
    contentType: string;
    sequenceOrder: number;
    isActive: boolean;
  }>;
  scenarios: Array<{
    id: number;
    title: string;
    description: string;
    isActive: boolean;
    sequenceOrder: number;
    hazardCount: number;
  }>;
  assessments: Array<{
    id: number;
    title: string;
    description: string;
    passPercentage: number;
    isActive: boolean;
    hasAttempts: boolean;
    questions: Question[];
  }>;
};
const tabs = [
  'overview',
  'learning',
  'scenario',
  'assessment',
  'settings',
] as const;
type Tab = (typeof tabs)[number];

export function AdminTrainingContent() {
  const { moduleId } = useParams();
  return moduleId ? (
    <ModuleManager moduleId={Number(moduleId)} />
  ) : (
    <TrainingLibrary />
  );
}

function TrainingLibrary() {
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void apiRequest<Library>('/admin/training-content')
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError('Training content could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const result = await apiRequest<{ id: number }>(
        '/admin/training-content',
        { method: 'POST', body: JSON.stringify(form) },
      );
      navigate(`/admin/training/${result.id}`);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'The module could not be created.',
      );
    }
  }
  if (error)
    return <State title="Training content unavailable" detail={error} />;
  if (!data)
    return (
      <State
        title="Loading training content"
        detail="Preparing the training library…"
      />
    );
  const modules = data.modules.filter((module) =>
    `${module.title} ${module.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="admin-training">
      <header className="admin-training-header">
        <div>
          <p className="admin-training-eyebrow">Training management</p>
          <h1>Training content</h1>
          <p>Manage learning modules, interactive scenarios and assessments.</p>
        </div>
        <button
          className="admin-training-primary admin-create-module"
          onClick={() => setCreating(true)}
        >
          <span aria-hidden="true">+</span> Create training module
        </button>
      </header>
      <section
        className="admin-training-summary"
        aria-label="Training content summary"
      >
        <Metric
          icon="Training content"
          tone="purple"
          label="Total modules"
          value={data.summary.totalModules}
        />
        <Metric
          icon="check"
          tone="green"
          label="Active modules"
          value={data.summary.activeModules}
        />
        <Metric
          icon="clock"
          tone="orange"
          label="Draft modules"
          value={data.summary.draftModules}
        />
        <Metric
          icon="Assessments"
          tone="lavender"
          label="Assessment questions"
          value={data.summary.assessmentQuestions}
        />
      </section>
      <section className="admin-training-library">
        <div className="admin-training-section-title">
          <div>
            <h2>Training library</h2>
            <p>Browse and manage all training modules in the system.</p>
          </div>
          <label className="admin-training-search">
            <span className="sr-only">Search modules</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules..."
            />
          </label>
        </div>
        <div className="admin-training-grid">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
        {modules.length === 0 ? (
          <Empty text="No modules match your search." />
        ) : null}
      </section>
      {creating ? (
        <div
          className="admin-training-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreating(false);
          }}
        >
          <form
            className="admin-training-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-module-title"
            onSubmit={create}
          >
            <button
              type="button"
              className="admin-training-close"
              aria-label="Close"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
            <p className="admin-training-eyebrow">New module</p>
            <h2 id="create-module-title">Create training module</h2>
            <p>
              New modules are saved as inactive drafts and are not assigned
              automatically.
            </p>
            <label>
              Module title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            {formError ? (
              <p className="admin-training-error" role="alert">
                {formError}
              </p>
            ) : null}
            <button className="admin-training-primary">Create module</button>
            <button
              type="button"
              className="admin-training-secondary"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ModuleManager({ moduleId }: { moduleId: number }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get('tab');
  const tab: Tab = tabs.includes(selected as Tab)
    ? (selected as Tab)
    : 'overview';
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{
    assessmentId: number;
    question: Question | null;
  } | null>(null);
  async function load() {
    try {
      setDetail(
        await apiRequest<Detail>(`/admin/training-content/${moduleId}`),
      );
      setError('');
    } catch {
      setError('This training module could not be loaded.');
    }
  }
  useEffect(() => {
    let active = true;
    void apiRequest<Detail>(`/admin/training-content/${moduleId}`)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch(() => {
        if (active) setError('This training module could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [moduleId]);
  if (error)
    return <State title="Training module unavailable" detail={error} />;
  if (!detail)
    return (
      <State
        title="Loading training module"
        detail="Preparing module content…"
      />
    );
  async function saveMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/admin/training-content/${moduleId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          isActive: form.get('isActive') === 'on',
        }),
      });
      await load();
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'The module could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeQuestion(assessmentId: number, questionId: number) {
    if (!window.confirm('Remove this question? This cannot be undone.')) return;
    try {
      await apiRequest(
        `/admin/training-content/${moduleId}/assessments/${assessmentId}/questions/${questionId}`,
        { method: 'DELETE', body: '{}' },
      );
      await load();
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'The question could not be removed.',
      );
    }
  }
  return (
    <div className="admin-training">
      <Link className="admin-training-back" to="/admin/training">
        ← Back to training library
      </Link>
      <header className="admin-training-header compact">
        <div>
          <p className="admin-training-eyebrow">
            Training management / {detail.slug.replaceAll('-', ' ')}
          </p>
          <h1>{detail.title}</h1>
          <p>{detail.description || 'No module description has been added.'}</p>
        </div>
        <span
          className={`admin-training-status ${detail.isActive ? 'active' : 'draft'}`}
        >
          {detail.isActive ? 'Active' : 'Draft'}
        </span>
      </header>
      <nav className="admin-training-tabs" aria-label="Module management">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            onClick={() => setParams({ tab: item })}
          >
            {item === 'scenario'
              ? 'Interactive scenario'
              : item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      <section className="admin-training-workspace">
        {tab === 'overview' ? (
          <Overview detail={detail} />
        ) : tab === 'learning' ? (
          <Learning detail={detail} />
        ) : tab === 'scenario' ? (
          <Scenarios detail={detail} />
        ) : tab === 'assessment' ? (
          <Assessments
            detail={detail}
            edit={setEditing}
            remove={removeQuestion}
          />
        ) : (
          <Settings detail={detail} save={saveMetadata} saving={saving} />
        )}
      </section>
      {editing ? (
        <QuestionEditor
          moduleId={moduleId}
          assessmentId={editing.assessmentId}
          question={editing.question}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function Overview({ detail }: { detail: Detail }) {
  return (
    <div className="admin-training-panel">
      <p className="admin-training-eyebrow">Module overview</p>
      <h2>Content structure</h2>
      <div className="admin-overview-grid">
        <Metric label="Learning sections" value={detail.learningSectionCount} />
        <Metric label="Scenarios" value={detail.scenarioCount} />
        <Metric label="Safety points" value={detail.hazardCount} />
        <Metric label="Questions" value={detail.questionCount} />
      </div>
      <p className="admin-training-note">
        Use the management tabs to inspect the current learning, scenario and
        assessment structure. Preview information is read-only and does not
        create trainee progress.
      </p>
    </div>
  );
}
function Learning({ detail }: { detail: Detail }) {
  return (
    <div className="admin-training-panel">
      <div className="admin-training-section-title">
        <div>
          <p className="admin-training-eyebrow">Learning content</p>
          <h2>Existing sections</h2>
        </div>
        <span>{detail.learningSections.length} sections</span>
      </div>
      {detail.learningSections.length ? (
        <ol className="admin-content-list">
          {detail.learningSections.map((section) => (
            <li key={section.id}>
              <span>{String(section.sequenceOrder).padStart(2, '0')}</span>
              <div>
                <strong>{section.title}</strong>
                <small>
                  {section.contentType} ·{' '}
                  {section.isActive ? 'Active' : 'Inactive'}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty text="No learning sections have been configured." />
      )}
    </div>
  );
}
function Scenarios({ detail }: { detail: Detail }) {
  return (
    <div className="admin-training-panel">
      <div className="admin-training-section-title">
        <div>
          <p className="admin-training-eyebrow">Interactive scenario</p>
          <h2>360° scenario structure</h2>
        </div>
      </div>
      {detail.scenarios.length ? (
        <div className="admin-scenario-list">
          {detail.scenarios.map((scenario) => (
            <article key={scenario.id}>
              <div>
                <strong>{scenario.title}</strong>
                <p>{scenario.description || 'No description.'}</p>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{scenario.isActive ? 'Active' : 'Inactive'}</dd>
                </div>
                <div>
                  <dt>Safety points</dt>
                  <dd>{scenario.hazardCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="No interactive scenario has been configured." />
      )}
      <p className="admin-training-note">
        This preview does not open a trainee assignment or update hotspot
        progress.
      </p>
    </div>
  );
}
function Assessments({
  detail,
  edit,
  remove,
}: {
  detail: Detail;
  edit: (value: { assessmentId: number; question: Question | null }) => void;
  remove: (assessmentId: number, questionId: number) => void;
}) {
  return (
    <div className="admin-training-panel">
      <p className="admin-training-eyebrow">Assessment</p>
      <h2>Assessment questions</h2>
      {detail.assessments.length ? (
        detail.assessments.map((assessment) => (
          <section className="admin-assessment" key={assessment.id}>
            <header>
              <div>
                <h3>{assessment.title}</h3>
                <p>
                  Pass mark {assessment.passPercentage}% ·{' '}
                  {assessment.questions.length} questions
                </p>
              </div>
              <button
                className="admin-training-primary"
                disabled={assessment.hasAttempts}
                onClick={() =>
                  edit({ assessmentId: assessment.id, question: null })
                }
              >
                + Add question
              </button>
            </header>
            {assessment.hasAttempts ? (
              <p className="admin-history-lock">
                Question editing is locked because trainee attempts already
                exist.
              </p>
            ) : null}
            <div className="admin-question-list">
              {assessment.questions.map((question, index) => (
                <article key={question.id}>
                  <div className="admin-question-number">{index + 1}</div>
                  <div>
                    <strong>{question.questionText}</strong>
                    <ul>
                      {question.options.map((option) => (
                        <li
                          className={option.isCorrect ? 'correct' : ''}
                          key={option.id}
                        >
                          {option.optionText}
                          {option.isCorrect ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="admin-question-actions">
                    <button
                      disabled={assessment.hasAttempts}
                      onClick={() =>
                        edit({ assessmentId: assessment.id, question })
                      }
                    >
                      Edit
                    </button>
                    <button
                      disabled={assessment.hasAttempts}
                      onClick={() => void remove(assessment.id, question.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <Empty text="No assessment has been configured for this module." />
      )}
    </div>
  );
}
function Settings({
  detail,
  save,
  saving,
}: {
  detail: Detail;
  save: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  return (
    <form className="admin-training-panel admin-settings-form" onSubmit={save}>
      <p className="admin-training-eyebrow">Settings / publish</p>
      <h2>Module metadata</h2>
      <label>
        Module title
        <input name="title" required defaultValue={detail.title} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          rows={6}
          defaultValue={detail.description}
        />
      </label>
      <label className="admin-active-toggle">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={detail.isActive}
        />
        <span>
          <strong>Active module</strong>
          <small>
            Active modules can be selected for required training assignments.
          </small>
        </span>
      </label>
      <button className="admin-training-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save module settings'}
      </button>
    </form>
  );
}

function QuestionEditor({
  moduleId,
  assessmentId,
  question,
  close,
  saved,
}: {
  moduleId: number;
  assessmentId: number;
  question: Question | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [text, setText] = useState(question?.questionText ?? '');
  const [options, setOptions] = useState<Option[]>(
    question?.options.map((o) => ({ ...o })) ?? [
      { optionText: '', isCorrect: true },
      { optionText: '', isCorrect: false },
    ],
  );
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        `/admin/training-content/${moduleId}/assessments/${assessmentId}/questions${question ? `/${question.id}` : ''}`,
        {
          method: question ? 'PATCH' : 'POST',
          body: JSON.stringify({
            questionText: text,
            options: options.map(({ optionText, isCorrect }) => ({
              optionText,
              isCorrect,
            })),
          }),
        },
      );
      await saved();
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : 'The question could not be saved.',
      );
    }
  }
  return (
    <div className="admin-training-overlay">
      <form
        className="admin-training-modal question"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-editor-title"
        onSubmit={submit}
      >
        <button
          type="button"
          className="admin-training-close"
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>
        <p className="admin-training-eyebrow">Assessment authoring</p>
        <h2 id="question-editor-title">
          {question ? 'Edit question' : 'Add question'}
        </h2>
        <label>
          Question text
          <textarea
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Answer options</legend>
          {options.map((option, index) => (
            <div className="admin-option-row" key={index}>
              <input
                aria-label={`Correct answer ${index + 1}`}
                type="radio"
                name="correct"
                checked={option.isCorrect}
                onChange={() =>
                  setOptions(
                    options.map((item, itemIndex) => ({
                      ...item,
                      isCorrect: itemIndex === index,
                    })),
                  )
                }
              />
              <input
                aria-label={`Answer option ${index + 1}`}
                required
                value={option.optionText}
                onChange={(e) =>
                  setOptions(
                    options.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, optionText: e.target.value }
                        : item,
                    ),
                  )
                }
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  aria-label={`Remove answer option ${index + 1}`}
                  onClick={() =>
                    setOptions(
                      options.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="admin-training-secondary"
            disabled={options.length >= 8}
            onClick={() =>
              setOptions([...options, { optionText: '', isCorrect: false }])
            }
          >
            + Add answer option
          </button>
        </fieldset>
        {error ? (
          <p className="admin-training-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="admin-training-primary">Save question</button>
        <button
          type="button"
          className="admin-training-secondary"
          onClick={close}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
function ModuleCard({ module }: { module: Summary }) {
  const isManualHandling = module.slug.includes('manual');
  const image = isManualHandling
    ? manualHandlingImage
    : module.slug.includes('forklift')
      ? forkliftImage
      : fallbackImage;
  return (
    <article className="admin-module-card">
      <div
        className={`admin-module-visual${isManualHandling ? ' admin-module-visual--manual-handling' : ''}`}
      >
        <img src={image} alt="" />
        <span
          className={`admin-module-status ${module.isActive ? 'active' : 'draft'}`}
        >
          <DashboardIcon name={module.isActive ? 'check' : 'clock'} />
          {module.isActive ? 'Active' : 'Draft'}
        </span>
      </div>
      <div className="admin-module-body">
        <div className="admin-module-title">
          <h3>{module.title}</h3>
        </div>
        <p>{module.description || 'No module description has been added.'}</p>
        <dl>
          <ModuleMeta
            icon="Training content"
            label="Learning"
            value={`${module.learningSectionCount} sections`}
          />
          <ModuleMeta
            icon="Scenarios"
            label="360° scenario"
            value={module.scenarioCount ? 'Available' : 'Not configured'}
          />
          <ModuleMeta
            icon="Assessments"
            label="Assessment"
            value={`${module.questionCount} questions`}
          />
          <ModuleMeta
            icon="trophy"
            label="Pass mark"
            value={
              module.passPercentage === null
                ? 'Not set'
                : `${module.passPercentage}%`
            }
          />
        </dl>
        <div className="admin-module-actions">
          <Link to={`/admin/training/${module.id}?tab=overview`}>
            <DashboardIcon name="eye" />
            Preview training
          </Link>
          <Link className="primary" to={`/admin/training/${module.id}`}>
            <DashboardIcon name="Settings" />
            Manage module
          </Link>
        </div>
      </div>
    </article>
  );
}
function ModuleMeta({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span aria-hidden="true">
        <DashboardIcon name={icon} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}
function Metric({
  icon,
  tone = '',
  label,
  value,
}: {
  icon?: string;
  tone?: string;
  label: string;
  value: number;
}) {
  return (
    <article>
      {icon ? (
        <span
          className={`admin-training-metric-icon ${tone}`}
          aria-hidden="true"
        >
          <DashboardIcon name={icon} />
        </span>
      ) : null}
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="admin-training-empty">{text}</p>;
}
function State({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="admin-training-state">
      <h1>{title}</h1>
      <p>{detail}</p>
    </section>
  );
}
