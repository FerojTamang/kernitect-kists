export interface ScenarioDecisionOption {
  key: string;
  label: string;
}

export interface ScenarioHazard {
  id: number;
  title: string;
  description: string;
  hotspotYaw: number;
  hotspotPitch: number;
  sequenceOrder: number;
  decisionPrompt: string;
  decisionOptions: ScenarioDecisionOption[];
  selectedDecisionKey: string | null;
  answeredCorrectly: boolean;
  feedback: string | null;
}

export interface ScenarioProgressSnapshot {
  completedHazards: number;
  totalHazards: number;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface TrainingScenarioDetail {
  assignmentId: number;
  moduleId: number;
  scenario: {
    id: number;
    title: string;
    description: string;
    resourceReference: string;
    sequenceOrder: number;
  };
  progress: ScenarioProgressSnapshot;
  hazards: ScenarioHazard[];
}

export interface ScenarioAnswerResult {
  hazardId: number;
  selectedDecisionKey: string;
  correct: boolean;
  feedback: string;
  scenario: TrainingScenarioDetail;
}
