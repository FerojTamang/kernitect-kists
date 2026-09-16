import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { TrainingService } from './training.service.js';

export class TrainingController {
  constructor(private readonly service: TrainingService) {}

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
    res.json(await this.service.getAssignmentDetail(user, assignmentId));
  };

  completeContent: RequestHandler = async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    const contentId = Number(req.params.contentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(
        400,
        'A valid assignment id is required.',
        'INVALID_ASSIGNMENT_ID',
      );
    }
    if (!Number.isInteger(contentId) || contentId <= 0) {
      throw new HttpError(
        400,
        'A valid content id is required.',
        'INVALID_CONTENT_ID',
      );
    }
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }
    res.json(await this.service.completeContent(user, assignmentId, contentId));
  };

  answerFormativeQuestion: RequestHandler = async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    const contentId = Number(req.params.contentId);
    const questionId = Number(req.params.questionId);
    const optionId = Number(req.body?.optionId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0)
      throw new HttpError(
        400,
        'A valid assignment id is required.',
        'INVALID_ASSIGNMENT_ID',
      );
    if (!Number.isInteger(contentId) || contentId <= 0)
      throw new HttpError(
        400,
        'A valid content id is required.',
        'INVALID_CONTENT_ID',
      );
    if (!Number.isInteger(questionId) || questionId <= 0)
      throw new HttpError(
        400,
        'A valid question id is required.',
        'INVALID_QUESTION_ID',
      );
    if (!Number.isInteger(optionId) || optionId <= 0)
      throw new HttpError(
        400,
        'A valid answer option id is required.',
        'INVALID_OPTION_ID',
      );
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user)
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    res.json(
      await this.service.answerFormativeQuestion(
        user,
        assignmentId,
        contentId,
        questionId,
        optionId,
      ),
    );
  };
}
