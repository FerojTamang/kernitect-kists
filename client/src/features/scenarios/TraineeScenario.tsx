import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { ApiError, apiRequest } from '../../services/api/request';
import { ManualHandling360Viewer } from './ManualHandling360Viewer';
import {
  CALIBRATION_MODE as FORKLIFT_CALIBRATION_MODE,
  ForkliftPedestrian360Viewer,
} from './ForkliftPedestrian360Viewer';
import manualHandlingHeroImage from '../../assets/training/manual-handling/manual-handling-hero.png';
import injuryRiskImage from '../../assets/training/manual-handling/manual-handling-injury-risk.png';
import incorrectLiftingImage from '../../assets/training/manual-handling/incorrect-lifting-posture.png';
import correctLiftingImage from '../../assets/training/manual-handling/correct-lifting-posture.png';
import handlingEquipmentImage from '../../assets/training/manual-handling/safe-handling-equipment.png';
import assessLoadImage from '../../assets/training/manual-handling/assess-load-before-lifting.png';
import distractedPedestrianImage from '../../assets/training/forklift-pedestrian-safety/section-08-unsafe-behaviour-reporting.png';
import pedestrianSeparationImage from '../../assets/training/forklift-pedestrian-safety/section-04-safe-separation.png';
import pedestrianCrossingImage from '../../assets/training/forklift-pedestrian-safety/section-05-crossing-points.png';
import raisedLoadImage from '../../assets/training/forklift-pedestrian-safety/section-07-loads-operating-areas.png';
import forkliftBlindSpotsImage from '../../assets/training/forklift-pedestrian-safety/section-03-forklift-blind-spots.png';
import '../training/training-module.css';
import './scenario.css';
import './scenario-player.css';

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

interface FeedbackVisualConfig {
  image: string;
  alt: string;
}

const FORKLIFT_HAZARD_FEEDBACK_VISUALS: Record<number, FeedbackVisualConfig> = {
  1: {
    image: distractedPedestrianImage,
    alt: 'Warehouse safety infographic showing unsafe distracted pedestrian behaviour and safer reporting practices',
  },
  2: {
    image: pedestrianSeparationImage,
    alt: 'Warehouse safety infographic comparing unsafe proximity to forklifts with safer pedestrian separation',
  },
  3: {
    image: pedestrianCrossingImage,
    alt: 'Warehouse safety infographic showing safe and unsafe behaviour at pedestrian crossing points',
  },
  4: {
    image: raisedLoadImage,
    alt: 'Warehouse safety infographic showing pedestrian safety around forklift loads and operating areas',
  },
  5: {
    image: forkliftBlindSpotsImage,
    alt: 'Forklift blind-spot infographic showing areas where pedestrians may be difficult for the operator to see',
  },
};

const SAVED_INCORRECT_FEEDBACK =
  'Not quite. Review the situation and choose the safer handling decision.';

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

const FORKLIFT_SCENARIO_RESOURCE =
  'asset://scenarios/forklift-pedestrian/forklift-pedestrian-training-360.png';

function savedFeedbackForHazard(
  hazard: ScenarioHazard,
  isForkliftScenario: boolean,
): DecisionFeedback | null {
  if (hazard.answeredCorrectly && hazard.feedback) {
    return { correct: true, message: hazard.feedback };
  }
  if (isForkliftScenario && hazard.selectedDecisionKey) {
    return { correct: false, message: SAVED_INCORRECT_FEEDBACK };
  }
  return null;
}

function nextIncompleteAfter(
  hazards: ScenarioHazard[],
  sequenceOrder: number,
): ScenarioHazard | undefined {
  const incomplete = hazards
    .filter((hazard) => !hazard.answeredCorrectly)
    .sort((first, second) => first.sequenceOrder - second.sequenceOrder);
  return (
    incomplete.find((hazard) => hazard.sequenceOrder > sequenceOrder) ??
    incomplete[0]
  );
}

function ForkliftFeedbackVisual({ visual }: { visual: FeedbackVisualConfig }) {
  return (
    <figure className="forklift-feedback-visual">
      <img src={visual.image} alt={visual.alt} />
    </figure>
  );
}

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
  const [searchParams] = useSearchParams();
  const reviewRequested = searchParams.get('review') === '1';
  const [scenario, setScenario] = useState<TrainingScenarioDetail | null>(null);
  const [activeHazardId, setActiveHazardId] = useState<number | null>(null);
  const [hazardDialogOpen, setHazardDialogOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState('');
  const [feedback, setFeedback] = useState<DecisionFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  } | null>(null);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [justCompletedHazardId, setJustCompletedHazardId] = useState<
    number | null
  >(null);

  function showRailTooltip(target: HTMLElement, label: string) {
    if (!progressCollapsed || progressOpen) return;
    const bounds = target.getBoundingClientRect();
    const sidebar = target.closest('.course-learning-sidebar');
    setRailTooltip({
      label,
      left: (sidebar?.getBoundingClientRect().right ?? bounds.right) + 10,
      top: bounds.top + bounds.height / 2,
    });
  }

  const openHazard = useCallback(
    (hazard: ScenarioHazard) => {
      const isForkliftScenario =
        scenario?.scenario.resourceReference === FORKLIFT_SCENARIO_RESOURCE;
      setActiveHazardId(hazard.id);
      setHazardDialogOpen(true);
      setJustCompletedHazardId(null);
      setSelectedDecision(
        hazard.answeredCorrectly || isForkliftScenario
          ? (hazard.selectedDecisionKey ?? '')
          : '',
      );
      setFeedback(savedFeedbackForHazard(hazard, isForkliftScenario));
    },
    [scenario],
  );

  const selectHazardById = useCallback(
    (hazardId: number) => {
      const hazard = scenario?.hazards.find((item) => item.id === hazardId);
      if (hazard) openHazard(hazard);
    },
    [openHazard, scenario],
  );

  const focusHazard = useCallback(
    (hazard: ScenarioHazard) => {
      setActiveHazardId(hazard.id);
      setHazardDialogOpen(false);
      setProgressOpen(false);
      setJustCompletedHazardId(null);
      setFocusRequestKey((current) => current + 1);
      if (scenario?.scenario.resourceReference === FORKLIFT_SCENARIO_RESOURCE) {
        setSelectedDecision(hazard.selectedDecisionKey ?? '');
        setFeedback(savedFeedbackForHazard(hazard, true));
      }
    },
    [scenario],
  );

  const loadScenario = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(undefined);
    try {
      const payload = await apiRequest<TrainingScenarioDetail>(
        `/trainee/training/${assignmentId}/scenario`,
      );
      setScenario(payload);
      setJustCompletedHazardId(null);
      const firstIncomplete = payload.hazards.find(
        (hazard) => !hazard.answeredCorrectly,
      );
      const initial = firstIncomplete ?? payload.hazards[0];
      if (initial) {
        const isForkliftScenario =
          payload.scenario.resourceReference === FORKLIFT_SCENARIO_RESOURCE;
        setActiveHazardId(initial.id);
        setSelectedDecision(
          initial.answeredCorrectly || isForkliftScenario
            ? (initial.selectedDecisionKey ?? '')
            : '',
        );
        setFeedback(savedFeedbackForHazard(initial, isForkliftScenario));
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
      if (event.key === 'Escape') setHazardDialogOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hazardDialogOpen]);

  const activeHazard =
    scenario?.hazards.find((hazard) => hazard.id === activeHazardId) ?? null;

  async function submitDecision() {
    if (!scenario || !activeHazard || !selectedDecision || submitting) return;
    if (reviewRequested && scenario.progress.completed) return;
    if (
      FORKLIFT_CALIBRATION_MODE &&
      scenario.scenario.resourceReference === FORKLIFT_SCENARIO_RESOURCE
    )
      return;
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
      setJustCompletedHazardId(result.correct ? activeHazard.id : null);
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

  const progressPercent = scenario.progress.totalHazards
    ? Math.round(
        (scenario.progress.completedHazards / scenario.progress.totalHazards) *
          100,
      )
    : 0;

  const isForkliftScenario =
    scenario.scenario.resourceReference === FORKLIFT_SCENARIO_RESOURCE;
  const reviewingCompletedScenario =
    reviewRequested && scenario.progress.completed;
  const isForkliftCalibration = isForkliftScenario && FORKLIFT_CALIBRATION_MODE;
  const moduleName = isForkliftScenario
    ? 'Forklift and Pedestrian Safety'
    : 'Manual Handling';

  const currentPoint = activeHazard?.sequenceOrder ?? 1;
  const nextIncompleteHazard = activeHazard
    ? nextIncompleteAfter(scenario.hazards, activeHazard.sequenceOrder)
    : undefined;
  const continuingAfterCompletion =
    feedback?.correct && justCompletedHazardId === activeHazard?.id;

  return (
    <div
      className={`scenario-page scenario-player course-player${progressCollapsed ? ' progress-collapsed path-collapsed' : ''}${progressOpen ? ' progress-open path-open' : ''}`}
    >
      <aside
        className="course-learning-sidebar scenario-course-sidebar"
        aria-label="Scenario progress"
      >
        <div className="course-brand-row">
          <Link
            className="course-brand-logo"
            to="/trainee/dashboard"
            aria-label="Go to Dashboard"
          >
            <BrandLogo variant="transparent-white" />
          </Link>
          <button
            type="button"
            className="course-path-collapse"
            aria-label={
              progressCollapsed
                ? 'Expand scenario progress'
                : 'Collapse scenario progress'
            }
            onClick={() => {
              setRailTooltip(null);
              setProgressCollapsed((current) => !current);
            }}
          >
            <span className="course-path-chevron" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="course-path-close"
            aria-label="Close safety points"
            onClick={() => setProgressOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="course-module-summary">
          <span>Safety Training Module</span>
          <h2>{moduleName}</h2>
          <p>
            Interactive 360° Scenario
            <br />
            {scenario.progress.completedHazards} of{' '}
            {scenario.progress.totalHazards} safety points complete
          </p>
          <div
            className="course-sidebar-progress"
            role="progressbar"
            aria-label="Interactive scenario progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <nav
          className="module-section-list"
          aria-label="Safety points"
          onScroll={() => setRailTooltip(null)}
        >
          <div className="section-list-heading">
            <p className="content-kicker">Safety Points</p>
          </div>
          <ol>
            {scenario.hazards.map((hazard) => {
              const active = activeHazardId === hazard.id;
              return (
                <li
                  key={hazard.id}
                  className={`${active ? 'active' : ''}${hazard.answeredCorrectly ? ' complete' : ''}`}
                >
                  <button
                    type="button"
                    aria-current={active ? 'step' : undefined}
                    aria-label={`Safety point ${hazard.sequenceOrder}: ${hazard.title}${hazard.answeredCorrectly ? ', completed' : ''}`}
                    disabled={isForkliftCalibration}
                    onClick={() =>
                      reviewingCompletedScenario
                        ? openHazard(hazard)
                        : focusHazard(hazard)
                    }
                    onMouseEnter={(event) =>
                      showRailTooltip(event.currentTarget, hazard.title)
                    }
                    onFocus={(event) =>
                      showRailTooltip(event.currentTarget, hazard.title)
                    }
                    onMouseLeave={(event) => {
                      if (document.activeElement !== event.currentTarget)
                        setRailTooltip(null);
                    }}
                    onBlur={() => setRailTooltip(null)}
                  >
                    <span className="section-number" aria-hidden="true">
                      {hazard.answeredCorrectly ? '✓' : null}
                    </span>
                    <span className="section-order" aria-hidden="true">
                      {String(hazard.sequenceOrder).padStart(2, '0')}
                    </span>
                    <span className="section-summary">
                      <strong>{hazard.title}</strong>
                      <small>
                        {isForkliftCalibration
                          ? 'Calibration target'
                          : hazard.answeredCorrectly
                            ? 'Completed'
                            : active
                              ? 'Current point'
                              : 'Focus hotspot'}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <Link
          className="course-back-link active"
          to={`/trainee/training/${scenario.assignmentId}`}
          onMouseEnter={(event) =>
            showRailTooltip(event.currentTarget, `Back to ${moduleName}`)
          }
          onFocus={(event) =>
            showRailTooltip(event.currentTarget, `Back to ${moduleName}`)
          }
          onMouseLeave={(event) => {
            if (document.activeElement !== event.currentTarget)
              setRailTooltip(null);
          }}
          onBlur={() => setRailTooltip(null)}
        >
          <span aria-hidden="true">←</span>
          <span className="course-back-label">Back to {moduleName}</span>
        </Link>
      </aside>
      <button
        className="scenario-progress-backdrop"
        type="button"
        aria-label="Close safety points"
        onClick={() => setProgressOpen(false)}
      />
      <header className="scenario-page-header">
        <button
          type="button"
          className="scenario-progress-menu"
          aria-label="Open safety points"
          aria-expanded={progressOpen}
          onClick={() => setProgressOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          Safety Points
        </button>
        <div>
          <p className="eyebrow">My Training / {moduleName} / Scenario</p>
          <h1>{scenario.scenario.title}</h1>
          <p>{scenario.scenario.description}</p>
        </div>
        <div className="scenario-header-status">
          <span>
            {isForkliftCalibration
              ? 'Calibration mode'
              : `Safety Point ${currentPoint} of ${scenario.progress.totalHazards}`}
          </span>
          <strong>
            {isForkliftCalibration ? 'Draft' : `${progressPercent}%`}
          </strong>
        </div>
        <Link
          className="scenario-action secondary"
          to={`/trainee/training/${scenario.assignmentId}`}
        >
          ← Back to {moduleName}
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

      {scenario.progress.completed &&
      !reviewingCompletedScenario &&
      !isForkliftCalibration &&
      !hazardDialogOpen ? (
        <ScenarioComplete
          assignmentId={scenario.assignmentId}
          moduleName={moduleName}
          isForkliftScenario={isForkliftScenario}
        />
      ) : (
        <div className="scenario-workspace">
          <section className="scenario-viewer-card card">
            <div className="scenario-viewer-heading">
              <div>
                <p className="scenario-kicker">Interactive warehouse</p>
                <h2>
                  {isForkliftCalibration
                    ? 'Explore the panorama and record hazard positions'
                    : 'Look around and inspect each safety point'}
                </h2>
                <p>
                  {isForkliftCalibration
                    ? 'Drag to inspect the warehouse, then click each hazard target to record its yaw and pitch. These clicks do not save answers or progress.'
                    : 'Drag in any direction to inspect the full 360° warehouse, then choose a numbered safety point. Review the situation and select the safer action.'}
                </p>
              </div>
              <span className="prototype-badge">360° interactive scenario</span>
            </div>

            {isForkliftScenario ? (
              <ForkliftPedestrian360Viewer
                hazards={scenario.hazards}
                activeHazardId={activeHazardId}
                focusRequestKey={focusRequestKey}
                onSelectHazard={selectHazardById}
              />
            ) : (
              <ManualHandling360Viewer
                hazards={scenario.hazards}
                activeHazardId={activeHazardId}
                focusRequestKey={focusRequestKey}
                onSelectHazard={selectHazardById}
              />
            )}

            {!isForkliftCalibration && (
              <div className="scenario-point-strip" aria-label="Safety points">
                {scenario.hazards.map((hazard) => (
                  <button
                    key={hazard.id}
                    type="button"
                    className={`${activeHazardId === hazard.id ? 'active' : ''} ${
                      hazard.answeredCorrectly ? 'complete' : ''
                    }`}
                    onClick={() => focusHazard(hazard)}
                  >
                    <span>
                      {hazard.answeredCorrectly ? '✓' : hazard.sequenceOrder}
                    </span>
                    <span>
                      Safety point {hazard.sequenceOrder}
                      <small>
                        {hazard.answeredCorrectly ? 'Completed' : 'Explore'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {!isForkliftCalibration && (
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
                      The activity is open over the 360° scene so the trainee
                      can inspect, decide and receive feedback without losing
                      their place.
                    </small>
                  </div>
                ) : (
                  <HazardDecisionContent
                    hazard={activeHazard}
                    showTrainingVisual={!isForkliftScenario}
                    feedbackVisual={
                      isForkliftScenario
                        ? FORKLIFT_HAZARD_FEEDBACK_VISUALS[
                            activeHazard.sequenceOrder
                          ]
                        : undefined
                    }
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
                      const next = scenario.hazards.find(
                        (hazard) => !hazard.answeredCorrectly,
                      );
                      if (next) openHazard(next);
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
          )}
        </div>
      )}

      {!isForkliftCalibration && hazardDialogOpen && activeHazard ? (
        <div
          className="scenario-training-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setHazardDialogOpen(false);
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
                aria-label={
                  isForkliftScenario && scenario.progress.completed
                    ? 'Close training activity and view scenario completion'
                    : 'Close training activity and return to the 360 warehouse'
                }
                onClick={() => setHazardDialogOpen(false)}
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
                showTrainingVisual={!isForkliftScenario}
                feedbackVisual={
                  isForkliftScenario
                    ? FORKLIFT_HAZARD_FEEDBACK_VISUALS[
                        activeHazard.sequenceOrder
                      ]
                    : undefined
                }
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
                  const next = scenario.hazards.find(
                    (hazard) => !hazard.answeredCorrectly,
                  );
                  if (next) openHazard(next);
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
                onClick={() => {
                  if (continuingAfterCompletion && nextIncompleteHazard) {
                    focusHazard(nextIncompleteHazard);
                    setSelectedDecision(
                      isForkliftScenario
                        ? (nextIncompleteHazard.selectedDecisionKey ?? '')
                        : '',
                    );
                    setFeedback(
                      savedFeedbackForHazard(
                        nextIncompleteHazard,
                        isForkliftScenario,
                      ),
                    );
                  } else {
                    setHazardDialogOpen(false);
                  }
                  setJustCompletedHazardId(null);
                }}
              >
                {continuingAfterCompletion
                  ? nextIncompleteHazard
                    ? 'Continue to next safety point →'
                    : 'Complete safety inspection →'
                  : isForkliftScenario && scenario.progress.completed
                    ? 'View scenario completion'
                    : 'Continue exploring 360° warehouse'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {progressCollapsed &&
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

function HazardDecisionContent({
  hazard,
  showTrainingVisual = true,
  feedbackVisual,
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
  showTrainingVisual?: boolean;
  feedbackVisual?: FeedbackVisualConfig;
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

      {showTrainingVisual && <HazardTrainingVisual hazard={hazard} />}

      <div className="scenario-training-decision">
        {hazard.answeredCorrectly ? (
          <div className="scenario-feedback correct" role="status">
            <strong>✓ Safety point complete</strong>
            {hazard.selectedDecisionKey && (
              <p>
                Your saved response:{' '}
                {
                  hazard.decisionOptions.find(
                    (option) => option.key === hazard.selectedDecisionKey,
                  )?.label
                }
              </p>
            )}
            <p>{hazard.feedback}</p>
            {feedbackVisual && (
              <ForkliftFeedbackVisual visual={feedbackVisual} />
            )}
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
            {feedbackVisual && (
              <ForkliftFeedbackVisual visual={feedbackVisual} />
            )}
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

function ScenarioComplete({
  assignmentId,
  moduleName,
  isForkliftScenario,
}: {
  assignmentId: number;
  moduleName: string;
  isForkliftScenario: boolean;
}) {
  return (
    <section className="scenario-complete card">
      <span className="scenario-complete-icon" aria-hidden="true">
        ✓
      </span>
      <p className="scenario-kicker">{moduleName}</p>
      <h2>Interactive scenario complete</h2>
      <p>
        {isForkliftScenario
          ? 'You have reviewed all five warehouse traffic safety points and selected the safer pedestrian actions.'
          : 'You have reviewed all five warehouse safety points and selected the safer handling decisions.'}
      </p>
      <div className="scenario-complete-progress">
        <strong>5 of 5 safety objectives completed</strong>
        <span>Scenario status: Complete</span>
      </div>
      <div className="scenario-next-stage">
        <strong>Next stage</strong>
        <span>Final Knowledge Assessment</span>
        <small>Complete the graded assessment to finish {moduleName}.</small>
      </div>
      <div className="scenario-complete-actions">
        <Link
          className="scenario-action secondary"
          to={`/trainee/training/${assignmentId}`}
        >
          Review {moduleName}
        </Link>
        <Link
          className="scenario-action primary"
          to={`/trainee/training/${assignmentId}/assessment`}
        >
          Continue to Final Assessment →
        </Link>
      </div>
      <p className="scenario-complete-note">
        Your scenario result is saved. Continue to the final graded assessment
        to complete this training module.
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
