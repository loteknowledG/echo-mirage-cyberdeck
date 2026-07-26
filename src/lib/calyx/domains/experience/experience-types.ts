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
    disputedCount: number;
    rejectedCount: number;
    archivedCount: number;
    openConflictCount: number;
  };
};

export type ExperienceIngestReplayOutcome = "created" | "existing" | "conflict";

export type ExperienceIngestConflictStatus = "OPEN";

export type ExperienceIngestConflictReason = "CANDIDATE_CONTENT_DIVERGENCE";

export type ExperienceIngestConflict = {
  id: string;
  ownerId: string;
  candidateId: string;
  traceId: string;
  reason: ExperienceIngestConflictReason;
  existingEnvelopeDigest: string;
  incomingEnvelopeDigest: string;
  status: ExperienceIngestConflictStatus;
  createdAt: string;
};

export type ExperienceIngestConflictCollectionFile = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  records: ExperienceIngestConflict[];
};

export type ExperienceIngestResult = {
  outcome: ExperienceIngestReplayOutcome;
  candidate: ExperienceCandidate;
  conflict?: ExperienceIngestConflict;
};

export type ExperienceReviewAction = "reject" | "dispute" | "archive";

export type ExperienceReviewOutcome = "applied" | "existing";

export type ExperienceReviewAuditEntry = {
  id: string;
  ownerId: string;
  candidateId: string;
  action: ExperienceReviewAction;
  previousStatus: ExperienceCandidateStatus;
  nextStatus: ExperienceCandidateStatus;
  actor: string;
  reason: string;
  reviewCommandId?: string;
  createdAt: string;
};

export type ExperienceReviewAuditCollectionFile = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  records: ExperienceReviewAuditEntry[];
};

export type ExperienceReviewResult = {
  outcome: ExperienceReviewOutcome;
  candidate: ExperienceCandidate;
  auditEntry: ExperienceReviewAuditEntry;
};
