import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import './assessment.css';

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

export function TraineeAssessment() {
  const { assignmentId } = useParams();
  const [detail, setDetail] = useState<TrainingAssessmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AssessmentSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();

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

  const answeredCount = useMemo(
    () =>
      detail?.questions.filter((question) => answers[question.id]).length ?? 0,
    [answers, detail],
  );

  const allAnswered = Boolean(
    detail &&
    detail.questions.length > 0 &&
    answeredCount === detail.questions.length,
  );

  const passedAttempt = result?.attempt.passed
    ? result.attempt
    : detail?.latestAttempt?.passed
      ? detail.latestAttempt
      : null;

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
            answers: detail.questions.map((question) => ({
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <AssessmentState
        title="Loading final assessment"
        detail="Preparing your Manual Handling questions..."
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
      <div className="assessment-page">
        <header className="assessment-page-header">
          <div>
            <p className="eyebrow">
              My Training / Manual Handling / Assessment
            </p>
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
            You have passed the Manual Handling final assessment. Your training
            progress has been marked complete.
          </p>
          <AttemptSummary attempt={passedAttempt} />
          <div className="assessment-completion-message">
            <strong>Manual Handling complete</strong>
            <span>
              Learning, interactive scenario and final assessment requirements
              are complete.
            </span>
          </div>
          <div className="assessment-actions">
            <Link
              className="assessment-button secondary"
              to={`/trainee/training/${detail.assignmentId}`}
            >
              Review Manual Handling
            </Link>
            <Link
              className="assessment-button primary"
              to="/trainee/certificates"
            >
              View digital certificate →
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (result && !result.attempt.passed) {
    return (
      <div className="assessment-page">
        <header className="assessment-page-header">
          <div>
            <p className="eyebrow">
              My Training / Manual Handling / Assessment
            </p>
            <h1>{detail.assessment.title}</h1>
          </div>
        </header>

        <section className="assessment-result not-passed card" role="status">
          <p className="assessment-kicker">Final assessment result</p>
          <h2>Assessment not passed</h2>
          <p>
            You answered {result.correctAnswers} of {result.totalQuestions}{' '}
            questions correctly. Review the Manual Handling guidance and retry
            when ready.
          </p>
          <AttemptSummary attempt={result.attempt} />
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

  return (
    <div className="assessment-page">
      <header className="assessment-page-header">
        <div>
          <p className="eyebrow">My Training / Manual Handling / Assessment</p>
          <h1>{detail.assessment.title}</h1>
          <p>{detail.assessment.description}</p>
        </div>
        <Link
          className="assessment-button secondary"
          to={`/trainee/training/${detail.assignmentId}/scenario`}
        >
          ← Back to scenario
        </Link>
      </header>

      <section
        className="assessment-overview card"
        aria-label="Assessment overview"
      >
        <div>
          <span>Questions</span>
          <strong>{detail.questions.length}</strong>
        </div>
        <div>
          <span>Prototype pass mark</span>
          <strong>{detail.assessment.passPercentage}%</strong>
        </div>
        <div>
          <span>Answered</span>
          <strong>
            {answeredCount} / {detail.questions.length}
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
        {detail.questions.map((question, index) => (
          <fieldset className="assessment-question card" key={question.id}>
            <legend>
              <span>
                Question {index + 1} of {detail.questions.length}
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
          </fieldset>
        ))}

        {error ? (
          <div className="assessment-error" role="alert">
            {error}
          </div>
        ) : null}

        <section className="assessment-submit card">
          <div>
            <strong>
              {allAnswered
                ? 'All questions answered'
                : `${detail.questions.length - answeredCount} question${detail.questions.length - answeredCount === 1 ? '' : 's'} remaining`}
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
