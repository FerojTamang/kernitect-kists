import type { AuthUser } from '../auth/auth.types.js';

export type AssignmentPresentationStatus =
  'completed' | 'in_progress' | 'not_started';

export interface TraineeDashboardAssignment {
  assignmentId: number;
  moduleId: number;
  title: string;
  description: string;
  required: boolean;
  status: AssignmentPresentationStatus;
  progressPercentage: number;
  learningProgressPercentage: number;
  learningCompletedSections: number;
  learningTotalSections: number;
  assignedAt: string;
  dueAt: string | null;
  nextAction: 'start' | 'continue' | 'review';
}

export interface TraineeDashboard {
  trainee: AuthUser;
  summary: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overallProgressPercentage: number;
  };
  assignedTraining: TraineeDashboardAssignment[];
}
