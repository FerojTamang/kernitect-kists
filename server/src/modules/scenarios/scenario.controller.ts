import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { ScenarioService } from './scenario.service.js';

export class ScenarioController {
  constructor(private readonly service: ScenarioService) {}

  detail: RequestHandler = async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(
        400,
        'A valid assignment id is required.',
        'INVALID_ASSIGNMENT_ID',
      );
    }
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }
    res.json(await this.service.getScenario(user, assignmentId));
  };

  answerHazard: RequestHandler = async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    const hazardId = Number(req.params.hazardId);
    const decisionKey =
      typeof req.body?.decisionKey === 'string'
        ? req.body.decisionKey.trim()
        : '';
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(
        400,
        'A valid assignment id is required.',
        'INVALID_ASSIGNMENT_ID',
      );
    }
    if (!Number.isInteger(hazardId) || hazardId <= 0) {
      throw new HttpError(
        400,
        'A valid hazard id is required.',
        'INVALID_HAZARD_ID',
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(decisionKey)) {
      throw new HttpError(
        400,
        'A valid scenario decision is required.',
        'INVALID_SCENARIO_DECISION',
      );
    }
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }
    res.json(
      await this.service.answerHazard(
        user,
        assignmentId,
        hazardId,
        decisionKey,
      ),
    );
  };
}
