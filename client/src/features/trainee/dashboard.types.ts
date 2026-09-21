import type { AuthUser } from '../auth/auth.types';

export type AssignmentStatus = 'completed' | 'in_progress' | 'not_started';
export type NextAction = 'start' | 'continue' | 'review';

export interface DashboardAssignment {
  assignmentId: number;
  moduleId: number;
  title: string;
  description: string;
  required: boolean;
  status: AssignmentStatus;
  progressPercentage: number;
  learningProgressPercentage: number;
  learningCompletedSections: number;
  learningTotalSections: number;
  scenarioCompleted: number;
  scenarioTotal: number;
  assessmentPassed: number;
  assessmentTotal: number;
  resumeStage: 'learning' | 'scenario' | 'assessment';
  resumePath: string;
  assignedAt: string;
  dueAt: string | null;
  nextAction: NextAction;
}

export interface TraineeDashboardData {
  trainee: AuthUser;
  summary: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overallProgressPercentage: number;
  };
  assignedTraining: DashboardAssignment[];
}
