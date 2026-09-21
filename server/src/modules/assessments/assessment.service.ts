import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AssessmentRepository } from './assessment.repository.js';
import type {
  AssessmentQuestion,
  AssessmentSubmissionAnswer,
  AssessmentSubmissionResult,
  TrainingAssessmentDetail,
} from './assessment.types.js';

export class AssessmentService {
  constructor(private readonly repository: AssessmentRepository) {}

  async getAssessment(
    user: AuthUser,
    assignmentId: number,
  ): Promise<TrainingAssessmentDetail> {
    const context = await this.repository.findAssessmentContext(
      user.id,
      assignmentId,
    );

    if (!context) {
      throw new HttpError(
        404,
        'That final assessment is not available for your account.',
        'ASSESSMENT_NOT_FOUND',
      );
    }

    if (
      context.activeSectionCount === 0 ||
      context.completedSectionCount < context.activeSectionCount
    ) {
      throw new HttpError(
        409,
        'Complete the Manual Handling learning sections before starting the final assessment.',
        'ASSESSMENT_LEARNING_LOCKED',
      );
    }

    if (context.completedScenarioCount < context.activeScenarioCount) {
      throw new HttpError(
        409,
        'Complete the interactive warehouse scenario before starting the final assessment.',
        'ASSESSMENT_SCENARIO_LOCKED',
      );
    }

    const [rows, latestAttempt] = await Promise.all([
      this.repository.findQuestions(context.assessmentId),
      this.repository.findLatestAttempt(assignmentId, context.assessmentId),
    ]);

    const questionsById = new Map<number, AssessmentQuestion>();
    for (const row of rows) {
      let question = questionsById.get(row.questionId);
      if (!question) {
        question = {
          id: row.questionId,
          questionText: row.questionText,
          questionType: row.questionType,
          sequenceOrder: row.questionOrder,
          options: [],
        };
        questionsById.set(row.questionId, question);
      }

      if (
        row.optionId !== null &&
        row.optionText !== null &&
        row.optionOrder !== null
      ) {
        question.options.push({
          id: row.optionId,
          optionText: row.optionText,
          sequenceOrder: row.optionOrder,
        });
      }
    }

    const questions = [...questionsById.values()];
    if (
      questions.length === 0 ||
      questions.some(
        (question) =>
          question.questionType === 'free_text' || question.options.length < 2,
      )
    ) {
      throw new Error('The active assessment question set is incomplete.');
    }

    return {
      assignmentId: context.assignmentId,
      moduleId: context.moduleId,
      moduleTitle: context.moduleTitle,
      hasScenario: context.activeScenarioCount > 0,
      assessment: {
        id: context.assessmentId,
        title: context.title,
        description: context.description,
        passPercentage: Number(context.passPercentage),
        sequenceOrder: context.sequenceOrder,
      },
      questions,
      latestAttempt,
    };
  }

  async submitAssessment(
    user: AuthUser,
    assignmentId: number,
    answers: AssessmentSubmissionAnswer[],
  ): Promise<AssessmentSubmissionResult> {
    const assessment = await this.getAssessment(user, assignmentId);

    if (assessment.latestAttempt?.passed) {
      throw new HttpError(
        409,
        'You have already passed this final assessment.',
        'ASSESSMENT_ALREADY_PASSED',
      );
    }

    if (answers.length !== assessment.questions.length) {
      throw new HttpError(
        400,
        'Answer every assessment question before submitting.',
        'ASSESSMENT_INCOMPLETE',
      );
    }

    const answersByQuestion = new Map<number, number>();
    for (const answer of answers) {
      if (
        !Number.isInteger(answer.questionId) ||
        answer.questionId <= 0 ||
        !Number.isInteger(answer.optionId) ||
        answer.optionId <= 0
      ) {
        throw new HttpError(
          400,
          'Each assessment answer must contain a valid question and option.',
          'INVALID_ASSESSMENT_ANSWER',
        );
      }

      if (answersByQuestion.has(answer.questionId)) {
        throw new HttpError(
          400,
          'Submit one answer for each assessment question.',
          'DUPLICATE_ASSESSMENT_ANSWER',
        );
      }

      answersByQuestion.set(answer.questionId, answer.optionId);
    }

    for (const question of assessment.questions) {
      const optionId = answersByQuestion.get(question.id);
      if (
        optionId === undefined ||
        !question.options.some((option) => option.id === optionId)
      ) {
        throw new HttpError(
          400,
          'Choose one of the available answers for every assessment question.',
          'INVALID_ASSESSMENT_ANSWER',
        );
      }
    }

    const result = await this.repository.submitAssessment(
      user.id,
      assignmentId,
      assessment.assessment.id,
      answers,
    );

    if (!result) {
      throw new HttpError(
        409,
        'The assessment could not be submitted. Refresh the page and try again.',
        'ASSESSMENT_SUBMISSION_CONFLICT',
      );
    }

    return result;
  }
}
