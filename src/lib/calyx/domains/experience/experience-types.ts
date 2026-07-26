export const SYNAPSE_TRACE_ENVELOPE_CONTRACT = "synapse-trace-envelope/v1" as const;

export type ExperienceStorageMode = "local" | "calyx";

export type ExperienceCandidateStatus =
  | "DRAFT"
  | "VERIFIED"
  | "DISPUTED"
  | "ARCHIVED"
  | "REJECTED";

export type ExperienceOutcome = "success" | "failure" | "partial" | "unknown";

export type ExperienceTraceRef = {
  traceId: string;
  sessionId?: string;
  runId?: string;
  source: "synapse";
  signature: string;
  ingestedAt: string;
  contractVersion: typeof SYNAPSE_TRACE_ENVELOPE_CONTRACT;
};

export type ExperienceCandidate = {
  id: string;
  ownerId: string;
  traceRef: ExperienceTraceRef;
  dedupeKey: string;
  summary: string;
  outcome?: ExperienceOutcome;
  tags?: string[];
  status: ExperienceCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExperienceCandidateCollectionFile = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  records: ExperienceCandidate[];
};

export type ExperienceCandidateSnapshot = {
  candidates: ExperienceCandidate[];
  summary: {
    candidateCount: number;
    draftCount: number;
  };
};
