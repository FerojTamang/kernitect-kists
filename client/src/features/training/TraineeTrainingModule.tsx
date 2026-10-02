import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import heroImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import carryingSafelyImage from '../../assets/training/manual-handling/section-01-carrying-safely.png';
import pushingTrolleyImage from '../../assets/training/manual-handling/section-01-pushing-trolley.png';
import safeUnsafeImage from '../../assets/training/manual-handling/section-02-safe-unsafe.png';
import assessTaskImage from '../../assets/training/manual-handling/section-03-assess-load.png';
import safeLiftingImage from '../../assets/training/manual-handling/section-04-safe-lifting.png';
import practicalExamplesImage from '../../assets/training/manual-handling/section-05.png';
import equipmentImage from '../../assets/training/manual-handling/safe-handling-equipment.png';
import workingAroundForkliftsImage from '../../assets/training/forklift-pedestrian-safety/section-01-working-around-forklifts.png';
import pedestrianRoutesImage from '../../assets/training/forklift-pedestrian-safety/section-02-pedestrian-routes.png';
import forkliftBlindSpotsImage from '../../assets/training/forklift-pedestrian-safety/section-03-forklift-blind-spots.png';
import safeSeparationImage from '../../assets/training/forklift-pedestrian-safety/section-04-safe-separation.png';
import crossingPointsImage from '../../assets/training/forklift-pedestrian-safety/section-05-crossing-points.png';
import poorVisibilityImage from '../../assets/training/forklift-pedestrian-safety/section-06-poor-visibility.png';
import safeCommunicationImage from '../../assets/training/forklift-pedestrian-safety/section-06-safe-communication.png';
import loadsOperatingAreasImage from '../../assets/training/forklift-pedestrian-safety/section-07-loads-operating-areas.png';
import unsafeBehaviourReportingImage from '../../assets/training/forklift-pedestrian-safety/section-08-unsafe-behaviour-reporting.png';
import forkliftImage from '../../assets/images/dashboard/forklift-pedestrian-safety.jpg';
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
  moduleDescription: string;
  hasScenario: boolean;
  scenarioStatus: 'not_started' | 'in_progress' | 'completed';
  assessmentPassed: boolean;
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
  const [reviewSectionIndex, setReviewSectionIndex] = useState<number | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [pathCollapsed, setPathCollapsed] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  } | null>(null);
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
      setReviewSectionIndex(null);
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
    setRailTooltip(null);
    setCompletionNoticeSectionId(null);
    setActiveIndex(index);
    if (module?.progress.learningProgressPercentage === 100)
      setReviewSectionIndex(index);
    setPathOpen(false);
  }

  function showRailTooltip(target: HTMLElement, label: string) {
    if (!pathCollapsed || pathOpen) return;
    const bounds = target.getBoundingClientRect();
    const sidebar = target.closest('.course-learning-sidebar');
    setRailTooltip({
      label,
      left: (sidebar?.getBoundingClientRect().right ?? bounds.right) + 10,
      top: Math.max(
        30,
        Math.min(bounds.top + bounds.height / 2, window.innerHeight - 30),
      ),
    });
  }

  function returnToSummary() {
    setReviewSectionIndex(null);
    setPathOpen(false);
  }

  function selectOption(questionId: number, optionId: number) {
    setSelectedOptions((current) => ({ ...current, [questionId]: optionId }));
    setFeedback((current) => ({ ...current, [questionId]: '' }));
  }

  async function answerQuestion(question: FormativeQuestion) {
    if (!module || submitting !== null || reviewSectionIndex !== null) return;
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

  const isManualHandling = module.moduleTitle === 'Manual Handling';
  const allComplete =
    module.progress.learningProgressPercentage === 100 &&
    module.sections.length > 0;
  const showingSummary = allComplete && reviewSectionIndex === null;
  const selectedSectionIndex = allComplete ? reviewSectionIndex : activeIndex;
  return (
    <div
      className={`training-module-page course-player${allComplete ? ' is-complete' : ''}${pathCollapsed ? ' path-collapsed' : ''}${pathOpen ? ' path-open' : ''}`}
    >
      <div className="course-player-body">
        <button
          className="course-drawer-backdrop"
          type="button"
          aria-label="Close learning path"
          onClick={() => setPathOpen(false)}
        />
        <aside className="course-learning-sidebar" id="course-learning-path">
          <div className="course-brand-row">
            <Link
              className="course-brand-logo"
              to="/trainee/dashboard"
              aria-label="Return to trainee dashboard"
              onClick={() => setPathOpen(false)}
            >
              <BrandLogo variant="transparent-white" />
            </Link>
            <button
              className="course-path-collapse"
              type="button"
              aria-label={
                pathCollapsed
                  ? 'Expand training navigation'
                  : 'Collapse training navigation'
              }
              onClick={() => {
                setRailTooltip(null);
                setPathCollapsed((current) => !current);
              }}
            >
              <span className="course-path-chevron" aria-hidden="true" />
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
            <h2>{module.moduleTitle}</h2>
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
            aria-label={allComplete ? 'Learning Path' : 'Complete each section'}
            onScroll={() => setRailTooltip(null)}
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
                  className={`${index === selectedSectionIndex ? 'active' : ''} ${section.completedAt ? 'complete' : ''}`}
                >
                  <button
                    type="button"
                    aria-label={`${isManualHandling && section.title === 'Introduction' ? 'Introduction to Manual Handling' : section.title}, ${section.completedAt ? 'Completed' : index === activeIndex ? 'Current section' : 'Not started'}`}
                    aria-current={
                      index === selectedSectionIndex
                        ? allComplete
                          ? 'true'
                          : 'step'
                        : undefined
                    }
                    onClick={() => goToSection(index)}
                    onMouseEnter={(event) =>
                      showRailTooltip(
                        event.currentTarget,
                        isManualHandling && section.title === 'Introduction'
                          ? 'Introduction to Manual Handling'
                          : section.title,
                      )
                    }
                    onFocus={(event) =>
                      showRailTooltip(
                        event.currentTarget,
                        isManualHandling && section.title === 'Introduction'
                          ? 'Introduction to Manual Handling'
                          : section.title,
                      )
                    }
                    onMouseLeave={(event) => {
                      if (document.activeElement !== event.currentTarget)
                        setRailTooltip(null);
                    }}
                    onBlur={() => setRailTooltip(null)}
                  >
                    <span className="section-number" aria-hidden="true">
                      {section.completedAt ? '✓' : null}
                    </span>
                    <span className="section-order" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="section-summary">
                      <strong>
                        {isManualHandling && section.title === 'Introduction'
                          ? 'Introduction to Manual Handling'
                          : section.title}
                      </strong>
                      <small>
                        {section.completedAt
                          ? 'Completed'
                          : index === activeIndex
                            ? 'Current section'
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
            aria-label="Back to My Training"
            to="/trainee/training"
            onMouseEnter={(event) =>
              showRailTooltip(event.currentTarget, 'Back to My Training')
            }
            onFocus={(event) =>
              showRailTooltip(event.currentTarget, 'Back to My Training')
            }
            onMouseLeave={(event) => {
              if (document.activeElement !== event.currentTarget)
                setRailTooltip(null);
            }}
            onBlur={() => setRailTooltip(null)}
          >
            <span aria-hidden="true">←</span>
            <span className="course-back-label">Back to My Training</span>
          </Link>
        </aside>

        <div className="course-main">
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
              {allComplete ? (
                <>
                  <div className="course-breadcrumb">
                    <Link to="/trainee/training">My Training</Link>
                    <span aria-hidden="true">/</span>
                    <span>{module.moduleTitle}</span>
                  </div>
                  <div className="course-title-line">
                    <h1>{module.moduleTitle}</h1>
                    <span className="course-module-badge">
                      ✓{' '}
                      {module.status === 'completed'
                        ? 'Module complete'
                        : 'Learning complete'}
                    </span>
                  </div>
                  <p>Review completed learning content</p>
                </>
              ) : (
                <>
                  <span>Safety Training Module</span>
                  <h1>{module.moduleTitle}</h1>
                </>
              )}
            </div>
            <div className="course-header-progress">
              {allComplete && <small>Learning progress</small>}
              <span>
                {allComplete
                  ? `${module.progress.completedSections} of ${module.progress.totalSections} sections completed`
                  : `Section ${activeIndex + 1} of ${module.sections.length}`}
              </span>
              <strong>
                {module.progress.learningProgressPercentage}%
                {!allComplete && (
                  <span className="course-progress-words">
                    {' '}
                    learning progress
                  </span>
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

          <main className="course-lesson-scroll" ref={lessonContentRef}>
            {showingSummary ? (
              <CompletionState
                assignmentId={module.assignmentId}
                moduleTitle={module.moduleTitle}
                hasScenario={module.hasScenario}
                scenarioStatus={module.scenarioStatus}
                moduleComplete={module.status === 'completed'}
                sectionCount={module.progress.totalSections}
                celebrating={showCelebration}
              />
            ) : (
              <SectionContent
                section={module.sections[activeIndex]}
                isManualHandling={isManualHandling}
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
                reviewMode={reviewSectionIndex !== null}
                onReturnToSummary={returnToSummary}
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
      {pathCollapsed &&
        railTooltip &&
        createPortal(
          <div
            className="course-rail-tooltip"
            role="tooltip"
            style={{ left: railTooltip.left, top: railTooltip.top }}
          >
            {railTooltip.label}
          </div>,
          document.body,
        )}
    </div>
  );
}

function SectionContent({
  section,
  isManualHandling,
  index,
  total,
  progress,
  nextTitle,
  feedback,
  submitting,
  selectedOptions,
  showCompletionNotice,
  reviewMode,
  onReturnToSummary,
  onPrevious,
  onNext,
  onSelect,
  onAnswer,
}: {
  section?: TrainingSection;
  isManualHandling: boolean;
  index: number;
  total: number;
  progress: TrainingModuleResponse['progress'];
  nextTitle?: string;
  feedback: Record<number, string>;
  submitting: number | null;
  selectedOptions: Record<number, number>;
  showCompletionNotice: boolean;
  reviewMode: boolean;
  onReturnToSummary: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (questionId: number, optionId: number) => void;
  onAnswer: (question: FormativeQuestion) => Promise<void>;
}) {
  if (!section) return null;
  const checksComplete =
    section.formativeQuestions.length > 0 &&
    section.formativeQuestions.every((question) => question.answeredCorrectly);
  const isForkliftSectionOne =
    !isManualHandling && section.title === 'Working Safely Around Forklifts';
  const isForkliftSectionTwo =
    !isManualHandling && section.title === 'Pedestrian Routes and Walkways';
  const isForkliftSectionThree =
    !isManualHandling && section.title === 'Forklift Blind Spots';
  const isForkliftSectionFour =
    !isManualHandling && section.title === 'Safe Separation';
  const isForkliftSectionFive =
    !isManualHandling && section.title === 'Crossing Points and Intersections';
  const isForkliftSectionSix =
    !isManualHandling && section.title === 'Visibility and Communication';
  const isForkliftSectionSeven =
    !isManualHandling && section.title === 'Loads and Operating Areas';
  const isForkliftSectionEight =
    !isManualHandling && section.title === 'Unsafe Behaviour and Reporting';
  const learningContent = (
    <div
      className={`section-content-grid ${isManualHandling && section.title === 'Introduction' ? 'section-one-content' : ''} ${isManualHandling && section.title === 'Risks and Injuries' ? 'section-two-content' : ''} ${isManualHandling && section.title === 'Assessing the Task and Load' ? 'section-three-content' : ''} ${isManualHandling && section.title === 'Safe Lifting Techniques' ? 'comparison-content section-four-content' : ''} ${isManualHandling && section.title === 'Practical Examples' ? 'section-five-content' : ''} ${isForkliftSectionOne ? 'forklift-section-one-content' : ''} ${isForkliftSectionTwo ? 'forklift-section-two-content' : ''} ${isForkliftSectionThree ? 'forklift-section-three-content' : ''} ${isForkliftSectionFour ? 'forklift-section-four-content' : ''} ${isForkliftSectionFive ? 'forklift-section-five-content' : ''} ${isForkliftSectionSix ? 'forklift-section-six-content' : ''} ${isForkliftSectionSeven ? 'forklift-section-seven-content' : ''} ${isForkliftSectionEight ? 'forklift-section-eight-content' : ''}`}
    >
      <div className="section-copy">
        <SectionBody section={section} isManualHandling={isManualHandling} />
      </div>
      {!isForkliftSectionOne &&
        !isForkliftSectionTwo &&
        !isForkliftSectionThree &&
        !isForkliftSectionFour &&
        !isForkliftSectionFive &&
        !isForkliftSectionSix &&
        !isForkliftSectionSeven &&
        !isForkliftSectionEight &&
        (!isManualHandling ||
          (section.title !== 'Introduction' &&
            section.title !== 'Risks and Injuries' &&
            section.title !== 'Assessing the Task and Load' &&
            section.title !== 'Safe Lifting Techniques' &&
            section.title !== 'Practical Examples')) && (
          <img
            className="section-image"
            src={
              isManualHandling ? sectionImageFor(section.title) : forkliftImage
            }
            alt={
              isManualHandling
                ? sectionImageAlt(section.title)
                : 'Forklift operating near a marked pedestrian area in a warehouse'
            }
          />
        )}
    </div>
  );
  const knowledgeCheck = (
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
      reviewMode={reviewMode}
    />
  );
  return (
    <article
      className={`section-content card${reviewMode ? ' is-reviewing' : ''}`}
      id="section-content"
    >
      <div className="section-content-heading">
        <div>
          <p className="content-kicker">
            {reviewMode
              ? 'Review Mode'
              : `${String(index + 1).padStart(2, '0')} of ${total}`}
          </p>
          <h2>{section.title}</h2>
          {reviewMode && (
            <p className="course-review-description">
              Review the completed learning content and your completed knowledge
              check below.
            </p>
          )}
        </div>
        <span
          className={`section-state-pill ${section.completedAt ? 'completed' : ''}`}
        >
          {section.completedAt ? '✓ Completed' : 'In progress'}
        </span>
      </div>
      {reviewMode ? (
        <div className="course-review-flow">
          <section
            className="course-review-learning"
            aria-label="Learning content"
          >
            {learningContent}
          </section>
          <div className="course-review-check">{knowledgeCheck}</div>
        </div>
      ) : (
        <>
          {learningContent}
          {knowledgeCheck}
        </>
      )}
      <div className={`section-actions${reviewMode ? ' review-actions' : ''}`}>
        <button
          className="dashboard-action ghost"
          type="button"
          onClick={onPrevious}
          disabled={index === 0}
        >
          ← Previous
        </button>
        {reviewMode && index === total - 1 ? (
          <button
            className="dashboard-action ghost"
            type="button"
            onClick={onReturnToSummary}
          >
            <span aria-hidden="true">←</span> Return to Completion Summary
          </button>
        ) : section.completedAt ? (
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
            {section.formativeQuestions.length > 0
              ? `Answer all ${section.formativeQuestions.length} questions correctly to complete this section.`
              : 'This section cannot be completed until its practice check is configured.'}
          </span>
        )}
        {reviewMode && index !== total - 1 && (
          <button
            className="dashboard-action ghost"
            type="button"
            onClick={onReturnToSummary}
          >
            <span aria-hidden="true">←</span> Return to Completion Summary
          </button>
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
  reviewMode,
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
  reviewMode: boolean;
}) {
  if (section.formativeQuestions.length === 0) {
    return (
      <section className="knowledge-check" role="status">
        <div className="knowledge-check-heading">
          <div>
            <p className="content-kicker">Practice check</p>
            <h3>Practice check unavailable</h3>
          </div>
        </div>
        <p>
          This section&apos;s questions are not configured. Contact your
          administrator before continuing.
        </p>
      </section>
    );
  }
  return (
    <section
      className="knowledge-check"
      aria-labelledby="understanding-heading"
    >
      <div className="knowledge-check-heading">
        <div>
          <p className="content-kicker">
            {reviewMode ? 'Completed' : 'Practice check'}
          </p>
          <h3 id="understanding-heading">
            {reviewMode ? 'Knowledge Check' : 'Check your understanding'}
          </h3>
        </div>
        <span>
          {reviewMode && 'Completed · '}
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
                className={`${!reviewMode && selectedOptions[question.id] === option.id ? 'selected-option' : ''} ${question.selectedOptionId === option.id ? (question.answeredCorrectly ? 'selected-correct' : 'selected-wrong') : ''}`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={
                    (reviewMode
                      ? question.selectedOptionId
                      : (selectedOptions[question.id] ??
                        question.selectedOptionId)) === option.id
                  }
                  onChange={() => onSelect(question.id, option.id)}
                  disabled={
                    reviewMode ||
                    submitting !== null ||
                    question.answeredCorrectly
                  }
                />
                <span>{option.optionText}</span>
              </label>
            ))}
          </div>
          {!reviewMode && (
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
          )}
          {feedback[question.id] ||
          (reviewMode && question.selectedOptionId !== null) ? (
            <div
              className={`answer-feedback ${question.answeredCorrectly ? 'correct' : 'incorrect'}`}
              role="status"
            >
              <strong>
                {question.answeredCorrectly
                  ? reviewMode
                    ? '✓ Your answer is correct'
                    : '✓ Correct'
                  : '✕ Not quite'}
              </strong>
              <p>
                {feedback[question.id] ||
                  (question.answeredCorrectly
                    ? 'Correct. This is the safer workplace approach.'
                    : 'Not quite. Review the section and try again.')}
              </p>
              {!reviewMode && !question.answeredCorrectly && (
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

function SectionBody({
  section,
  isManualHandling,
}: {
  section: TrainingSection;
  isManualHandling: boolean;
}) {
  if (!isManualHandling)
    return (
      <>
        <h3>{section.title}</h3>
        <p>{section.body}</p>
        <div className="info-panel">
          Follow your workplace traffic plan, signs and site-specific
          procedures. This awareness training does not replace practical
          forklift operator training.
        </div>
        {section.title === 'Working Safely Around Forklifts' && (
          <>
            <figure className="forklift-section-one-infographic">
              <img
                src={workingAroundForkliftsImage}
                alt="Forklift and pedestrian routes separated within a warehouse safety environment"
              />
            </figure>
            <section
              className="forklift-section-one-points"
              aria-labelledby="forklift-section-one-points-heading"
            >
              <h3 id="forklift-section-one-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>
                  Forklift and pedestrian safety is a shared responsibility.
                </li>
                <li>Stay alert around vehicle operating areas.</li>
                <li>Follow the site traffic plan, signs and procedures.</li>
              </ul>
            </section>
          </>
        )}
        {section.title === 'Pedestrian Routes and Walkways' && (
          <>
            <figure className="forklift-section-two-infographic">
              <img
                src={pedestrianRoutesImage}
                alt="Comparison of unsafe forklift-lane shortcuts and safer designated pedestrian walkways in a warehouse"
              />
            </figure>
            <section
              className="forklift-section-two-points"
              aria-labelledby="forklift-section-two-points-heading"
            >
              <h3 id="forklift-section-two-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>Use designated pedestrian routes and marked walkways.</li>
                <li>Respect barriers, signs and protected areas.</li>
                <li>Avoid shortcuts through vehicle-only operating zones.</li>
              </ul>
            </section>
          </>
        )}
        {section.title === 'Forklift Blind Spots' && (
          <>
            <figure className="forklift-section-three-infographic">
              <img
                src={forkliftBlindSpotsImage}
                alt="Forklift blind-spot training infographic showing areas where pedestrians may be difficult for an operator to see"
              />
            </figure>
            <section
              className="forklift-section-three-points"
              aria-labelledby="forklift-section-three-points-heading"
            >
              <h3 id="forklift-section-three-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>
                  Forklift operators can have limited visibility to the sides
                  and rear.
                </li>
                <li>A load can block the operator’s forward view.</li>
                <li>
                  Never assume the operator has seen you; remain in a safe place
                  until awareness is confirmed.
                </li>
                <li>Follow workplace traffic plans, signs and procedures.</li>
              </ul>
            </section>
            <section
              className="forklift-section-three-video"
              aria-labelledby="forklift-section-three-video-heading"
            >
              <h3 id="forklift-section-three-video-heading">
                Watch it in practice
              </h3>
              <p>
                See how limited forklift visibility can make pedestrians
                difficult for an operator to detect.
              </p>
              <div className="forklift-section-three-video-frame">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/xhScsHcIdek"
                  title="Fields of Vision: Pedestrian Safety Around Forklifts — WorkSafeBC"
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="forklift-section-three-video-source">
                <span>Source: WorkSafeBC</span>
                <a
                  href="https://www.youtube.com/watch?v=xhScsHcIdek"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch Fields of Vision: Pedestrian Safety Around Forklifts on YouTube (opens in a new tab)"
                >
                  Watch on YouTube
                </a>
              </div>
            </section>
          </>
        )}
        {section.title === 'Safe Separation' && (
          <>
            <figure className="forklift-section-four-infographic">
              <img
                src={safeSeparationImage}
                alt="Warehouse safety comparison showing unsafe proximity to forklifts and safer separation between pedestrians and forklift operating areas"
              />
            </figure>
            <section
              className="forklift-section-four-points"
              aria-labelledby="forklift-section-four-points-heading"
            >
              <h3 id="forklift-section-four-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>Keep clear of forklift operating areas.</li>
                <li>Use designated pedestrian routes and respect barriers.</li>
                <li>
                  Allow room for forklifts to turn, reverse and manoeuvre.
                </li>
                <li>
                  Reassess your position as vehicles and loads move; follow
                  workplace traffic procedures.
                </li>
              </ul>
            </section>
          </>
        )}
        {section.title === 'Crossing Points and Intersections' && (
          <>
            <section
              className="forklift-section-five-crossing"
              aria-labelledby="forklift-section-five-crossing-heading"
            >
              <h3 id="forklift-section-five-crossing-heading">Cross safely</h3>
              <ol className="forklift-section-five-sequence">
                <li>
                  <span aria-hidden="true">01</span>Use a designated crossing.
                </li>
                <li>
                  <span aria-hidden="true">02</span>Stop before entering the
                  vehicle route.
                </li>
                <li>
                  <span aria-hidden="true">03</span>Look and listen for forklift
                  activity.
                </li>
                <li>
                  <span aria-hidden="true">04</span>Cross only when it is safe.
                </li>
              </ol>
            </section>
            <figure className="forklift-section-five-infographic">
              <img
                src={crossingPointsImage}
                alt="Warehouse pedestrian crossing safety infographic comparing unsafe crossing behaviour with use of a designated crossing point"
              />
            </figure>
            <section
              className="forklift-section-five-points"
              aria-labelledby="forklift-section-five-points-heading"
            >
              <h3 id="forklift-section-five-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>Use designated pedestrian crossing points.</li>
                <li>Stop, look and listen before entering a vehicle route.</li>
                <li>Take extra care at corners and racking intersections.</li>
                <li>
                  Follow workplace signs and traffic procedures; never step
                  suddenly into a forklift path.
                </li>
              </ul>
            </section>
            <section
              className="forklift-section-five-video"
              aria-labelledby="forklift-section-five-video-heading"
            >
              <h3 id="forklift-section-five-video-heading">
                Watch it in practice
              </h3>
              <p>
                See how forklift movement and limited visibility affect
                pedestrians around vehicle operating areas.
              </p>
              <div className="forklift-section-five-video-frame">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/cj91wz7NzCI"
                  title="Forklift pedestrian safety training video"
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="forklift-section-five-video-source">
                <span>Source: Washington State workplace safety training</span>
                <a
                  href="https://www.youtube.com/watch?v=cj91wz7NzCI"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch Forklift Pedestrian Safety training video on YouTube (opens in a new tab)"
                >
                  Watch on YouTube
                </a>
              </div>
            </section>
          </>
        )}
        {section.title === 'Visibility and Communication' && (
          <>
            <div
              className="forklift-section-six-comparison"
              role="group"
              aria-label="Visibility and communication comparison"
            >
              <article className="forklift-section-six-comparison-card">
                <h3>Poor Visibility</h3>
                <img
                  src={poorVisibilityImage}
                  alt="Warehouse pedestrian partially obscured from a forklift operator's view"
                />
                <p>
                  Obstructions can make pedestrians difficult to see. Do not
                  assume the operator has noticed you.
                </p>
              </article>
              <article className="forklift-section-six-comparison-card">
                <h3>Safe Communication</h3>
                <img
                  src={safeCommunicationImage}
                  alt="Pedestrian standing visibly outside the forklift travel path and communicating with the operator"
                />
                <p>
                  Stay visible and confirm the operator is aware of you before
                  approaching or crossing.
                </p>
              </article>
            </div>
            <section
              className="forklift-section-six-points"
              aria-labelledby="forklift-section-six-points-heading"
            >
              <h3 id="forklift-section-six-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>Stay where forklift operators can clearly see you.</li>
                <li>
                  Avoid standing behind loads, racking or other obstructions.
                </li>
                <li>
                  Confirm operator awareness before approaching or crossing.
                </li>
                <li>
                  Use agreed workplace signals and procedures; do not rely only
                  on alarms.
                </li>
              </ul>
            </section>
          </>
        )}
        {section.title === 'Loads and Operating Areas' && (
          <>
            <figure className="forklift-section-seven-infographic">
              <img
                src={loadsOperatingAreasImage}
                alt="Warehouse safety infographic comparing unsafe pedestrian proximity to a forklift load with safer separation from a designated operating area"
              />
            </figure>
            <section
              className="forklift-section-seven-points"
              aria-labelledby="forklift-section-seven-points-heading"
            >
              <h3 id="forklift-section-seven-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>
                  Keep clear of active forklift loading and operating areas.
                </li>
                <li>Never walk beneath a raised load.</li>
                <li>
                  Watch for unstable loads and changing hazard areas as vehicles
                  and loads move.
                </li>
                <li>
                  Follow workplace traffic plans, barriers, signs and
                  procedures.
                </li>
              </ul>
            </section>
          </>
        )}
        {section.title === 'Unsafe Behaviour and Reporting' && (
          <>
            <figure className="forklift-section-eight-infographic">
              <img
                src={unsafeBehaviourReportingImage}
                alt="Warehouse safety infographic comparing unsafe pedestrian behaviour with safer behaviour and reporting of workplace hazards"
              />
            </figure>
            <section
              className="forklift-section-eight-guidance"
              aria-labelledby="forklift-section-eight-guidance-heading"
            >
              <h3 id="forklift-section-eight-guidance-heading">
                If you notice a hazard
              </h3>
              <p>
                Do not ignore damaged barriers or signs, poor visibility, or
                other unsafe conditions. Keep clear and report them through your
                organisation&apos;s normal workplace reporting process.
              </p>
            </section>
            <section
              className="forklift-section-eight-points"
              aria-labelledby="forklift-section-eight-points-heading"
            >
              <h3 id="forklift-section-eight-points-heading">
                Key Learning Points
              </h3>
              <ul>
                <li>
                  Avoid distractions, horseplay and unsafe riding around
                  forklifts.
                </li>
                <li>
                  Use designated pedestrian routes instead of unsafe shortcuts.
                </li>
                <li>
                  Do not ignore damaged barriers, signs or poor visibility.
                </li>
                <li>Report unsafe conditions through workplace procedures.</li>
              </ul>
            </section>
          </>
        )}
      </>
    );
  if (section.title === 'Introduction')
    return (
      <>
        <h3>What is manual handling?</h3>
        <p>{section.body}</p>
        <div className="info-panel">
          Manual handling includes pushing, pulling, carrying and holding, not
          only lifting.
        </div>
        <section
          className="section-one-examples"
          aria-labelledby="section-one-examples-heading"
        >
          <h3 id="section-one-examples-heading">Manual Handling in Practice</h3>
          <div className="section-one-image-grid">
            <figure>
              <img
                src={carryingSafelyImage}
                alt="Warehouse worker carrying a box safely"
              />
              <figcaption>Carrying a load safely</figcaption>
            </figure>
            <figure>
              <img
                src={pushingTrolleyImage}
                alt="Warehouse worker moving boxes using a trolley"
              />
              <figcaption>Using suitable equipment to move loads</figcaption>
            </figure>
          </div>
        </section>
        <section
          className="section-one-points"
          aria-labelledby="section-one-points-heading"
        >
          <h3 id="section-one-points-heading">Key Learning Points</h3>
          <ul>
            <li>
              Manual handling includes lifting, lowering, carrying and holding
              loads.
            </li>
            <li>Pushing and pulling loads are also manual handling.</li>
            <li>Safer manual handling helps reduce avoidable injury.</li>
          </ul>
        </section>
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
          <span>
            You rush a lift or handle a heavy, unstable or hard-to-reach load.
            Make the area safe and use the correct technique or equipment.
          </span>
        </div>
        <figure className="section-two-infographic">
          <img
            src={safeUnsafeImage}
            alt="Comparison of incorrect and correct lifting posture and related injury risks"
          />
        </figure>
        <section
          className="section-two-points"
          aria-labelledby="section-two-points-heading"
        >
          <h3 id="section-two-points-heading">Key Learning Points</h3>
          <ul>
            <li>
              Awkward posture and demanding loads can increase injury risk.
            </li>
            <li>
              Bending mainly from the back or twisting with a load raises
              handling risk.
            </li>
            <li>
              Poor handling can contribute to strains, sprains and back
              discomfort.
            </li>
          </ul>
        </section>
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
        <figure className="section-three-infographic">
          <img
            src={assessTaskImage}
            alt="Warehouse worker assessing a load, checking weight, stability, route and whether help or equipment is needed"
          />
        </figure>
        <section
          className="section-three-points"
          aria-labelledby="section-three-points-heading"
        >
          <h3 id="section-three-points-heading">Key Learning Points</h3>
          <ul>
            <li>
              Check the size, shape, stability and likely weight of the load.
            </li>
            <li>Confirm the route and destination before moving it.</li>
            <li>Use suitable equipment or get assistance when needed.</li>
          </ul>
        </section>
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
            <ul>
              <li>Bending mainly from the back</li>
              <li>Holding the load far away</li>
              <li>Twisting while lifting</li>
              <li>Rushing the movement</li>
              <li>Handling a difficult load without help</li>
            </ul>
          </div>
        </div>
        <h3 className="section-four-sequence-heading">Safe Lifting Sequence</h3>
        <ol className="technique-list">
          {[
            'Plan the lift and check the route.',
            'Establish stable footing.',
            'Bend the knees.',
            'Secure a firm grip.',
            'Keep the load close.',
            'Lift smoothly.',
            'Avoid twisting; turn with the feet.',
            'Get help or use suitable equipment when needed.',
          ].map((step, stepIndex) => (
            <li key={step}>
              <span>{String(stepIndex + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
        <figure className="section-four-infographic">
          <img
            src={safeLiftingImage}
            alt="Warehouse worker demonstrating safe lifting technique with guidance to bend the knees, keep the back straight and keep the load close"
          />
        </figure>
        <section
          className="section-four-recap"
          aria-labelledby="section-four-recap-heading"
        >
          <h3 id="section-four-recap-heading">Remember</h3>
          <p>
            Plan first · Stable footing · Keep the load close · Lift smoothly ·
            Avoid twisting · Get help when needed.
          </p>
        </section>
      </>
    );
  return (
    <>
      <h3>Choose a safer way to move the load</h3>
      <p>
        Not every load should be moved by hand. Before handling a bulky, heavy
        or difficult load, consider whether suitable equipment or assistance
        would provide a safer approach.
      </p>
      <div className="section-five-options">
        <div className="section-five-option">
          <span>Option 1</span>
          <h4>Use suitable equipment</h4>
          <p>
            For bulky or difficult loads, consider suitable handling equipment
            instead of carrying the load by hand.
          </p>
        </div>
        <div className="section-five-option">
          <span>Option 2</span>
          <h4>Ask for support</h4>
          <p>
            If a load cannot be handled safely alone, ask another worker for
            assistance and plan the move together.
          </p>
        </div>
      </div>
      <figure className="section-five-infographic">
        <img
          src={practicalExamplesImage}
          alt="Comparison of unsafe and safer manual handling approaches in a warehouse"
        />
      </figure>
      <section
        className="section-five-recap"
        aria-labelledby="section-five-recap-heading"
      >
        <h3 id="section-five-recap-heading">Remember</h3>
        <p>
          Use suitable equipment or ask for assistance when a load is difficult
          to move by hand.
        </p>
      </section>
    </>
  );
}

function sectionImageFor(title: string): string {
  if (title === 'Introduction') return heroImage;
  return equipmentImage;
}

function sectionImageAlt(title: string): string {
  if (title === 'Introduction')
    return 'Warehouse worker preparing to move a load';
  return 'Worker using safe handling equipment in a warehouse';
}

function CompletionState({
  assignmentId,
  moduleTitle,
  hasScenario,
  scenarioStatus,
  moduleComplete,
  sectionCount,
  celebrating,
}: {
  assignmentId: number;
  moduleTitle: string;
  hasScenario: boolean;
  scenarioStatus: TrainingModuleResponse['scenarioStatus'];
  moduleComplete: boolean;
  sectionCount: number;
  celebrating: boolean;
}) {
  const scenarioIsNext = hasScenario && scenarioStatus !== 'completed';
  const isForklift = moduleTitle === 'Forklift and Pedestrian Safety';
  return (
    <section
      className={`completion-state card${celebrating ? ' is-celebrating' : ''}`}
    >
      {celebrating &&
        createPortal(
          <div className="completion-confetti" aria-hidden="true">
            {Array.from({ length: 60 }, (_, index) => (
              <span
                className={`confetti-piece confetti-piece--${index % 4}`}
                key={index}
                style={getConfettiStyle(index)}
              />
            ))}
          </div>,
          document.body,
        )}
      {celebrating && (
        <div className="completion-celebration-overlay" role="status">
          <div className="completion-celebration-message">
            <span className="completion-celebration-icon" aria-hidden="true">
              ✓
            </span>
            <strong>Congratulations!</strong>
            <span>
              You&apos;ve completed the {moduleTitle} learning content.
            </span>
            <small>
              Next step:{' '}
              {hasScenario ? 'Interactive safety scenario' : 'Final assessment'}
            </small>
          </div>
        </div>
      )}
      <span className="completion-check" aria-hidden="true">
        ✓
      </span>
      <p className="content-kicker">{moduleTitle}</p>
      <h2>
        {moduleComplete ? 'Module complete' : 'Learning content complete'}
      </h2>
      <p>
        {moduleComplete
          ? `You've completed all required ${moduleTitle} training stages.`
          : `You've completed the ${moduleTitle} learning content.`}
      </p>
      <p className="completion-progress">
        {sectionCount} of {sectionCount} sections completed · 100% learning
        progress
      </p>
      {!moduleComplete && (
        <div className="next-stage">
          <strong>Next stage</strong>
          <span>
            {scenarioIsNext
              ? isForklift
                ? 'Interactive 360° Scenario'
                : 'Interactive Warehouse Safety Scenario'
              : 'Final Assessment'}
          </span>
          <small>
            {scenarioIsNext
              ? scenarioStatus === 'in_progress'
                ? 'Continue your warehouse safety inspection and complete the remaining safety points.'
                : isForklift
                  ? 'Explore the warehouse, identify forklift and pedestrian hazards, and make safe decisions.'
                  : 'Apply what you learned in five warehouse safety decisions.'
              : 'Check your understanding in the final graded assessment.'}
          </small>
        </div>
      )}
      <div className="completion-actions">
        {moduleComplete && hasScenario && (
          <Link
            className="dashboard-action"
            to={`/trainee/training/${assignmentId}/scenario?review=1`}
          >
            Review Interactive 360° Scenario
          </Link>
        )}
        {moduleComplete && (
          <Link
            className="dashboard-action ghost"
            to={`/trainee/training/${assignmentId}/assessment?review=1`}
          >
            Review Final Assessment
          </Link>
        )}
        <Link className="dashboard-action ghost" to="/trainee/training">
          Return to My Training
        </Link>
        {!moduleComplete && (
          <Link
            className="dashboard-action"
            to={`/trainee/training/${assignmentId}/${scenarioIsNext ? 'scenario' : 'assessment'}`}
          >
            {scenarioIsNext
              ? scenarioStatus === 'in_progress'
                ? 'Continue Interactive Scenario'
                : 'Start Interactive Scenario'
              : 'Start Final Assessment'}{' '}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
}

function getConfettiStyle(index: number): CSSProperties {
  const group = index % 4;
  const spread = (index * 37) % 96;
  const direction = index % 2 === 0 ? 1 : -1;
  const startX = group === 1 ? -2 : group === 2 ? 102 : 2 + spread;
  const startY =
    group === 0
      ? -3
      : group === 3
        ? 42 + ((index * 11) % 22)
        : 18 + spread * 0.62;
  const burstX =
    group === 1
      ? 22 + (index % 7) * 5
      : group === 2
        ? -(22 + (index % 7) * 5)
        : direction * (8 + (index % 6) * 4);
  const endX = burstX + direction * (4 + (index % 5) * 3);
  const endY = group === 0 ? 108 : group === 3 ? 54 : 72;

  return {
    '--confetti-start-x': `${startX}vw`,
    '--confetti-start-y': `${startY}vh`,
    '--confetti-burst-x': `${burstX}vw`,
    '--confetti-end-x': `${endX}vw`,
    '--confetti-end-y': `${endY}vh`,
    '--confetti-delay': `${(index % 12) * 32}ms`,
    '--confetti-rotation': `${540 + (index % 6) * 90}deg`,
  } as CSSProperties;
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
