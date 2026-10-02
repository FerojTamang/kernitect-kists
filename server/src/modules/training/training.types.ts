export type TrainingContentType =
  'text' | 'image' | 'video' | 'document' | 'link';

export type TrainingModuleStatus = 'completed' | 'in_progress' | 'not_started';
export type TrainingScenarioStatus =
  'not_started' | 'in_progress' | 'completed';

export interface TrainingSection {
  id: number;
  title: string;
  contentType: TrainingContentType;
  body: string | null;
  resourceReference: string | null;
  sequenceOrder: number;
  isActive: boolean;
  completedAt: string | null;
  formativeQuestions: FormativeQuestion[];
}

export interface FormativeQuestion {
  id: number;
  questionText: string;
  sequenceOrder: number;
  options: FormativeOption[];
  selectedOptionId: number | null;
  answeredCorrectly: boolean;
}

export interface FormativeOption {
  id: number;
  optionText: string;
  sequenceOrder: number;
}

export interface TrainingProgressSnapshot {
  assignmentPercentage: number;
  learningProgressPercentage: number;
  completedSections: number;
  totalSections: number;
  startedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
}

export interface TrainingModuleDetail {
  assignmentId: number;
  moduleId: number;
  moduleTitle: string;
  moduleDescription: string;
  hasScenario: boolean;
  scenarioStatus: TrainingScenarioStatus;
  assessmentPassed: boolean;
  status: TrainingModuleStatus;
  progress: TrainingProgressSnapshot;
  sections: TrainingSection[];
  resumeSectionIndex: number;
}

export interface FormativeAnswerResult {
  questionId: number;
  selectedOptionId: number;
  correct: boolean;
  feedback: string;
  sectionComplete: boolean;
  module: TrainingModuleDetail;
}
