import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../auth/auth.context';
import type {
  DashboardAssignment,
  TraineeDashboardData,
} from '../trainee/dashboard.types';
import { ApiError, apiRequest } from '../../services/api/request';
import {
  CertificateModal,
  type CertificateStatus,
  type TraineeCertificate,
} from '../certificates/TraineeCertificates';
import './assessment.css';
import './assessment-player.css';

type AssessmentQuestionType = 'single_choice' | 'true_false' | 'free_text';

interface AssessmentAnswerOption {
  id: number;
  optionText: string;
  sequenceOrder: number;
}

interface AssessmentQuestion {
  id: number;
  questionText: string;
  questionType: AssessmentQuestionType;
  sequenceOrder: number;
  options: AssessmentAnswerOption[];
}

interface AssessmentAttemptSummary {
  id: number;
  attemptNumber: number;
  scorePercentage: number;
  passPercentage: number;
  passed: boolean;
  submittedAt: string;
}

interface TrainingAssessmentDetail {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  hasScenario: boolean;
  assessment: {
    id: number;
    title: string;
    description: string;
    passPercentage: number;
    sequenceOrder: number;
  };
  questions: AssessmentQuestion[];
  latestAttempt: AssessmentAttemptSummary | null;
}

interface AssessmentSubmissionResult {
  assignmentId: number;
  assessmentId: number;
  correctAnswers: number;
  totalQuestions: number;
  attempt: AssessmentAttemptSummary;
}

function AssessmentState({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="assessment-state card" role="status">
      <p className="eyebrow">My Training / Manual Handling / Assessment</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      {children}
    </section>
  );
}

function AttemptSummary({ attempt }: { attempt: AssessmentAttemptSummary }) {
  return (
    <div className="assessment-attempt-summary" aria-label="Assessment result">
      <div>
        <span>Attempt</span>
        <strong>{attempt.attemptNumber}</strong>
      </div>
      <div>
        <span>Score</span>
        <strong>{attempt.scorePercentage}%</strong>
      </div>
      <div>
        <span>Prototype pass mark</span>
        <strong>{attempt.passPercentage}%</strong>
      </div>
      <div>
        <span>Status</span>
        <strong>{attempt.passed ? 'Passed' : 'Not passed'}</strong>
      </div>
    </div>
  );
}

function AssessmentResultBrand({ moduleTitle }: { moduleTitle: string }) {
  return (
    <aside
      className="assessment-result-brand"
      aria-label="KISTS assessment result"
    >
      <Link
        className="assessment-result-logo"
        to="/trainee/dashboard"
        aria-label="Go to trainee dashboard"
      >
        <BrandLogo variant="dark" />
      </Link>
      <div>
        <p>{moduleTitle}</p>
        <h2>Final Assessment</h2>
        <span>Official KISTS training result</span>
      </div>
      <small>Kernitect Interactive Safety Training System</small>
    </aside>
  );
}

function AssessmentPassConfetti() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="assessment-pass-confetti" aria-hidden="true">
      {Array.from({ length: 56 }, (_, index) => (
        <span
          key={index}
          className={`assessment-confetti-piece assessment-confetti-piece--${index % 5}`}
          style={assessmentConfettiStyle(index)}
        />
      ))}
    </div>
  );
}

function assessmentConfettiStyle(index: number): CSSProperties {
  const direction = index % 2 === 0 ? 1 : -1;
  return {
    '--assessment-confetti-x': `${2 + ((index * 37) % 96)}vw`,
    '--assessment-confetti-drift': `${direction * (18 + (index % 7) * 6)}px`,
    '--assessment-confetti-delay': `${(index % 12) * 34}ms`,
    '--assessment-confetti-rotation': `${540 + (index % 6) * 90}deg`,
  } as CSSProperties;
}

export function TraineeAssessment() {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<TrainingAssessmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AssessmentSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [issuedCertificate, setIssuedCertificate] =
    useState<TraineeCertificate | null>(null);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [nextRequiredTraining, setNextRequiredTraining] =
    useState<DashboardAssignment | null>(null);
  const [allRequiredTrainingComplete, setAllRequiredTrainingComplete] =
    useState(false);
  const certificateButtonRef = useRef<HTMLButtonElement>(null);

  const loadAssessment = useCallback(async () => {
    if (!assignmentId) {
      setLoading(false);
      setError('A valid training assignment is required.');
      setErrorCode('INVALID_ASSIGNMENT_ID');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(undefined);

    try {
      const payload = await apiRequest<TrainingAssessmentDetail>(
        `/trainee/training/${assignmentId}/assessment`,
      );
      setDetail(payload);
      setResult(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setReviewing(false);
      setIssuedCertificate(null);
      setNextRequiredTraining(null);
      setAllRequiredTrainingComplete(false);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;

      if (requestError instanceof ApiError) {
        setError(requestError.message);
        setErrorCode(requestError.code);
      } else {
        setError('We could not load the final assessment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAssessment(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAssessment]);

  const questions = useMemo(
    () =>
      [...(detail?.questions ?? [])].sort(
        (left, right) => left.sequenceOrder - right.sequenceOrder,
      ),
    [detail?.questions],
  );
  const answeredCount = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions],
  );

  const allAnswered = Boolean(
    detail && questions.length > 0 && answeredCount === questions.length,
  );

  const passedAttempt = result?.attempt.passed
    ? result.attempt
    : detail?.latestAttempt?.passed
      ? detail.latestAttempt
      : null;
  const moduleTitle = detail?.moduleTitle || 'Manual Handling';
  const hasScenario = detail?.hasScenario ?? true;
  const traineeFullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : '';

  useEffect(() => {
    if (!passedAttempt || !detail) return;
    let active = true;
    void Promise.all([
      apiRequest<TraineeDashboardData>('/trainee/dashboard'),
      apiRequest<CertificateStatus>('/trainee/certificates'),
    ])
      .then(([dashboard, certificateStatus]) => {
        if (!active) return;
        const requiredTraining = dashboard.assignedTraining.filter(
          (assignment) => assignment.required,
        );
        const nextTraining = requiredTraining.find(
          (assignment) =>
            assignment.assignmentId !== detail.assignmentId &&
            assignment.status !== 'completed',
        );
        const allComplete =
          requiredTraining.length > 0 &&
          requiredTraining.every(
            (assignment) => assignment.status === 'completed',
          ) &&
          certificateStatus.eligible &&
          certificateStatus.certificate !== null;

        setNextRequiredTraining(nextTraining ?? null);
        setAllRequiredTrainingComplete(allComplete);
        setIssuedCertificate(
          allComplete ? certificateStatus.certificate : null,
        );
      })
      .catch(() => {
        if (active) {
          setNextRequiredTraining(null);
          setAllRequiredTrainingComplete(false);
          setIssuedCertificate(null);
        }
      });
    return () => {
      active = false;
    };
  }, [detail, passedAttempt]);

  const closeCertificateModal = useCallback(
    () => setCertificateOpen(false),
    [],
  );

  async function submitAssessment() {
    if (!detail || !allAnswered || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = await apiRequest<AssessmentSubmissionResult>(
        `/trainee/training/${detail.assignmentId}/assessment/submit`,
        {
          method: 'POST',
          body: JSON.stringify({
            answers: questions.map((question) => ({
              questionId: question.id,
              optionId: answers[question.id],
            })),
          }),
        },
      );

      setResult(payload);
      setDetail((current) =>
        current ? { ...current, latestAttempt: payload.attempt } : current,
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Your assessment could not be submitted. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retryAssessment() {
    setResult(null);
    setAnswers({});
    setError(null);
    setCurrentQuestionIndex(0);
    setReviewing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <AssessmentState
        title="Loading final assessment"
        detail="Preparing your final assessment questions..."
      />
    );
  }

  if (error && !detail) {
    const learningLocked = errorCode === 'ASSESSMENT_LEARNING_LOCKED';
    const scenarioLocked = errorCode === 'ASSESSMENT_SCENARIO_LOCKED';
    const locked = learningLocked || scenarioLocked;

    return (
      <AssessmentState
        title={locked ? 'Assessment locked' : 'Assessment unavailable'}
        detail={error}
      >
        <div className="assessment-state-actions">
          {learningLocked && assignmentId ? (
            <Link
              className="assessment-button primary"
              to={`/trainee/training/${assignmentId}`}
            >
              Return to learning
            </Link>
          ) : scenarioLocked && assignmentId ? (
            <Link
              className="assessment-button primary"
              to={`/trainee/training/${assignmentId}/scenario`}
            >
              Return to scenario
            </Link>
          ) : (
            <button
              className="assessment-button primary"
              type="button"
              onClick={() => void loadAssessment()}
            >
              Try again
            </button>
          )}
          <Link className="assessment-button secondary" to="/trainee/training">
            My Training
          </Link>
        </div>
      </AssessmentState>
    );
  }

  if (!detail) return null;

  if (passedAttempt) {
    return (
      <div className="assessment-page assessment-result-player passed-state">
        <AssessmentPassConfetti />
        <AssessmentResultBrand moduleTitle={moduleTitle} />
        <header className="assessment-page-header">
          <div>
            <p className="eyebrow">My Training / {moduleTitle} / Assessment</p>
            <h1>{detail.assessment.title}</h1>
          </div>
        </header>

        <section className="assessment-result passed card" role="status">
          <span className="assessment-result-icon" aria-hidden="true">
            ✓
          </span>
          <p className="assessment-kicker">Final assessment result</p>
          <h2>Assessment passed</h2>
          <p>
            {traineeFullName
              ? `Congratulations, ${traineeFullName}! You passed with ${passedAttempt.scorePercentage}%.`
              : `Congratulations! You passed with ${passedAttempt.scorePercentage}%.`}
          </p>
          <div className="assessment-result-score">
            <strong>{passedAttempt.scorePercentage}%</strong>
            <span>Your score</span>
            <small>Required pass mark: {passedAttempt.passPercentage}%</small>
          </div>
          <AttemptSummary attempt={passedAttempt} />
          <div className="assessment-completion-message">
            <strong>{moduleTitle} complete</strong>
            <span>
              {hasScenario
                ? 'Learning, interactive scenario and final assessment requirements are complete.'
                : 'Learning and final assessment requirements are complete.'}
            </span>
          </div>
          {allRequiredTrainingComplete && issuedCertificate ? (
            <div className="assessment-overall-completion">
              <h3>All required training complete</h3>
              <p>You have completed all currently required KISTS training.</p>
              <ul>
                {issuedCertificate.training.map((training) => (
                  <li key={training.assignmentId}>{training.moduleTitle}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="assessment-actions">
            <Link
              className="assessment-button secondary"
              to={`/trainee/training/${detail.assignmentId}`}
            >
              Review {moduleTitle}
            </Link>
            <Link
              className="assessment-button secondary"
              to="/trainee/dashboard"
            >
              Return to Dashboard
            </Link>
            {issuedCertificate ? (
              <button
                ref={certificateButtonRef}
                className="assessment-button primary"
                type="button"
                onClick={() => setCertificateOpen(true)}
              >
                View digital certificate →
              </button>
            ) : null}
            {nextRequiredTraining ? (
              <Link
                className="assessment-button primary"
                to={
                  nextRequiredTraining.resumePath ||
                  `/trainee/training/${nextRequiredTraining.assignmentId}`
                }
              >
                Continue to {nextRequiredTraining.title} →
              </Link>
            ) : null}
          </div>
        </section>
        {certificateOpen && issuedCertificate ? (
          <CertificateModal
            certificate={issuedCertificate}
            onClose={closeCertificateModal}
            returnFocusRef={certificateButtonRef}
          />
        ) : null}
      </div>
    );
  }

  if (result && !result.attempt.passed) {
    return (
      <div className="assessment-page assessment-result-player failed-state">
        <AssessmentResultBrand moduleTitle={moduleTitle} />
        <header className="assessment-page-header">
          <div>
            <p className="eyebrow">My Training / {moduleTitle} / Assessment</p>
            <h1>{detail.assessment.title}</h1>
          </div>
        </header>

        <section className="assessment-result not-passed card" role="status">
          <p className="assessment-kicker">Final assessment result</p>
          <h2>Assessment not passed</h2>
          <p>
            You scored {result.attempt.scorePercentage}%. The required pass mark
            is {result.attempt.passPercentage}%.
          </p>
          <div className="assessment-result-score">
            <strong>{result.attempt.scorePercentage}%</strong>
            <span>Your score</span>
            <small>
              {result.correctAnswers} of {result.totalQuestions} correct
            </small>
          </div>
          <AttemptSummary attempt={result.attempt} />
          <p className="assessment-result-guidance">
            Review the {moduleTitle} learning content and try again when you are
            ready.
          </p>
          <div className="assessment-actions">
            <Link
              className="assessment-button secondary"
              to={`/trainee/training/${detail.assignmentId}`}
            >
              Review learning
            </Link>
            <button
              className="assessment-button primary"
              type="button"
              onClick={retryAssessment}
            >
              Retry assessment
            </button>
          </div>
        </section>
      </div>
    );
  }

  const answerProgress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div
      className={`assessment-page assessment-player${progressCollapsed ? ' progress-collapsed' : ''}${progressOpen ? ' progress-open' : ''}`}
    >
      <aside
        className="assessment-progress-sidebar"
        aria-label="Assessment progress"
      >
        <div className="assessment-sidebar-brand">
          <Link
            className="assessment-brand-logo"
            to="/trainee/dashboard"
            aria-label="Go to trainee dashboard"
          >
            <BrandLogo variant="dark" />
          </Link>
          <button
            type="button"
            className="assessment-progress-close"
            aria-label="Close questions"
            onClick={() => setProgressOpen(false)}
          >
            ×
          </button>
        </div>
        <button
          type="button"
          className="assessment-progress-collapse"
          aria-label={
            progressCollapsed
              ? 'Expand assessment progress'
              : 'Collapse assessment progress'
          }
          onClick={() => setProgressCollapsed((current) => !current)}
        >
          <span aria-hidden="true">{progressCollapsed ? '›' : '‹'}</span>
        </button>
        <div className="assessment-module-summary">
          <p>{moduleTitle}</p>
          <h2>Final Assessment</h2>
          <span>
            {questions.length} Questions · Prototype pass mark{' '}
            {detail.assessment.passPercentage}%
          </span>
          <span>
            {answeredCount} of {questions.length} answered
          </span>
          <div className="assessment-sidebar-progress" aria-hidden="true">
            <span style={{ width: `${answerProgress}%` }} />
          </div>
        </div>
        <nav
          className="assessment-question-nav"
          aria-label="Assessment questions"
        >
          <p>Assessment progress</p>
          <ol>
            {questions.map((question, index) => {
              const answered = Boolean(answers[question.id]);
              const current = !reviewing && currentQuestionIndex === index;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    className={`${current ? 'current' : ''}${answered ? ' answered' : ''}`}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Question ${index + 1}${answered ? ', answered' : ', unanswered'}${current ? ', current' : ''}`}
                    onClick={() => {
                      setCurrentQuestionIndex(index);
                      setReviewing(false);
                      setProgressOpen(false);
                    }}
                  >
                    <span>
                      {answered ? '✓' : String(index + 1).padStart(2, '0')}
                    </span>
                    {current ? <small>Current</small> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <Link
          className="assessment-back-link"
          to={`/trainee/training/${detail.assignmentId}${hasScenario ? '/scenario' : ''}`}
        >
          <span aria-hidden="true">←</span>
          <span>{hasScenario ? 'Back to Scenario' : 'Back to Learning'}</span>
        </Link>
      </aside>
      <button
        type="button"
        className="assessment-progress-backdrop"
        aria-label="Close questions"
        onClick={() => setProgressOpen(false)}
      />
      <header className="assessment-page-header">
        <button
          type="button"
          className="assessment-progress-menu"
          aria-label="Open questions"
          aria-expanded={progressOpen}
          onClick={() => setProgressOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          Questions
        </button>
        <div>
          <p className="eyebrow">My Training / {moduleTitle} / Assessment</p>
          <h1>{detail.assessment.title}</h1>
          <p>{detail.assessment.description}</p>
        </div>
        <div className="assessment-header-progress">
          <span>
            {reviewing
              ? 'Review answers'
              : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
          </span>
          <strong>{answerProgress}%</strong>
        </div>
        <Link
          className="assessment-button secondary"
          to={`/trainee/training/${detail.assignmentId}${hasScenario ? '/scenario' : ''}`}
        >
          ← Back to {hasScenario ? 'scenario' : 'learning'}
        </Link>
      </header>

      <section
        className="assessment-overview card"
        aria-label="Assessment overview"
      >
        <div>
          <span>Questions</span>
          <strong>{questions.length}</strong>
        </div>
        <div>
          <span>Prototype pass mark</span>
          <strong>{detail.assessment.passPercentage}%</strong>
        </div>
        <div>
          <span>Answered</span>
          <strong>
            {answeredCount} / {questions.length}
          </strong>
        </div>
      </section>

      {detail.latestAttempt && !detail.latestAttempt.passed ? (
        <section className="assessment-previous-attempt card" role="status">
          <strong>
            Previous attempt: {detail.latestAttempt.scorePercentage}%
          </strong>
          <span>
            Attempt {detail.latestAttempt.attemptNumber} was not passed. You may
            retry the assessment.
          </span>
        </section>
      ) : null}

      <form
        className="assessment-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitAssessment();
        }}
      >
        {questions.map((question, index) => (
          <fieldset
            className="assessment-question card"
            key={question.id}
            hidden={reviewing || currentQuestionIndex !== index}
          >
            <legend>
              <span>
                Question {index + 1} of {questions.length}
              </span>
              {question.questionText}
            </legend>

            <div className="assessment-options">
              {question.options.map((option) => (
                <label
                  className={`assessment-option ${answers[question.id] === option.id ? 'selected' : ''}`}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name={`assessment-question-${question.id}`}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.id,
                      }))
                    }
                  />
                  <span>{option.optionText}</span>
                </label>
              ))}
            </div>

            <div className="assessment-question-actions">
              <button
                className="assessment-button secondary"
                type="button"
                disabled={index === 0}
                onClick={() => setCurrentQuestionIndex(index - 1)}
              >
                ← Previous
              </button>
              <button
                className="assessment-button primary"
                type="button"
                onClick={() => {
                  if (index === questions.length - 1) {
                    setReviewing(true);
                  } else {
                    setCurrentQuestionIndex(index + 1);
                  }
                }}
              >
                {index === questions.length - 1 ? 'Review answers' : 'Next →'}
              </button>
            </div>
          </fieldset>
        ))}

        {reviewing ? (
          <section
            className="assessment-review card"
            aria-labelledby="assessment-review-title"
          >
            <p className="assessment-kicker">Final assessment review</p>
            <h2 id="assessment-review-title">Review your answers</h2>
            <p>
              Confirm every question has an answer before submitting. KISTS
              calculates your score only after final submission.
            </p>
            <div className="assessment-review-grid">
              {questions.map((question, index) => {
                const answered = Boolean(answers[question.id]);
                return (
                  <button
                    type="button"
                    className={answered ? 'answered' : 'unanswered'}
                    key={question.id}
                    onClick={() => {
                      setCurrentQuestionIndex(index);
                      setReviewing(false);
                    }}
                  >
                    <span>
                      {answered ? '✓' : String(index + 1).padStart(2, '0')}
                    </span>
                    <strong>Question {index + 1}</strong>
                    <small>{answered ? 'Answered' : 'Unanswered'}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="assessment-error" role="alert">
            {error}
          </div>
        ) : null}

        <section className="assessment-submit card" hidden={!reviewing}>
          <div>
            <strong>
              {allAnswered
                ? 'All questions answered'
                : `${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? '' : 's'} remaining`}
            </strong>
            <span>
              Your score is calculated by KISTS only after you submit the final
              assessment.
            </span>
          </div>
          <button
            className="assessment-button primary"
            type="submit"
            disabled={!allAnswered || submitting}
          >
            {submitting ? 'Submitting assessment…' : 'Submit final assessment'}
          </button>
        </section>
      </form>
    </div>
  );
}
