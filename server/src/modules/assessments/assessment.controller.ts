import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { AssessmentService } from './assessment.service.js';
import type { AssessmentSubmissionAnswer } from './assessment.types.js';

export class AssessmentController {
  constructor(private readonly service: AssessmentService) {}

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

    res.json(await this.service.getAssessment(user, assignmentId));
  };

  submit: RequestHandler = async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(
        400,
        'A valid assignment id is required.',
        'INVALID_ASSIGNMENT_ID',
      );
    }

    if (!Array.isArray(req.body?.answers)) {
      throw new HttpError(
        400,
        'Assessment answers are required.',
        'ASSESSMENT_ANSWERS_REQUIRED',
      );
    }

    const answers: AssessmentSubmissionAnswer[] = req.body.answers.map(
      (answer: unknown) => {
        if (
          typeof answer !== 'object' ||
          answer === null ||
          !('questionId' in answer) ||
          !('optionId' in answer)
        ) {
          throw new HttpError(
            400,
            'Each assessment answer must contain a question id and option id.',
            'INVALID_ASSESSMENT_ANSWER',
          );
        }

        return {
          questionId: Number(answer.questionId),
          optionId: Number(answer.optionId),
        };
      },
    );

    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }

    res
      .status(201)
      .json(await this.service.submitAssessment(user, assignmentId, answers));
  };
}
