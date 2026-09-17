export interface AdminDashboardSummary {
  totalTrainees: number;
  activeTrainees: number;
  activeAssignments: number;
  completedAssignments: number;
  certificatesIssued: number;
  completionRate: number;
}

export interface AdminDashboardTrainee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
  assignedCount: number;
  completedCount: number;
  progressPercentage: number;
  latestAssessmentScore: number | null;
  latestAssessmentPassed: boolean | null;
  certificateIssued: boolean;
}

export interface AdminDashboardModule {
  id: number;
  title: string;
  slug: string;
  assignedCount: number;
  completedCount: number;
  averageProgress: number;
}

export interface AdminDashboardData {
  administrator: { firstName: string; lastName: string; email: string };
  summary: AdminDashboardSummary;
  trainees: AdminDashboardTrainee[];
  modules: AdminDashboardModule[];
}

export interface AdminJobRole {
  id: number;
  name: string;
  description: string;
}

export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRoleId: number | null;
  jobRole: string | null;
  isActive: boolean;
  assignedCount: number;
  completedCount: number;
  progressPercentage: number;
}

export interface AdminUsersData {
  summary: {
    total: number;
    active: number;
    inactive: number;
    unassignedJobRole: number;
  };
  jobRoles: AdminJobRole[];
  users: AdminUser[];
}

export interface CreateTraineeInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  jobRoleId: number | null;
  isActive: boolean;
}

export interface UpdateTraineeInput {
  firstName: string;
  lastName: string;
  email: string;
  jobRoleId: number | null;
  isActive: boolean;
}

export type AdminAssignmentStatus = 'active' | 'cancelled';

export interface AdminAssignment {
  id: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  traineeJobRole: string | null;
  traineeIsActive: boolean;
  trainingModuleId: number;
  trainingModuleTitle: string;
  trainingModuleSlug: string;
  required: boolean;
  status: AdminAssignmentStatus;
  assignedAt: string;
  dueAt: string | null;
  assignedByFirstName: string;
  assignedByLastName: string;
  progressPercentage: number;
  completedAt: string | null;
}

export interface AdminAssignmentTrainee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string | null;
  isActive: boolean;
}

export interface AdminAssignmentModule {
  id: number;
  title: string;
  slug: string;
  description: string;
}

export interface AdminAssignmentsData {
  summary: {
    total: number;
    active: number;
    required: number;
    optional: number;
    completed: number;
  };
  trainees: AdminAssignmentTrainee[];
  modules: AdminAssignmentModule[];
  assignments: AdminAssignment[];
}

export interface CreateAssignmentInput {
  traineeId: number;
  trainingModuleId: number;
  required: boolean;
}

export interface AdminProgressRecord {
  assignmentId: number;
  traineeId: number;
  traineeFirstName: string;
  traineeLastName: string;
  traineeEmail: string;
  traineeJobRole: string | null;
  traineeIsActive: boolean;
  trainingModuleId: number;
  trainingModuleTitle: string;
  trainingModuleSlug: string;
  required: boolean;
  assignmentStatus: AdminAssignmentStatus;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  learningCompleted: number;
  learningTotal: number;
  scenarioCompleted: number;
  scenarioTotal: number;
  assessmentTotal: number;
  assessmentPassed: number;
  assessmentAttempts: number;
  latestAssessmentAttemptNumber: number | null;
  latestAssessmentScore: number | null;
  latestAssessmentPassed: boolean | null;
  latestAssessmentSubmittedAt: string | null;
  certificateIssued: boolean;
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
}

export interface AdminProgressData {
  summary: {
    activeAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    notStartedAssignments: number;
    assessmentPassedAssignments: number;
    certificatesIssued: number;
  };
  modules: Array<{
    id: number;
    title: string;
    slug: string;
  }>;
  records: AdminProgressRecord[];
}
