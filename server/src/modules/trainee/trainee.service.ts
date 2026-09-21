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
      const learningCompletedSections =
        Number(row.learningCompletedSections) || 0;
      const learningTotalSections = Number(row.learningTotalSections) || 0;
      const learningProgressPercentage = learningTotalSections
        ? Math.round((learningCompletedSections / learningTotalSections) * 100)
        : 0;
      const scenarioCompleted = Number(row.scenarioCompleted) || 0;
      const scenarioTotal = Number(row.scenarioTotal) || 0;
      const assessmentPassed = Number(row.assessmentPassed) || 0;
      const assessmentTotal = Number(row.assessmentTotal) || 0;
      const learningComplete =
        learningTotalSections > 0 &&
        learningCompletedSections >= learningTotalSections;
      const scenarioComplete =
        scenarioTotal === 0 || scenarioCompleted >= scenarioTotal;
      const assessmentComplete =
        assessmentTotal === 0 || assessmentPassed >= assessmentTotal;
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
      const resumeStage: TraineeDashboardAssignment['resumeStage'] =
        !learningComplete
          ? 'learning'
          : !scenarioComplete
            ? 'scenario'
            : !assessmentComplete
              ? 'assessment'
              : 'learning';
      const resumePath = `/trainee/training/${row.assignmentId}${
        resumeStage === 'learning' ? '' : `/${resumeStage}`
      }`;
      return {
        assignmentId: row.assignmentId,
        moduleId: row.moduleId,
        title: row.title,
        description: row.description,
        required: row.required,
        status,
        progressPercentage,
        learningProgressPercentage,
        learningCompletedSections,
        learningTotalSections,
        scenarioCompleted,
        scenarioTotal,
        assessmentPassed,
        assessmentTotal,
        resumeStage,
        resumePath,
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
