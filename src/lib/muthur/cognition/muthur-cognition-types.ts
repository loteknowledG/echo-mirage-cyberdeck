export const MUTHUR_COGNITION_MODES = ["off", "summary", "live"] as const;

export type MuthurCognitionMode = (typeof MUTHUR_COGNITION_MODES)[number];

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

export type MuthurCognitionStreamEntry = {
  id: string;
  kind: "live" | "summary";
  text: string;
  createdAt: string;
};

export type MuthurCognitionState = {
  mode: MuthurCognitionMode;
  events: MuthurCognitionEvent[];
  stream: MuthurCognitionStreamEntry[];
  pendingSummary: MuthurCognitionEvent[];
};

export type MuthurCognitionEmitInput = {
  category: MuthurCognitionCategory;
  message: string;
  missionId?: string;
  source?: string;
};
