import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ScenarioRepository } from './scenario.repository.js';
import type {
  ScenarioAnswerResult,
  ScenarioDecisionOption,
  ScenarioHazard,
  TrainingScenarioDetail,
} from './scenario.types.js';

interface HazardMetadata {
  decisionPrompt?: unknown;
  decisionOptions?: unknown;
}

function parseDecisionOptions(value: unknown): ScenarioDecisionOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('key' in candidate) ||
      !('label' in candidate) ||
      typeof candidate.key !== 'string' ||
      typeof candidate.label !== 'string' ||
      !candidate.key.trim() ||
      !candidate.label.trim()
    )
      return [];
    return [{ key: candidate.key, label: candidate.label }];
  });
}

function parseHazardMetadata(value: unknown): {
  decisionPrompt: string;
  decisionOptions: ScenarioDecisionOption[];
} {
  const metadata: HazardMetadata =
    typeof value === 'object' && value !== null ? value : {};
  const decisionPrompt =
    typeof metadata.decisionPrompt === 'string'
      ? metadata.decisionPrompt.trim()
      : '';
  const decisionOptions = parseDecisionOptions(metadata.decisionOptions);
  if (!decisionPrompt || decisionOptions.length < 2) {
    throw new Error('Scenario hazard metadata is incomplete.');
  }
  return { decisionPrompt, decisionOptions };
}

export class ScenarioService {
  constructor(private readonly repository: ScenarioRepository) {}

  async getScenario(
    user: AuthUser,
    assignmentId: number,
  ): Promise<TrainingScenarioDetail> {
    const context = await this.repository.findScenarioContext(
      user.id,
      assignmentId,
    );
    if (!context) {
      throw new HttpError(
        404,
        'That interactive scenario is not available for your account.',
        'SCENARIO_NOT_FOUND',
      );
    }
    if (
      context.activeSectionCount === 0 ||
      context.completedSectionCount < context.activeSectionCount
    ) {
      throw new HttpError(
        409,
        'Complete the Manual Handling learning sections before starting the interactive scenario.',
        'SCENARIO_LOCKED',
      );
    }

    const attempt = await this.repository.ensureAttempt(
      user.id,
      assignmentId,
      context.scenarioId,
    );
    if (!attempt) {
      throw new HttpError(
        404,
        'That interactive scenario is not available for your account.',
        'SCENARIO_NOT_FOUND',
      );
    }

    await this.repository.completeAttemptIfReady(
      attempt.id,
      context.scenarioId,
    );
    const [hazardRows, currentAttempt] = await Promise.all([
      this.repository.findHazards(attempt.id, context.scenarioId),
      this.repository.findAttempt(attempt.id, context.scenarioId),
    ]);
    if (!currentAttempt) {
      throw new HttpError(
        404,
        'That interactive scenario is not available for your account.',
        'SCENARIO_NOT_FOUND',
      );
    }

    const hazards: ScenarioHazard[] = hazardRows.map((row) => {
      const metadata = parseHazardMetadata(row.metadata);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        hotspotYaw: Number(row.hotspotYaw),
        hotspotPitch: Number(row.hotspotPitch),
        sequenceOrder: row.sequenceOrder,
        decisionPrompt: metadata.decisionPrompt,
        decisionOptions: metadata.decisionOptions,
        selectedDecisionKey: row.selectedDecisionKey,
        answeredCorrectly: row.answeredCorrectly,
        feedback: row.answeredCorrectly ? row.feedback : null,
      };
    });
    const completedHazards = hazards.filter(
      (hazard) => hazard.answeredCorrectly,
    ).length;

    return {
      assignmentId: context.assignmentId,
      moduleId: context.moduleId,
      scenario: {
        id: context.scenarioId,
        title: context.title,
        description: context.description,
        resourceReference: context.resourceReference,
        sequenceOrder: context.sequenceOrder,
      },
      progress: {
        completedHazards,
        totalHazards: hazards.length,
        completed: currentAttempt.completedAt !== null,
        startedAt: currentAttempt.startedAt.toISOString(),
        completedAt: currentAttempt.completedAt?.toISOString() ?? null,
      },
      hazards,
    };
  }

  async answerHazard(
    user: AuthUser,
    assignmentId: number,
    hazardId: number,
    decisionKey: string,
  ): Promise<ScenarioAnswerResult> {
    const current = await this.getScenario(user, assignmentId);
    const hazard = current.hazards.find((item) => item.id === hazardId);
    if (!hazard) {
      throw new HttpError(
        404,
        'That scenario safety point is not available for this assignment.',
        'SCENARIO_HAZARD_NOT_FOUND',
      );
    }
    if (!hazard.decisionOptions.some((option) => option.key === decisionKey)) {
      throw new HttpError(
        400,
        'Choose one of the available scenario decisions.',
        'INVALID_SCENARIO_DECISION',
      );
    }

    const attempt = await this.repository.ensureAttempt(
      user.id,
      assignmentId,
      current.scenario.id,
    );
    if (!attempt) {
      throw new HttpError(
        404,
        'That interactive scenario is not available for your account.',
        'SCENARIO_NOT_FOUND',
      );
    }
    const answer = await this.repository.submitHazardDecision(
      attempt.id,
      current.scenario.id,
      hazardId,
      decisionKey,
    );
    if (!answer) {
      throw new HttpError(
        404,
        'That scenario safety point is not available for this assignment.',
        'SCENARIO_HAZARD_NOT_FOUND',
      );
    }
    if (answer.correct) {
      await this.repository.completeAttemptIfReady(
        attempt.id,
        current.scenario.id,
      );
    }

    return {
      hazardId,
      selectedDecisionKey: decisionKey,
      correct: answer.correct,
      feedback: answer.correct
        ? answer.feedback
        : 'Not quite. Review the situation and choose the safer handling decision.',
      scenario: await this.getScenario(user, assignmentId),
    };
  }
}
