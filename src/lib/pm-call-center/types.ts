export type PmCallScenarioCategory =
  | "maintenance"
  | "leasing"
  | "emergency"
  | "billing"
  | "general";

export type PmCallScenario = {
  id: string;
  title: string;
  category: PmCallScenarioCategory;
  description: string;
  residentName: string;
  propertyHint: string;
  openingLine: string;
  /** Brief for the simulated resident LLM. */
  residentBrief: string;
};

export type PmCallTurnRole = "resident" | "operator" | "system";

export type PmCallTurn = {
  id: string;
  role: PmCallTurnRole;
  text: string;
  /** Operator-only private thinking notes for this response. */
  notes?: string;
  at: number;
};

export type PmCallUrgency = "low" | "medium" | "high" | "emergency";

export type PmCallEpisodeDigest = {
  scenarioId: string;
  scenarioTitle: string;
  category: PmCallScenarioCategory;
  residentIntent: string;
  operatorActions: string[];
  routing: {
    department: string;
    urgency: PmCallUrgency;
  };
  goodPhrases: string[];
  escalated: boolean;
  outcome: string;
  lesson: string;
};

export type PmCallEpisode = {
  id: string;
  startedAt: number;
  endedAt: number;
  scenarioId: string;
  turns: PmCallTurn[];
  digest: PmCallEpisodeDigest | null;
};

export type PmCallSimAction = "resident_turn" | "observer_close";

export type PmCallSimPhase = "pick" | "live" | "hung_up" | "observing" | "review";

/** In-progress call simulation — survives page refresh. */
export type PmCallSimSession = {
  schemaVersion: 1;
  phase: PmCallSimPhase;
  scenarioId: string;
  turns: PmCallTurn[];
  composer: string;
  operatorNotesDraft: string;
  digest: PmCallEpisodeDigest | null;
  status: string;
  updatedAt: number;
};
