import type { AuthUser } from '../auth/auth.types.js';
import { TraineeRepository } from './trainee.repository.js';
import type {
  AssignmentPresentationStatus,
  TraineeDashboard,
  TraineeDashboardAssignment,
} from './trainee.types.js';

export class TraineeService {
  constructor(private readonly repository: TraineeRepository) {}

  async getDashboard(user: AuthUser): Promise<TraineeDashboard> {
    const rows = await this.repository.findDashboard(user.id);
    const assignedTraining = rows.map((row) => {
      const progressPercentage = Math.max(
        0,
        Math.min(100, Number(row.percentage) || 0),
      );
      const status: AssignmentPresentationStatus =
        row.completedAt || progressPercentage >= 100
          ? 'completed'
          : row.startedAt || progressPercentage > 0
            ? 'in_progress'
            : 'not_started';
      const nextAction: TraineeDashboardAssignment['nextAction'] =
        status === 'completed'
          ? 'review'
          : status === 'in_progress'
            ? 'continue'
            : 'start';
      return {
        assignmentId: row.assignmentId,
        moduleId: row.moduleId,
        title: row.title,
        description: row.description,
        required: row.required,
        status,
        progressPercentage,
        assignedAt: row.assignedAt.toISOString(),
        dueAt: row.dueAt?.toISOString() ?? null,
        nextAction,
      };
    });
    const totalProgress = assignedTraining.reduce(
      (sum, assignment) => sum + assignment.progressPercentage,
      0,
    );
    return {
      trainee: user,
      summary: {
        totalAssigned: assignedTraining.length,
        completed: assignedTraining.filter(
          (item) => item.status === 'completed',
        ).length,
        inProgress: assignedTraining.filter(
          (item) => item.status === 'in_progress',
        ).length,
        notStarted: assignedTraining.filter(
          (item) => item.status === 'not_started',
        ).length,
        // Overall progress is the arithmetic mean of active assigned-module progress.
        overallProgressPercentage: assignedTraining.length
          ? Math.round(totalProgress / assignedTraining.length)
          : 0,
      },
      assignedTraining,
    };
  }
}
