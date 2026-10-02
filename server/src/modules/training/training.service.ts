import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type {
  FormativeAnswerResult,
  FormativeQuestion,
  TrainingModuleDetail,
  TrainingScenarioStatus,
  TrainingModuleStatus,
} from './training.types.js';
import { TrainingRepository } from './training.repository.js';

export class TrainingService {
  constructor(private readonly repository: TrainingRepository) {}

  async getAssignmentDetail(
    user: AuthUser,
    assignmentId: number,
  ): Promise<TrainingModuleDetail> {
    const rows = await this.repository.findAssignmentDetail(
      user.id,
      assignmentId,
    );
    const firstRow = rows[0];
    if (!firstRow || !firstRow.moduleTitle) {
      throw new HttpError(
        404,
        'That learning module is not available for your account.',
        'MODULE_NOT_FOUND',
      );
    }

    await this.repository.touchProgress(user.id, assignmentId);
    const [questionRows, progression] = await Promise.all([
      this.repository.findFormativeQuestions(user.id, assignmentId),
      this.repository.findModuleProgression(user.id, assignmentId),
    ]);
    if (!progression) {
      throw new HttpError(
        404,
        'That learning module is not available for your account.',
        'MODULE_NOT_FOUND',
      );
    }
    const questionsByContent = new Map<number, FormativeQuestion[]>();
    for (const row of questionRows) {
      const questions = questionsByContent.get(row.contentId) ?? [];
      let question = questions.find((item) => item.id === row.questionId);
      if (!question) {
        question = {
          id: row.questionId,
          questionText: row.questionText,
          sequenceOrder: row.questionOrder,
          options: [],
          selectedOptionId: row.selectedOptionId,
          answeredCorrectly: row.answeredCorrectly,
        };
        questions.push(question);
      }
      if (row.optionId !== null) {
        question.options.push({
          id: row.optionId,
          optionText: row.optionText!,
          sequenceOrder: row.optionOrder!,
        });
      }
      questionsByContent.set(row.contentId, questions);
    }

    const assignmentPercentage = Math.max(
      0,
      Math.min(100, Number(firstRow.percentage) || 0),
    );
    const sections = rows
      .filter((row) => row.sectionId !== null)
      .map((row) => ({
        id: row.sectionId!,
        title: row.title!,
        contentType: row.contentType!,
        body: row.body,
        resourceReference: row.resourceReference,
        sequenceOrder: row.sequenceOrder!,
        isActive: row.isActive ?? true,
        completedAt: row.contentCompletedAt?.toISOString() ?? null,
        formativeQuestions: questionsByContent.get(row.sectionId!) ?? [],
      }));

    const completedSections = sections.filter((section) => section.completedAt);
    const resumeSectionIndex = Math.max(
      0,
      sections.findIndex((section) => !section.completedAt),
    );
    const learningProgressPercentage = sections.length
      ? Math.round((completedSections.length / sections.length) * 100)
      : 0;
    const scenarioStatus: TrainingScenarioStatus =
      progression.activeScenarioCount > 0 &&
      progression.completedScenarioCount === progression.activeScenarioCount
        ? 'completed'
        : progression.scenarioStarted
          ? 'in_progress'
          : 'not_started';
    const fullModuleComplete =
      sections.length > 0 &&
      completedSections.length === sections.length &&
      (!firstRow.hasScenario || scenarioStatus === 'completed') &&
      (!progression.hasAssessment || progression.assessmentPassed);
    const status: TrainingModuleStatus = fullModuleComplete
      ? 'completed'
      : firstRow.startedAt || assignmentPercentage > 0
        ? 'in_progress'
        : 'not_started';

    return {
      assignmentId: firstRow.assignmentId,
      moduleId: firstRow.moduleId,
      moduleTitle: firstRow.moduleTitle,
      moduleDescription: firstRow.moduleDescription,
      hasScenario: firstRow.hasScenario,
      scenarioStatus,
      assessmentPassed: progression.assessmentPassed,
      status,
      progress: {
        assignmentPercentage,
        learningProgressPercentage,
        completedSections: completedSections.length,
        totalSections: sections.length,
        startedAt: firstRow.startedAt?.toISOString() ?? null,
        completedAt: firstRow.assignmentCompletedAt?.toISOString() ?? null,
        lastAccessedAt: firstRow.lastAccessedAt?.toISOString() ?? null,
      },
      sections,
      resumeSectionIndex,
    };
  }

  async completeContent(
    user: AuthUser,
    assignmentId: number,
    contentId: number,
  ): Promise<TrainingModuleDetail> {
    const rows = await this.repository.findAssignmentDetail(
      user.id,
      assignmentId,
    );
    if (!rows[0] || !rows[0].moduleTitle)
      throw new HttpError(
        404,
        'That learning module is not available for your account.',
        'MODULE_NOT_FOUND',
      );
    const questions = (
      await this.getAssignmentDetail(user, assignmentId)
    ).sections.find((section) => section.id === contentId)?.formativeQuestions;
    if (!questions)
      throw new HttpError(
        404,
        'That learning section is not available for this assignment.',
        'CONTENT_NOT_FOUND',
      );
    if (
      questions.length === 0 ||
      questions.some((question) => !question.answeredCorrectly)
    )
      throw new HttpError(
        409,
        questions.length === 0
          ? 'This learning section does not have a configured practice check.'
          : `Answer all ${questions.length} practice questions correctly before completing this section.`,
        'FORMATIVE_CHECK_REQUIRED',
      );
    await this.repository.completeContent(user.id, assignmentId, contentId);
    await this.repository.refreshProgress(user.id, assignmentId);
    return this.getAssignmentDetail(user, assignmentId);
  }

  async answerFormativeQuestion(
    user: AuthUser,
    assignmentId: number,
    contentId: number,
    questionId: number,
    optionId: number,
  ): Promise<FormativeAnswerResult> {
    const module = await this.getAssignmentDetail(user, assignmentId);
    const section = module.sections.find((item) => item.id === contentId);
    const question = section?.formativeQuestions.find(
      (item) => item.id === questionId,
    );
    if (
      !section ||
      !question ||
      !question.options.some((option) => option.id === optionId)
    )
      throw new HttpError(
        404,
        'That formative question is not available for this section.',
        'FORMATIVE_QUESTION_NOT_FOUND',
      );

    const answer = await this.repository.submitFormativeAnswer(
      user.id,
      assignmentId,
      contentId,
      questionId,
      optionId,
    );
    if (!answer)
      throw new HttpError(
        404,
        'That formative question is not available for this assignment.',
        'FORMATIVE_QUESTION_NOT_FOUND',
      );

    if (answer.correct)
      await this.repository.completeContent(user.id, assignmentId, contentId);
    if (answer.correct)
      await this.repository.refreshProgress(user.id, assignmentId);
    const updatedModule = await this.getAssignmentDetail(user, assignmentId);
    const updatedSection = updatedModule.sections.find(
      (item) => item.id === contentId,
    )!;
    return {
      questionId,
      selectedOptionId: optionId,
      correct: answer.correct,
      feedback: answer.correct
        ? 'Correct. This is the safer workplace approach.'
        : 'Not quite. Review the section and try again.',
      sectionComplete: Boolean(updatedSection.completedAt),
      module: updatedModule,
    };
  }
}
