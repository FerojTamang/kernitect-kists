import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type {
  TrainingModuleDetail,
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

    const assignmentPercentage = Math.max(
      0,
      Math.min(100, Number(firstRow.percentage) || 0),
    );
    const status: TrainingModuleStatus =
      firstRow.assignmentCompletedAt || assignmentPercentage >= 100
        ? 'completed'
        : firstRow.startedAt || assignmentPercentage > 0
          ? 'in_progress'
          : 'not_started';

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
      }));

    const completedSections = sections.filter((section) => section.completedAt);
    const resumeSectionIndex = Math.max(
      0,
      sections.findIndex((section) => !section.completedAt),
    );
    const learningProgressPercentage = sections.length
      ? Math.round((completedSections.length / sections.length) * 100)
      : 0;

    return {
      assignmentId: firstRow.assignmentId,
      moduleId: firstRow.moduleId,
      moduleTitle: firstRow.moduleTitle,
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
    const contentBelongsToAssignment = rows.some(
      (row) => row.sectionId === contentId,
    );
    if (!contentBelongsToAssignment)
      throw new HttpError(
        404,
        'That learning section is not available for this assignment.',
        'CONTENT_NOT_FOUND',
      );
    await this.repository.completeContent(user.id, assignmentId, contentId);
    return this.getAssignmentDetail(user, assignmentId);
  }
}
