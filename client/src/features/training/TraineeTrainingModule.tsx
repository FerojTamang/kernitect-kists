import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import heroImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import correctLiftingImage from '../../assets/training/manual-handling/correct-lifting-posture.png';
import incorrectLiftingImage from '../../assets/training/manual-handling/incorrect-lifting-posture.png';
import assessLoadImage from '../../assets/training/manual-handling/assess-load-before-lifting.png';
import equipmentImage from '../../assets/training/manual-handling/safe-handling-equipment.png';
import injuryRiskImage from '../../assets/training/manual-handling/manual-handling-injury-risk.png';
import { ApiError, apiRequest } from '../../services/api/request';
import './training-module.css';

interface FormativeOption {
  id: number;
  optionText: string;
  sequenceOrder: number;
}
interface FormativeQuestion {
  id: number;
  questionText: string;
  sequenceOrder: number;
  options: FormativeOption[];
  selectedOptionId: number | null;
  answeredCorrectly: boolean;
}
interface TrainingSection {
  id: number;
  title: string;
  contentType: 'text' | 'image' | 'video' | 'document' | 'link';
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number;
  isActive: boolean;
  completedAt: string | null;
  formativeQuestions: FormativeQuestion[];
}
interface TrainingModuleResponse {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: {
    assignmentPercentage: number;
    learningProgressPercentage: number;
    completedSections: number;
    totalSections: number;
    startedAt: string | null;
    completedAt: string | null;
    lastAccessedAt: string | null;
  };
  sections: TrainingSection[];
  resumeSectionIndex: number;
}

export function TraineeTrainingModule() {
  const { assignmentId } = useParams();
  const [module, setModule] = useState<TrainingModuleResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<TrainingModuleResponse>(
        `/trainee/training/${assignmentId}`,
      );
      setModule(payload);
      setActiveIndex(payload.resumeSectionIndex);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('We could not load this training module. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadModule(), 0);
    return () => window.clearTimeout(timer);
  }, [loadModule]);

  function selectOption(questionId: number, optionId: number) {
    setSelectedOptions((current) => ({ ...current, [questionId]: optionId }));
    setFeedback((current) => ({ ...current, [questionId]: '' }));
  }

  async function answerQuestion(question: FormativeQuestion) {
    if (!module || submitting !== null) return;
    const optionId = selectedOptions[question.id];
    if (!optionId) return;
    const section = module.sections[activeIndex];
    if (!section) return;
    setSubmitting(question.id);
    setError(null);
    try {
      const result = await apiRequest<{
        correct: boolean;
        feedback: string;
        sectionComplete: boolean;
        module: TrainingModuleResponse;
      }>(
        `/trainee/training/${module.assignmentId}/content/${section.id}/questions/${question.id}/answer`,
        { method: 'POST', body: JSON.stringify({ optionId }) },
      );
      setModule(result.module);
      setFeedback((current) => ({
        ...current,
        [question.id]: result.feedback,
      }));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError('Your answer could not be saved right now. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  if (loading)
    return (
      <TrainingState
        title="Loading training"
        detail="Preparing your learning content..."
        loading
      />
    );
  if (error || !module)
    return (
      <TrainingState
        title="Training module unavailable"
        detail={error ?? 'Please try again.'}
      >
        <button
          className="dashboard-action"
          type="button"
          onClick={() => void loadModule()}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
      </TrainingState>
    );

  const allComplete =
    module.progress.learningProgressPercentage === 100 &&
    module.sections.length > 0;
  return (
    <div className="training-module-page">
      <header className="training-module-header">
        <div>
          <p className="eyebrow">My Training / Manual Handling</p>
          <h1>
            {allComplete ? 'Learning content complete' : module.moduleTitle}
          </h1>
        </div>
        <Link className="secondary-link" to="/trainee/training">
          ← Back to My Training
        </Link>
      </header>
      {allComplete ? (
        <CompletionState />
      ) : (
        <>
          <section className="module-overview card">
            <div className="overview-copy">
              <span className="status-badge">
                {module.status === 'in_progress'
                  ? 'In progress'
                  : 'Not started'}
              </span>
              <h2>Manual Handling</h2>
              <p>
                Learn how to assess handling tasks, reduce risk and use safer
                handling techniques in warehouse environments.
              </p>
              <p className="module-facts">
                <strong>{module.progress.totalSections} sections</strong>
                <span>Learning content</span>
                <span>Scenario follows</span>
              </p>
              <a className="dashboard-action compact" href="#section-content">
                {module.progress.completedSections
                  ? 'Continue learning'
                  : 'Start learning'}{' '}
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <img
              className="module-hero-image"
              src={heroImage}
              alt="Warehouse worker lifting a box safely"
            />
          </section>
          <section
            className="learning-progress card"
            aria-label="Learning progress"
          >
            <div className="progress-header">
              <span>
                {module.progress.completedSections} of{' '}
                {module.progress.totalSections} sections completed
              </span>
              <strong>
                {module.progress.learningProgressPercentage}% learning progress
              </strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Learning content progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={module.progress.learningProgressPercentage}
            >
              <span
                style={{
                  width: `${module.progress.learningProgressPercentage}%`,
                }}
              />
            </div>
          </section>
          <div className="module-learning-layout">
            <nav
              className="module-section-list card"
              aria-labelledby="section-list-heading"
            >
              <div className="section-list-heading">
                <div>
                  <p className="content-kicker">Learning path</p>
                  <h2 id="section-list-heading">Complete each section</h2>
                </div>
                <span>
                  {module.progress.completedSections} of{' '}
                  {module.progress.totalSections} complete
                </span>
              </div>
              <ol>
                {module.sections.map((section, index) => (
                  <li
                    key={section.id}
                    className={`${index === activeIndex ? 'active' : ''} ${section.completedAt ? 'complete' : ''}`}
                  >
                    <button
                      type="button"
                      aria-current={index === activeIndex ? 'step' : undefined}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span className="section-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="section-summary">
                        <strong>
                          {section.title === 'Introduction'
                            ? 'Introduction to Manual Handling'
                            : section.title}
                        </strong>
                        <small>
                          {index === activeIndex
                            ? '→ Current'
                            : section.completedAt
                              ? '✓ Completed'
                              : '○ Not started'}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <SectionContent
              section={module.sections[activeIndex]}
              index={activeIndex}
              total={module.sections.length}
              progress={module.progress}
              nextTitle={module.sections[activeIndex + 1]?.title}
              feedback={feedback}
              submitting={submitting}
              selectedOptions={selectedOptions}
              onPrevious={() =>
                setActiveIndex((index) => Math.max(0, index - 1))
              }
              onNext={() =>
                setActiveIndex((index) =>
                  Math.min(module.sections.length - 1, index + 1),
                )
              }
              onSelect={selectOption}
              onAnswer={answerQuestion}
              onContinue={() =>
                setActiveIndex((index) =>
                  Math.min(module.sections.length - 1, index + 1),
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function SectionContent({
  section,
  index,
  total,
  progress,
  nextTitle,
  feedback,
  submitting,
  selectedOptions,
  onPrevious,
  onNext,
  onSelect,
  onAnswer,
  onContinue,
}: {
  section?: TrainingSection;
  index: number;
  total: number;
  progress: TrainingModuleResponse['progress'];
  nextTitle?: string;
  feedback: Record<number, string>;
  submitting: number | null;
  selectedOptions: Record<number, number>;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (questionId: number, optionId: number) => void;
  onAnswer: (question: FormativeQuestion) => Promise<void>;
  onContinue: () => void;
}) {
  if (!section) return null;
  const checksComplete =
    section.formativeQuestions.length > 0 &&
    section.formativeQuestions.every((question) => question.answeredCorrectly);
  return (
    <article className="section-content card" id="section-content">
      <div className="section-content-heading">
        <div>
          <p className="content-kicker">
            {String(index + 1).padStart(2, '0')} of {total}
          </p>
          <h2>{section.title}</h2>
        </div>
        <span
          className={`section-state-pill ${section.completedAt ? 'completed' : ''}`}
        >
          {section.completedAt ? '✓ Completed' : 'In progress'}
        </span>
      </div>
      <div
        className={`section-content-grid ${section.title === 'Safe Lifting Techniques' ? 'comparison-content' : ''}`}
      >
        <div className="section-copy">
          <SectionBody section={section} />
        </div>
        {section.title !== 'Safe Lifting Techniques' && (
          <img
            className="section-image"
            src={sectionImageFor(section.title)}
            alt={sectionImageAlt(section.title)}
          />
        )}
      </div>
      <KnowledgeCheck
        section={section}
        progress={progress}
        nextTitle={nextTitle}
        feedback={feedback}
        submitting={submitting}
        selectedOptions={selectedOptions}
        onSelect={onSelect}
        onAnswer={onAnswer}
        checksComplete={checksComplete}
        onContinue={onContinue}
      />
      <div className="section-actions">
        <button
          className="dashboard-action ghost"
          type="button"
          onClick={onPrevious}
          disabled={index === 0}
        >
          ← Previous
        </button>
        {section.completedAt ? (
          <button
            className="dashboard-action"
            type="button"
            onClick={onNext}
            disabled={index === total - 1}
          >
            Next <span aria-hidden="true">→</span>
          </button>
        ) : (
          <span className="completion-hint">
            Answer both questions correctly to complete this section.
          </span>
        )}
      </div>
    </article>
  );
}

function KnowledgeCheck({
  section,
  progress,
  nextTitle,
  feedback,
  submitting,
  selectedOptions,
  onSelect,
  onAnswer,
  checksComplete,
  onContinue,
}: {
  section: TrainingSection;
  progress: TrainingModuleResponse['progress'];
  nextTitle?: string;
  feedback: Record<number, string>;
  submitting: number | null;
  selectedOptions: Record<number, number>;
  onSelect: (questionId: number, optionId: number) => void;
  onAnswer: (question: FormativeQuestion) => Promise<void>;
  checksComplete: boolean;
  onContinue: () => void;
}) {
  return (
    <section
      className="knowledge-check"
      aria-labelledby="understanding-heading"
    >
      <div className="knowledge-check-heading">
        <div>
          <p className="content-kicker">Practice check</p>
          <h3 id="understanding-heading">Check your understanding</h3>
        </div>
        <span>
          {
            section.formativeQuestions.filter(
              (question) => question.answeredCorrectly,
            ).length
          }{' '}
          of {section.formativeQuestions.length} correct
        </span>
      </div>
      {section.formativeQuestions.map((question, index) => (
        <div className="question-card" key={question.id}>
          <p className="question-number">
            Question {index + 1} of {section.formativeQuestions.length}
          </p>
          <h4 id={`question-${question.id}`}>{question.questionText}</h4>
          <div
            className="answer-options"
            role="radiogroup"
            aria-labelledby={`question-${question.id}`}
          >
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`${selectedOptions[question.id] === option.id ? 'selected-option' : ''} ${question.selectedOptionId === option.id ? (question.answeredCorrectly ? 'selected-correct' : 'selected-wrong') : ''}`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={
                    (selectedOptions[question.id] ??
                      question.selectedOptionId) === option.id
                  }
                  onChange={() => onSelect(question.id, option.id)}
                  disabled={submitting !== null || question.answeredCorrectly}
                />
                <span>{option.optionText}</span>
              </label>
            ))}
          </div>
          <button
            className="check-answer-button"
            type="button"
            onClick={() => void onAnswer(question)}
            disabled={
              !selectedOptions[question.id] ||
              submitting !== null ||
              question.answeredCorrectly
            }
          >
            {submitting === question.id ? 'Checking...' : 'Check Answer'}
          </button>
          {feedback[question.id] ? (
            <div
              className={`answer-feedback ${question.answeredCorrectly ? 'correct' : 'incorrect'}`}
              role="status"
            >
              <strong>
                {question.answeredCorrectly ? '✓ Correct' : '✕ Not quite'}
              </strong>
              <p>{feedback[question.id]}</p>
              {!question.answeredCorrectly && (
                <button
                  type="button"
                  className="dashboard-action ghost compact"
                  onClick={() => {
                    const selected = selectedOptions[question.id];
                    if (selected !== undefined) onSelect(question.id, selected);
                  }}
                >
                  Try Again
                </button>
              )}
            </div>
          ) : null}
        </div>
      ))}
      {checksComplete ? (
        <div className="check-complete" role="status">
          <strong>✓ Section Complete</strong>
          <span>{section.title} completed</span>
          <span>
            {progress.completedSections} / {progress.totalSections} sections ·
            Learning progress {progress.learningProgressPercentage}%
          </span>
          {nextTitle ? (
            <button
              className="dashboard-action compact"
              type="button"
              onClick={onContinue}
            >
              Continue to {nextTitle} <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SectionBody({ section }: { section: TrainingSection }) {
  if (section.title === 'Introduction')
    return (
      <>
        <h3>What is manual handling?</h3>
        <p>{section.body}</p>
        <div className="info-panel">
          Manual handling includes pushing, pulling, carrying and holding, not
          only lifting.
        </div>
      </>
    );
  if (section.title === 'Risks and Injuries')
    return (
      <>
        <h3>Why it matters</h3>
        <p>
          Poor manual handling may contribute to strains, sprains, back
          discomfort and other musculoskeletal problems.
        </p>
        <div className="task-checklist">
          <div>
            <strong>Awkward posture</strong>
            <span>Bending mainly from the back or twisting with a load.</span>
          </div>
          <div>
            <strong>Demanding loads</strong>
            <span>Heavy, unstable or difficult-to-hold objects.</span>
          </div>
        </div>
        <div className="warning-panel">
          <strong>Risk increases when...</strong>
          <span>{section.body}</span>
        </div>
      </>
    );
  if (section.title === 'Assessing the Task and Load')
    return (
      <>
        <h3>Assess before you move</h3>
        <p>{section.body}</p>
        <div className="task-checklist">
          <div>
            <strong>Load</strong>
            <span>Size, shape, stability and estimated weight.</span>
          </div>
          <div>
            <strong>Task</strong>
            <span>Destination and lifting or carrying requirements.</span>
          </div>
          <div>
            <strong>Environment</strong>
            <span>A clear route, obstacles and available space.</span>
          </div>
          <div>
            <strong>Person / support</strong>
            <span>Your capability, assistance and suitable equipment.</span>
          </div>
        </div>
      </>
    );
  if (section.title === 'Safe Lifting Techniques')
    return (
      <>
        <h3>The key steps to safe lifting</h3>
        <p>
          Compare safer and unsafe handling technique. Look at the worker’s
          footing, back position and distance from the load.
        </p>
        <div className="lifting-comparison">
          <div className="lifting-card safer">
            <h4>
              <span aria-hidden="true">✓</span> Safer Technique{' '}
              <small>DO</small>
            </h4>
            <img
              src={correctLiftingImage}
              alt="Safer lift: worker with bent knees, stable feet and the box held close to the body"
            />
            <ul>
              <li>Stable footing</li>
              <li>Bend the knees appropriately</li>
              <li>Keep the load close</li>
              <li>Lift smoothly</li>
              <li>Avoid unnecessary twisting</li>
            </ul>
          </div>
          <div className="lifting-card unsafe">
            <h4>
              <span aria-hidden="true">✕</span> Unsafe Technique{' '}
              <small>DON’T</small>
            </h4>
            <img
              src={incorrectLiftingImage}
              alt="Unsafe lift: worker bending mainly from the back with straight legs and the box away from the body"
            />
            <ul>
              <li>Bending mainly from the back</li>
              <li>Holding the load far away</li>
              <li>Twisting while lifting</li>
              <li>Rushing the movement</li>
              <li>Handling a difficult load without help</li>
            </ul>
          </div>
        </div>
        <ol className="technique-list">
          {[
            'Plan the lift.',
            'Assess the load and route.',
            'Set stable footing.',
            'Bend your knees.',
            'Secure a firm grip.',
            'Keep the load close.',
            'Lift smoothly and avoid twisting.',
            'Ask for assistance or use equipment when needed.',
          ].map((step, stepIndex) => (
            <li key={step}>
              <span>{String(stepIndex + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </>
    );
  return (
    <>
      <h3>Choose a safer way to move the load</h3>
      <p>
        An unnecessary manual lift can be avoided. Choose suitable equipment or
        ask for support before moving a difficult load.
      </p>
      <div className="example-grid">
        <div className="example-card">
          <span>01 / Use equipment</span>
          <strong>Move a bulky load</strong>
          <small>
            Consider suitable handling equipment instead of carrying the load by
            hand.
          </small>
        </div>
        <div className="example-card">
          <span>02 / Ask for support</span>
          <strong>Plan the move together</strong>
          <small>
            Ask another worker for assistance and use team handling where
            appropriate.
          </small>
        </div>
      </div>
    </>
  );
}

function sectionImageFor(title: string): string {
  if (title === 'Introduction') return heroImage;
  if (title === 'Risks and Injuries') return injuryRiskImage;
  if (title === 'Assessing the Task and Load') return assessLoadImage;
  if (title === 'Safe Lifting Techniques') return correctLiftingImage;
  return equipmentImage;
}

function sectionImageAlt(title: string): string {
  if (title === 'Introduction')
    return 'Warehouse worker preparing to move a load';
  if (title === 'Risks and Injuries')
    return 'Illustration highlighting manual handling injury risk';
  if (title === 'Assessing the Task and Load')
    return 'Worker assessing a load before lifting';
  if (title === 'Safe Lifting Techniques')
    return 'Worker demonstrating safer lifting posture';
  return 'Worker using safe handling equipment in a warehouse';
}

function CompletionState() {
  return (
    <section className="completion-state card">
      <span className="completion-check" aria-hidden="true">
        ✓
      </span>
      <p className="content-kicker">Manual Handling</p>
      <h2>Learning content complete</h2>
      <p>
        You have completed all Manual Handling learning sections and knowledge
        checks.
      </p>
      <p className="completion-progress">
        5 of 5 sections completed · 100% learning progress
      </p>
      <div className="next-stage">
        <strong>Next stage</strong>
        <span>Interactive Warehouse Safety Scenario</span>
        <small>Coming next</small>
      </div>
      <div className="completion-actions">
        <Link className="dashboard-action ghost" to="/trainee/training">
          Return to My Training
        </Link>
        <Link className="dashboard-action" to="/trainee/dashboard">
          Return to Dashboard
        </Link>
      </div>
    </section>
  );
}
function TrainingState({
  title,
  detail,
  loading = false,
  children,
}: {
  title: string;
  detail: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="training-empty-state" role={loading ? 'status' : 'alert'}>
      <div className="card">
        <p className="eyebrow">KISTS / Learning content</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {children}
      </div>
    </main>
  );
}
