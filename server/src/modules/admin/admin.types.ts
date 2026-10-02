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
  currentStage: string;
}

export interface AdminDashboardModule {
  id: number;
  title: string;
  slug: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
}

export interface AdminDashboardAttention {
  traineesInProgress: number;
  assessmentsAwaitingCompletion: number;
}

export interface AdminDashboardData {
  administrator: { firstName: string; lastName: string; email: string };
  summary: AdminDashboardSummary;
  trainees: AdminDashboardTrainee[];
  modules: AdminDashboardModule[];
  attention: AdminDashboardAttention;
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
  avatarUrl: string | null;
  requiredTrainingModuleIds: number[];
}

export interface AdminUsersData {
  summary: {
    total: number;
    active: number;
    inactive: number;
    unassignedJobRole: number;
  };
  jobRoles: AdminJobRole[];
  trainingModules: AdminAssignmentModule[];
  users: AdminUser[];
}

export interface CreateTraineeInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  jobRoleId: number | null;
  isActive: boolean;
  requiredTrainingModuleIds?: number[];
}

export interface UpdateTraineeInput {
  firstName: string;
  lastName: string;
  email: string;
  jobRoleId: number | null;
  isActive: boolean;
  requiredTrainingModuleIds: number[];
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
  progressStage: string;
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
  progressStage: string;
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

export interface AdminTrainingModuleSummary {
  id: number;
  title: string;
  slug: string;
  description: string;
  isActive: boolean;
  learningSectionCount: number;
  scenarioCount: number;
  hazardCount: number;
  assessmentCount: number;
  questionCount: number;
  passPercentage: number | null;
  activeAssignmentCount: number;
}

export interface AdminTrainingLibraryData {
  summary: {
    totalModules: number;
    activeModules: number;
    draftModules: number;
    assessmentQuestions: number;
  };
  modules: AdminTrainingModuleSummary[];
}

export interface AdminTrainingQuestion {
  id: number;
  questionText: string;
  sequenceOrder: number;
  options: Array<{
    id: number;
    optionText: string;
    isCorrect: boolean;
    sequenceOrder: number;
  }>;
}

export interface AdminTrainingModuleDetail extends AdminTrainingModuleSummary {
  learningSections: Array<{
    id: number;
    title: string;
    contentType: string;
    sequenceOrder: number;
    isActive: boolean;
  }>;
  scenarios: Array<{
    id: number;
    title: string;
    description: string;
    isActive: boolean;
    sequenceOrder: number;
    hazardCount: number;
  }>;
  assessments: Array<{
    id: number;
    title: string;
    description: string;
    passPercentage: number;
    isActive: boolean;
    hasAttempts: boolean;
    questions: AdminTrainingQuestion[];
  }>;
}

export interface SaveTrainingModuleInput {
  title: string;
  description: string;
  isActive?: boolean;
}

export interface SaveAssessmentQuestionInput {
  questionText: string;
  options: Array<{ optionText: string; isCorrect: boolean }>;
}
