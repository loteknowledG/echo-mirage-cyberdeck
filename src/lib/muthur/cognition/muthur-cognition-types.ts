export const MUTHUR_COGNITION_CATEGORIES = [
  "observe",
  "retrieve",
  "synthesize",
  "recommend",
  "reflect",
  "pattern",
  "warning",
  "mission",
  "memory",
] as const;

export type MuthurCognitionCategory = (typeof MUTHUR_COGNITION_CATEGORIES)[number];

export interface MuthurCognitionEvent {
  id: string;
  category: MuthurCognitionCategory;
  message: string;
  createdAt: string;
  missionId?: string;
  source?: string;
}

export type MuthurCognitionState = {
  events: MuthurCognitionEvent[];
};

export type MuthurCognitionEmitInput = {
  category: MuthurCognitionCategory;
  message: string;
  missionId?: string;
  source?: string;
};
