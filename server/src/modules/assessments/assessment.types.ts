export type AssessmentQuestionType =
  'single_choice' | 'true_false' | 'free_text';

export interface AssessmentAnswerOption {
  id: number;
  optionText: string;
  sequenceOrder: number;
}

export interface AssessmentQuestion {
  id: number;
  questionText: string;
  questionType: AssessmentQuestionType;
  sequenceOrder: number;
  options: AssessmentAnswerOption[];
}

export interface AssessmentAttemptSummary {
  id: number;
  attemptNumber: number;
  scorePercentage: number;
  passPercentage: number;
  passed: boolean;
  submittedAt: string;
}

export interface TrainingAssessmentDetail {
  assignmentId: number;
  moduleId: number;
  assessment: {
    id: number;
    title: string;
    description: string;
    passPercentage: number;
    sequenceOrder: number;
  };
  questions: AssessmentQuestion[];
  latestAttempt: AssessmentAttemptSummary | null;
}

export interface AssessmentSubmissionAnswer {
  questionId: number;
  optionId: number;
}

export interface AssessmentSubmissionResult {
  assignmentId: number;
  assessmentId: number;
  correctAnswers: number;
  totalQuestions: number;
  attempt: AssessmentAttemptSummary;
}
