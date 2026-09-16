import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../../services/api/request';
import { ManualHandling360Viewer } from './ManualHandling360Viewer';
import manualHandlingHeroImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import injuryRiskImage from '../../assets/training/manual-handling/manual-handling-injury-risk.png';
import incorrectLiftingImage from '../../assets/training/manual-handling/incorrect-lifting-posture.png';
import correctLiftingImage from '../../assets/training/manual-handling/correct-lifting-posture.png';
import handlingEquipmentImage from '../../assets/training/manual-handling/safe-handling-equipment.png';
import assessLoadImage from '../../assets/training/manual-handling/assess-load-before-lifting.png';
import './scenario.css';

interface ScenarioDecisionOption {
  key: string;
  label: string;
}

interface ScenarioHazard {
  id: number;
  title: string;
  description: string;
  hotspotYaw: number;
  hotspotPitch: number;
  sequenceOrder: number;
  decisionPrompt: string;
  decisionOptions: ScenarioDecisionOption[];
  selectedDecisionKey: string | null;
  answeredCorrectly: boolean;
  feedback: string | null;
}

interface TrainingScenarioDetail {
  assignmentId: number;
  moduleId: number;
  scenario: {
    id: number;
    title: string;
    description: string;
    resourceReference: string;
    sequenceOrder: number;
  };
  progress: {
    completedHazards: number;
    totalHazards: number;
    completed: boolean;
    startedAt: string;
    completedAt: string | null;
  };
  hazards: ScenarioHazard[];
}

interface ScenarioAnswerResult {
  hazardId: number;
  selectedDecisionKey: string;
  correct: boolean;
  feedback: string;
  scenario: TrainingScenarioDetail;
}

interface DecisionFeedback {
  correct: boolean;
  message: string;
}

interface HazardVisualConfig {
  image: string;
  alt: string;
  observation: string;
  focus: string;
  completedImage?: string;
  completedAlt?: string;
  completedFocus?: string;
}

const HAZARD_VISUALS: Record<number, HazardVisualConfig> = {
  1: {
    image: manualHandlingHeroImage,
    alt: 'Warehouse manual-handling training visual showing a worker and load in a handling area.',
    observation: 'Inspect the route before moving the load.',
    focus:
      'Look for anything that could obstruct the planned handling path or force an unsafe change of direction.',
  },
  2: {
    image: injuryRiskImage,
    alt: 'Manual-handling risk training visual used to support inspection of an unstable load.',
    observation: 'Inspect the load before you approach it.',
    focus:
      'Consider whether the load is stable, secure and safe to handle before attempting to move it.',
  },
  3: {
    image: incorrectLiftingImage,
    alt: 'Worker demonstrating an unsafe manual lifting posture.',
    observation: 'Inspect the lifting posture.',
    focus:
      "Look at the worker's back, leg position, distance from the load and whether twisting is involved.",
    completedImage: correctLiftingImage,
    completedAlt: 'Worker demonstrating a safer manual lifting posture.',
    completedFocus:
      'Safer technique: use a stable stance, bend through the knees, keep the load close and avoid twisting.',
  },
  4: {
    image: handlingEquipmentImage,
    alt: 'Manual-handling equipment training visual showing safer use of handling equipment.',
    observation: 'Decide whether manual lifting is necessary.',
    focus:
      'Consider whether available handling equipment would reduce the physical effort and risk.',
    completedFocus:
      'Use suitable handling equipment when the task can be completed more safely with mechanical assistance.',
  },
  5: {
    image: assessLoadImage,
    alt: 'Worker assessing a load before attempting to lift it.',
    observation: 'Assess the load before committing to the lift.',
    focus:
      'Think about weight, size, grip, visibility and whether a second person or another control is needed.',
    completedFocus:
      'If the load cannot be handled safely by one person, obtain assistance or use a suitable handling aid.',
  },
};

function HazardTrainingVisual({ hazard }: { hazard: ScenarioHazard }) {
  const visual = HAZARD_VISUALS[hazard.sequenceOrder];

  if (!visual) return null;

  const completed = hazard.answeredCorrectly;
  const image =
    completed && visual.completedImage ? visual.completedImage : visual.image;
  const alt =
    completed && visual.completedAlt ? visual.completedAlt : visual.alt;
  const focus =
    completed && visual.completedFocus ? visual.completedFocus : visual.focus;

  return (
    <figure
      className={`scenario-training-visual ${completed ? 'complete' : ''}`}
    >
      <div className="scenario-training-visual-media">
        <img src={image} alt={alt} />
        <span className="scenario-training-visual-badge">
          {completed ? '✓ Safer practice' : 'Inspect this area'}
        </span>
      </div>
      <figcaption>
        <strong>
          {completed ? 'What good practice looks like' : visual.observation}
        </strong>
        <p>{focus}</p>
      </figcaption>
    </figure>
  );
}

export function TraineeScenario() {
  const { assignmentId } = useParams();
  const [scenario, setScenario] = useState<TrainingScenarioDetail | null>(null);
  const [activeHazardId, setActiveHazardId] = useState<number | null>(null);
  const [hazardDialogOpen, setHazardDialogOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState('');
  const [feedback, setFeedback] = useState<DecisionFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();

  const openHazard = useCallback((hazard: ScenarioHazard) => {
    setActiveHazardId(hazard.id);
    setHazardDialogOpen(true);
    setSelectedDecision(
      hazard.answeredCorrectly ? (hazard.selectedDecisionKey ?? '') : '',
    );
    setFeedback(
      hazard.answeredCorrectly && hazard.feedback
        ? { correct: true, message: hazard.feedback }
        : null,
    );
  }, []);

  const selectHazardById = useCallback(
    (hazardId: number) => {
      if (!scenario) return;

      const hazard = scenario.hazards.find((item) => item.id === hazardId);
      if (!hazard) return;

      const currentIncomplete = scenario.hazards.find(
        (item) => !item.answeredCorrectly,
      );

      const unlocked =
        hazard.answeredCorrectly || hazard.id === currentIncomplete?.id;

      if (unlocked) {
        openHazard(hazard);
      }
    },
    [openHazard, scenario],
  );

  const closeTrainingDialog = useCallback(() => {
    setHazardDialogOpen(false);

    if (!scenario || activeHazardId === null) {
      return;
    }

    const active = scenario.hazards.find(
      (hazard) => hazard.id === activeHazardId,
    );

    if (!active?.answeredCorrectly) {
      return;
    }

    const nextIncomplete = scenario.hazards.find(
      (hazard) => !hazard.answeredCorrectly,
    );

    if (!nextIncomplete) {
      return;
    }

    setActiveHazardId(nextIncomplete.id);
    setSelectedDecision('');
    setFeedback(null);
  }, [activeHazardId, scenario]);

  const loadScenario = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(undefined);
    try {
      const payload = await apiRequest<TrainingScenarioDetail>(
        `/trainee/training/${assignmentId}/scenario`,
      );
      setScenario(payload);
      const firstIncomplete = payload.hazards.find(
        (hazard) => !hazard.answeredCorrectly,
      );
      const initial = firstIncomplete ?? payload.hazards[0];
      if (initial) {
        setActiveHazardId(initial.id);
        setSelectedDecision(
          initial.answeredCorrectly ? (initial.selectedDecisionKey ?? '') : '',
        );
        setFeedback(
          initial.answeredCorrectly && initial.feedback
            ? { correct: true, message: initial.feedback }
            : null,
        );
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      if (requestError instanceof ApiError) {
        setError(requestError.message);
        setErrorCode(requestError.code);
      } else {
        setError(
          'We could not load the interactive scenario. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadScenario(), 0);
    return () => window.clearTimeout(timer);
  }, [loadScenario]);

  useEffect(() => {
    if (!hazardDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTrainingDialog();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeTrainingDialog, hazardDialogOpen]);

  const activeHazard =
    scenario?.hazards.find((hazard) => hazard.id === activeHazardId) ?? null;

  async function submitDecision() {
    if (!scenario || !activeHazard || !selectedDecision || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<ScenarioAnswerResult>(
        `/trainee/training/${scenario.assignmentId}/scenario/hazards/${activeHazard.id}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({ decisionKey: selectedDecision }),
        },
      );
      setScenario(result.scenario);
      setFeedback({ correct: result.correct, message: result.feedback });
      if (result.correct) {
        const updated = result.scenario.hazards.find(
          (hazard) => hazard.id === activeHazard.id,
        );
        if (updated) setSelectedDecision(updated.selectedDecisionKey ?? '');
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401)
        return;
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Your scenario decision could not be saved. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retryDecision() {
    setSelectedDecision('');
    setFeedback(null);
  }

  if (loading)
    return (
      <ScenarioState
        title="Loading warehouse scenario"
        detail="Preparing the interactive safety environment..."
      />
    );

  if (error || !scenario) {
    const locked = errorCode === 'SCENARIO_LOCKED';
    return (
      <ScenarioState
        title={locked ? 'Scenario locked' : 'Scenario unavailable'}
        detail={error ?? 'Please try again.'}
      >
        <div className="scenario-state-actions">
          {locked && assignmentId ? (
            <Link
              className="scenario-action primary"
              to={`/trainee/training/${assignmentId}`}
            >
              Return to learning
            </Link>
          ) : (
            <button
              className="scenario-action primary"
              type="button"
              onClick={() => void loadScenario()}
            >
              Try again
            </button>
          )}
          <Link className="scenario-action secondary" to="/trainee/training">
            My Training
          </Link>
        </div>
      </ScenarioState>
    );
  }

  const currentIncompleteHazard =
    scenario.hazards.find((hazard) => !hazard.answeredCorrectly) ?? null;

  const viewerHazards = scenario.hazards.filter(
    (hazard) =>
      hazard.answeredCorrectly || hazard.id === currentIncompleteHazard?.id,
  );

  const progressPercent = scenario.progress.totalHazards
    ? Math.round(
        (scenario.progress.completedHazards / scenario.progress.totalHazards) *
          100,
      )
    : 0;

  return (
    <div className="scenario-page">
      <header className="scenario-page-header">
        <div>
          <p className="eyebrow">My Training / Manual Handling / Scenario</p>
          <h1>{scenario.scenario.title}</h1>
          <p>{scenario.scenario.description}</p>
        </div>
        <Link
          className="scenario-action secondary"
          to={`/trainee/training/${scenario.assignmentId}`}
        >
          ← Back to Manual Handling
        </Link>
      </header>

      <section className="scenario-summary card" aria-label="Scenario progress">
        <div>
          <span className="scenario-summary-label">Safety objectives</span>
          <strong>
            {scenario.progress.completedHazards} of{' '}
            {scenario.progress.totalHazards} completed
          </strong>
        </div>
        <div
          className="scenario-progress-track"
          role="progressbar"
          aria-label="Interactive scenario progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="scenario-progress-value">{progressPercent}%</span>
      </section>

      {scenario.progress.completed ? (
        <ScenarioComplete assignmentId={scenario.assignmentId} />
      ) : (
        <div className="scenario-workspace">
          <section className="scenario-viewer-card card">
            <div className="scenario-viewer-heading">
              <div>
                <p className="scenario-kicker">Interactive warehouse</p>
                <h2>Look around and inspect each safety point</h2>
                <p>
                  Drag in any direction to inspect the full 360° warehouse, then
                  choose a numbered safety point. Review the situation and
                  select the safer action.
                </p>
              </div>
              <span className="prototype-badge">360° interactive scenario</span>
            </div>

            <ManualHandling360Viewer
              hazards={viewerHazards}
              activeHazardId={activeHazardId}
              onSelectHazard={selectHazardById}
            />

            <div className="scenario-point-strip" aria-label="Safety points">
              {scenario.hazards.map((hazard) => {
                const locked =
                  !hazard.answeredCorrectly &&
                  hazard.id !== currentIncompleteHazard?.id;

                return (
                  <button
                    key={hazard.id}
                    type="button"
                    disabled={locked}
                    aria-disabled={locked}
                    className={`${activeHazardId === hazard.id ? 'active' : ''} ${
                      hazard.answeredCorrectly ? 'complete' : ''
                    } ${locked ? 'locked' : ''}`}
                    onClick={() => {
                      if (!locked) openHazard(hazard);
                    }}
                  >
                    <span>
                      {hazard.answeredCorrectly
                        ? '✓'
                        : locked
                          ? '🔒'
                          : hazard.sequenceOrder}
                    </span>
                    <span>
                      Safety point {hazard.sequenceOrder}
                      <small>
                        {hazard.answeredCorrectly
                          ? 'Completed'
                          : locked
                            ? 'Locked'
                            : 'Current'}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="scenario-decision-panel card" aria-live="polite">
            {activeHazard ? (
              hazardDialogOpen ? (
                <div className="scenario-panel-selected">
                  <p className="scenario-kicker">Selected safety point</p>
                  <span className="scenario-panel-selected-number">
                    {activeHazard.answeredCorrectly
                      ? '✓'
                      : activeHazard.sequenceOrder}
                  </span>
                  <h2>{activeHazard.title}</h2>
                  <p>{activeHazard.description}</p>
                  <button
                    className="scenario-action primary full-width"
                    type="button"
                    onClick={() => setHazardDialogOpen(true)}
                  >
                    Open training activity
                  </button>
                  <small>
                    The activity is open over the 360° scene so the trainee can
                    inspect, decide and receive feedback without losing their
                    place.
                  </small>
                </div>
              ) : (
                <HazardDecisionContent
                  hazard={activeHazard}
                  totalHazards={scenario.progress.totalHazards}
                  completedHazards={scenario.progress.completedHazards}
                  selectedDecision={selectedDecision}
                  submitting={submitting}
                  feedback={feedback}
                  onSelectDecision={(value) => {
                    setSelectedDecision(value);
                    setFeedback(null);
                  }}
                  onSubmit={() => void submitDecision()}
                  onRetry={retryDecision}
                  onFindNext={() => {
                    if (currentIncompleteHazard) {
                      openHazard(currentIncompleteHazard);
                    }
                  }}
                />
              )
            ) : (
              <div className="scenario-panel-empty">
                <p className="scenario-kicker">Safety decision</p>
                <h2>Select a safety point</h2>
                <p>
                  Choose a numbered marker in the warehouse to inspect the
                  situation.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {hazardDialogOpen && activeHazard ? (
        <div
          className="scenario-training-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTrainingDialog();
            }
          }}
        >
          <section
            className="scenario-training-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-training-dialog-title"
          >
            <header className="scenario-training-dialog-header">
              <div>
                <p className="scenario-kicker">
                  Interactive safety inspection · Point{' '}
                  {activeHazard.sequenceOrder} of{' '}
                  {scenario.progress.totalHazards}
                </p>
                <h2 id="scenario-training-dialog-title">
                  {activeHazard.title}
                </h2>
                <p>{activeHazard.description}</p>
              </div>
              <button
                type="button"
                className="scenario-dialog-close"
                aria-label="Close training activity and return to the 360 warehouse"
                onClick={closeTrainingDialog}
              >
                ×
              </button>
            </header>

            <div
              className="scenario-training-dialog-steps"
              aria-label="Training activity steps"
            >
              <span className="active">1 Inspect</span>
              <span
                className={
                  selectedDecision || activeHazard.answeredCorrectly
                    ? 'active'
                    : ''
                }
              >
                2 Decide
              </span>
              <span
                className={
                  feedback || activeHazard.answeredCorrectly ? 'active' : ''
                }
              >
                3 Feedback
              </span>
            </div>

            <div className="scenario-training-dialog-body">
              <HazardDecisionContent
                hazard={activeHazard}
                totalHazards={scenario.progress.totalHazards}
                completedHazards={scenario.progress.completedHazards}
                selectedDecision={selectedDecision}
                submitting={submitting}
                feedback={feedback}
                dialogMode
                onSelectDecision={(value) => {
                  setSelectedDecision(value);
                  setFeedback(null);
                }}
                onSubmit={() => void submitDecision()}
                onRetry={retryDecision}
                onFindNext={() => {
                  if (currentIncompleteHazard) {
                    openHazard(currentIncompleteHazard);
                  }
                }}
              />
            </div>

            <footer className="scenario-training-dialog-footer">
              <span>
                {scenario.progress.completedHazards} /{' '}
                {scenario.progress.totalHazards} safety points complete
              </span>
              <button
                type="button"
                className="scenario-action secondary"
                onClick={closeTrainingDialog}
              >
                Continue exploring 360° warehouse
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HazardDecisionContent({
  hazard,
  totalHazards,
  completedHazards,
  selectedDecision,
  submitting,
  feedback,
  dialogMode = false,
  onSelectDecision,
  onSubmit,
  onRetry,
  onFindNext,
}: {
  hazard: ScenarioHazard;
  totalHazards: number;
  completedHazards: number;
  selectedDecision: string;
  submitting: boolean;
  feedback: DecisionFeedback | null;
  dialogMode?: boolean;
  onSelectDecision: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onFindNext: () => void;
}) {
  return (
    <div
      className={`scenario-decision-content ${dialogMode ? 'dialog-mode' : ''}`}
    >
      {!dialogMode ? (
        <div className="scenario-decision-heading">
          <p className="scenario-kicker">
            Safety point {hazard.sequenceOrder} of {totalHazards}
          </p>
          <h2>{hazard.title}</h2>
          <p>{hazard.description}</p>
        </div>
      ) : null}

      <HazardTrainingVisual hazard={hazard} />

      <div className="scenario-training-decision">
        {hazard.answeredCorrectly ? (
          <div className="scenario-feedback correct" role="status">
            <strong>✓ Safety point complete</strong>
            <p>{hazard.feedback}</p>
          </div>
        ) : (
          <fieldset className="scenario-decision-options" disabled={submitting}>
            <legend>{hazard.decisionPrompt}</legend>
            {hazard.decisionOptions.map((option) => (
              <label
                key={option.key}
                className={selectedDecision === option.key ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name={`hazard-${hazard.id}-${dialogMode ? 'dialog' : 'panel'}`}
                  value={option.key}
                  checked={selectedDecision === option.key}
                  onChange={() => onSelectDecision(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {!hazard.answeredCorrectly ? (
          <button
            className="scenario-action primary full-width"
            type="button"
            disabled={!selectedDecision || submitting}
            onClick={onSubmit}
          >
            {submitting ? 'Checking decision…' : 'Check decision'}
          </button>
        ) : null}

        {feedback && !hazard.answeredCorrectly ? (
          <div
            className={`scenario-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
            role="status"
          >
            <strong>{feedback.correct ? '✓ Correct' : '✕ Not quite'}</strong>
            <p>{feedback.message}</p>
            {!feedback.correct ? (
              <button
                className="scenario-action secondary compact"
                type="button"
                onClick={onRetry}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!dialogMode ? (
        <div className="scenario-panel-footer">
          <span>
            {completedHazards} / {totalHazards} safety points complete
          </span>
          <button
            type="button"
            className="scenario-text-button"
            onClick={onFindNext}
          >
            Find next incomplete point →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ScenarioComplete({ assignmentId }: { assignmentId: number }) {
  return (
    <section className="scenario-complete card">
      <span className="scenario-complete-icon" aria-hidden="true">
        ✓
      </span>
      <p className="scenario-kicker">Manual Handling</p>
      <h2>Interactive scenario complete</h2>
      <p>
        You have reviewed all five warehouse safety points and selected the
        safer handling decisions.
      </p>
      <div className="scenario-complete-progress">
        <strong>5 of 5 safety objectives completed</strong>
        <span>Scenario status: Complete</span>
      </div>
      <div className="scenario-next-stage">
        <strong>Next stage</strong>
        <span>Final Knowledge Assessment</span>
        <small>Coming in Phase 7</small>
      </div>
      <div className="scenario-complete-actions">
        <Link
          className="scenario-action secondary"
          to={`/trainee/training/${assignmentId}`}
        >
          Review Manual Handling
        </Link>
        <Link className="scenario-action primary" to="/trainee/assessments">
          Continue to Final Assessment →
        </Link>
      </div>
      <p className="scenario-complete-note">
        The final graded assessment is the next prototype stage and will be
        implemented in Phase 7.
      </p>
    </section>
  );
}

function ScenarioState({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <section className="scenario-state card" role="status">
      <p className="eyebrow">KISTS / Interactive scenario</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      {children}
    </section>
  );
}
