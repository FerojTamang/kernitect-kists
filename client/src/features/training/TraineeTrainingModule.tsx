import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
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
  const [pathCollapsed, setPathCollapsed] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completionNoticeSectionId, setCompletionNoticeSectionId] = useState<
    number | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lessonContentRef = useRef<HTMLElement>(null);
  const previousProgressRef = useRef<number | null>(null);

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

  useEffect(() => {
    lessonContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIndex]);

  useEffect(() => {
    if (!pathOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPathOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pathOpen]);

  useEffect(() => {
    const percentage = module?.progress.learningProgressPercentage;
    if (percentage === undefined) return;

    const previous = previousProgressRef.current;
    previousProgressRef.current = percentage;
    if (previous === null || previous >= 100 || percentage < 100) return;

    setShowCelebration(true);
    const timer = window.setTimeout(() => setShowCelebration(false), 3000);
    return () => window.clearTimeout(timer);
  }, [module?.progress.learningProgressPercentage]);

  useEffect(() => {
    if (completionNoticeSectionId === null) return;
    const timer = window.setTimeout(
      () => setCompletionNoticeSectionId(null),
      6500,
    );
    return () => window.clearTimeout(timer);
  }, [completionNoticeSectionId]);

  function goToSection(index: number) {
    setCompletionNoticeSectionId(null);
    setActiveIndex(index);
    setPathOpen(false);
  }

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
      if (result.sectionComplete && !section.completedAt) {
        setCompletionNoticeSectionId(section.id);
      }
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
    <div
      className={`training-module-page course-player${pathCollapsed ? ' path-collapsed' : ''}${pathOpen ? ' path-open' : ''}`}
    >
      <header className="course-player-header">
        <button
          className="course-mobile-path-button"
          type="button"
          aria-expanded={pathOpen}
          aria-controls="course-learning-path"
          onClick={() => setPathOpen(true)}
        >
          Learning Path
        </button>
        <div className="course-header-title">
          <span>Safety Training Module</span>
          <h1>
            {allComplete ? 'Learning content complete' : module.moduleTitle}
          </h1>
        </div>
        <div className="course-header-progress">
          <span>
            Section {activeIndex + 1} of {module.sections.length}
          </span>
          <strong>
            {module.progress.learningProgressPercentage}%
            {!allComplete && (
              <span className="course-progress-words"> learning progress</span>
            )}
          </strong>
          <div
            className="course-progress-track"
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
        </div>
      </header>

      <div className="course-player-body">
        <button
          className="course-drawer-backdrop"
          type="button"
          aria-label="Close learning path"
          onClick={() => setPathOpen(false)}
        />
        <aside className="course-learning-sidebar" id="course-learning-path">
          <div className="course-brand-row">
            <div className="course-brand-logo">
              <BrandLogo variant="dark" />
            </div>
            <button
              className="course-path-collapse"
              type="button"
              aria-label={
                pathCollapsed
                  ? 'Expand learning path'
                  : 'Collapse learning path'
              }
              onClick={() => setPathCollapsed((current) => !current)}
            >
              <span aria-hidden="true">{pathCollapsed ? '›' : '‹'}</span>
            </button>
            <button
              className="course-path-close"
              type="button"
              aria-label="Close learning path"
              onClick={() => setPathOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="course-module-summary">
            <span>Safety Training Module</span>
            <h2>Manual Handling</h2>
            <p>
              {module.progress.completedSections} of{' '}
              {module.progress.totalSections} sections completed
            </p>
            <div className="course-sidebar-progress" aria-hidden="true">
              <span
                style={{
                  width: `${module.progress.learningProgressPercentage}%`,
                }}
              />
            </div>
          </div>

          <nav
            className="module-section-list"
            aria-label="Complete each section"
          >
            <div className="section-list-heading">
              <p className="content-kicker" id="section-list-heading">
                Learning Path
              </p>
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
                    title={pathCollapsed ? section.title : undefined}
                    onClick={() => goToSection(index)}
                  >
                    <span className="section-number">
                      {section.completedAt
                        ? '✓'
                        : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="section-summary">
                      <strong>
                        {section.title === 'Introduction'
                          ? 'Introduction to Manual Handling'
                          : section.title}
                      </strong>
                      <small>
                        {index === activeIndex
                          ? 'Current section'
                          : section.completedAt
                            ? 'Completed'
                            : 'Not started'}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <Link
            className="course-back-link active"
            aria-label="My Training"
            to="/trainee/training"
          >
            <span aria-hidden="true">←</span>
            <span className="course-back-label">Back to My Training</span>
          </Link>
        </aside>

        <main className="course-lesson-scroll" ref={lessonContentRef}>
          {allComplete ? (
            <CompletionState
              assignmentId={module.assignmentId}
              celebrating={showCelebration}
            />
          ) : (
            <SectionContent
              section={module.sections[activeIndex]}
              index={activeIndex}
              total={module.sections.length}
              progress={module.progress}
              nextTitle={module.sections[activeIndex + 1]?.title}
              feedback={feedback}
              submitting={submitting}
              selectedOptions={selectedOptions}
              showCompletionNotice={
                completionNoticeSectionId === module.sections[activeIndex]?.id
              }
              onPrevious={() => goToSection(Math.max(0, activeIndex - 1))}
              onNext={() =>
                goToSection(
                  Math.min(module.sections.length - 1, activeIndex + 1),
                )
              }
              onSelect={selectOption}
              onAnswer={answerQuestion}
            />
          )}
        </main>
      </div>
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
  showCompletionNotice,
  onPrevious,
  onNext,
  onSelect,
  onAnswer,
}: {
  section?: TrainingSection;
  index: number;
  total: number;
  progress: TrainingModuleResponse['progress'];
  nextTitle?: string;
  feedback: Record<number, string>;
  submitting: number | null;
  selectedOptions: Record<number, number>;
  showCompletionNotice: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (questionId: number, optionId: number) => void;
  onAnswer: (question: FormativeQuestion) => Promise<void>;
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
        feedback={feedback}
        submitting={submitting}
        selectedOptions={selectedOptions}
        onSelect={onSelect}
        onAnswer={onAnswer}
        checksComplete={checksComplete}
        showCompletionNotice={showCompletionNotice}
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
            aria-label={nextTitle ? `Continue to ${nextTitle}` : 'Next'}
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
  feedback,
  submitting,
  selectedOptions,
  onSelect,
  onAnswer,
  checksComplete,
  showCompletionNotice,
}: {
  section: TrainingSection;
  progress: TrainingModuleResponse['progress'];
  feedback: Record<number, string>;
  submitting: number | null;
  selectedOptions: Record<number, number>;
  onSelect: (questionId: number, optionId: number) => void;
  onAnswer: (question: FormativeQuestion) => Promise<void>;
  checksComplete: boolean;
  showCompletionNotice: boolean;
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
      {checksComplete && showCompletionNotice ? (
        <div className="check-complete completion-notice" role="status">
          <strong>✓ Section Complete</strong>
          <span>{section.title} completed</span>
          <span>
            {progress.completedSections} / {progress.totalSections} sections ·
            Learning progress {progress.learningProgressPercentage}%
          </span>
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

function CompletionState({
  assignmentId,
  celebrating,
}: {
  assignmentId: number;
  celebrating: boolean;
}) {
  return (
    <section
      className={`completion-state card${celebrating ? ' is-celebrating' : ''}`}
    >
      {celebrating && (
        <div className="completion-confetti" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      <span className="completion-check" aria-hidden="true">
        ✓
      </span>
      <p className="content-kicker">Manual Handling</p>
      {celebrating && (
        <strong className="celebration-title">Congratulations!</strong>
      )}
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
        <small>
          Apply what you learned in five warehouse safety decisions.
        </small>
      </div>
      <div className="completion-actions">
        <Link className="dashboard-action ghost" to="/trainee/training">
          Return to My Training
        </Link>
        <Link
          className="dashboard-action"
          to={`/trainee/training/${assignmentId}/scenario`}
        >
          Start Interactive Scenario <span aria-hidden="true">→</span>
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
