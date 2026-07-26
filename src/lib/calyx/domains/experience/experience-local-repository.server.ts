import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { digestTraceEnvelope } from "./experience-content";
import {
  computeActionHash,
  computeExperienceCandidateId,
  deriveCandidateSummary,
} from "./experience-identity";
import {
  assertSafeOwnerId,
  resolveOwnerExperienceDir,
  resolveOwnerTraceArtifactPath,
} from "./experience-paths.server";
import {
  assertPromotionEligible,
} from "./experience-promotion";
import {
  assertReviewTransitionAllowed,
  resolveReviewTargetStatus,
} from "./experience-review";
import {
  ExperienceNotFoundError,
  ExperienceTraceArtifactMutationError,
  type ExperienceRepository,
} from "./experience-repository";
import type { SynapseTraceEnvelopeV1 } from "./experience-trace.server";
import {
  SYNAPSE_TRACE_ENVELOPE_CONTRACT,
  type ExperienceCandidate,
  type ExperienceCandidateCollectionFile,
  type ExperienceCandidateSnapshot,
  type ExperienceIngestConflict,
  type ExperienceIngestConflictCollectionFile,
  type ExperienceIngestResult,
  type ExperienceLesson,
  type ExperienceLessonCollectionFile,
  type ExperiencePromotionAuditCollectionFile,
  type ExperiencePromotionAuditEntry,
  type ExperiencePromotionResult,
  type ExperienceReviewAction,
  type ExperienceReviewAuditCollectionFile,
  type ExperienceReviewAuditEntry,
  type ExperienceReviewResult,
} from "./experience-types";

const CANDIDATES_FILE = "candidates.json";
const CONFLICTS_FILE = "conflicts.json";
const REVIEW_AUDIT_FILE = "review-audit.json";
const PROMOTION_AUDIT_FILE = "promotion-audit.json";
const LESSONS_FILE = "lessons.json";
const CONFLICT_INCOMING_DIR = "conflict-incoming";

const ownerLocks = new Map<string, Promise<void>>();

async function withOwnerLock<T>(ownerId: string, fn: () => Promise<T>): Promise<T> {
  const safeOwnerId = assertSafeOwnerId(ownerId);
  const previous = ownerLocks.get(safeOwnerId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  ownerLocks.set(
    safeOwnerId,
    previous.then(() => gate),
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyCandidatesFile(ownerId: string): ExperienceCandidateCollectionFile {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

function emptyReviewAuditFile(ownerId: string): ExperienceReviewAuditCollectionFile {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

function emptyConflictsFile(ownerId: string): ExperienceIngestConflictCollectionFile {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

function emptyLessonsFile(ownerId: string): ExperienceLessonCollectionFile {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

function emptyPromotionAuditFile(ownerId: string): ExperiencePromotionAuditCollectionFile {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

export class LocalExperienceRepository implements ExperienceRepository {
  constructor(private readonly experienceRootOverride?: string) {}

  private resolveOwnerDir(ownerId: string): string {
    if (this.experienceRootOverride) {
      const safeOwnerId = assertSafeOwnerId(ownerId);
      const root = path.resolve(this.experienceRootOverride);
      const ownerDir = path.resolve(root, safeOwnerId);
      if (ownerDir !== root && !ownerDir.startsWith(`${root}${path.sep}`)) {
        throw new Error("Invalid owner directory");
      }
      return ownerDir;
    }
    return resolveOwnerExperienceDir(ownerId);
  }

  private resolveTraceArtifactPath(ownerId: string, traceId: string): string {
    if (this.experienceRootOverride) {
      const safeOwnerId = assertSafeOwnerId(ownerId);
      const validatedTraceId = traceId.trim();
      const tracesDir = path.resolve(this.experienceRootOverride, safeOwnerId, "traces");
      const artifactPath = path.resolve(tracesDir, `${validatedTraceId}.json`);
      if (!artifactPath.startsWith(`${tracesDir}${path.sep}`)) {
        throw new Error("Invalid trace artifact path");
      }
      return artifactPath;
    }
    return resolveOwnerTraceArtifactPath(ownerId, traceId);
  }

  private resolveConflictIncomingPath(ownerId: string, conflictId: string): string {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const incomingDir = path.resolve(ownerDir, CONFLICT_INCOMING_DIR);
    const artifactPath = path.resolve(incomingDir, `${conflictId}.json`);
    if (!artifactPath.startsWith(`${incomingDir}${path.sep}`)) {
      throw new Error("Invalid conflict incoming path");
    }
    return artifactPath;
  }

  private async readCandidates(ownerId: string): Promise<ExperienceCandidateCollectionFile> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, CANDIDATES_FILE);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ExperienceCandidateCollectionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyCandidatesFile(ownerId);
      }
      throw error;
    }
  }

  private async readReviewAudit(ownerId: string): Promise<ExperienceReviewAuditCollectionFile> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, REVIEW_AUDIT_FILE);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ExperienceReviewAuditCollectionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyReviewAuditFile(ownerId);
      }
      throw error;
    }
  }

  private async appendReviewAudit(
    ownerId: string,
    entry: ExperienceReviewAuditEntry,
  ): Promise<void> {
    const file = await this.readReviewAudit(ownerId);
    await this.writeReviewAudit(ownerId, [...file.records, entry]);
  }

  private async writeReviewAudit(
    ownerId: string,
    records: ExperienceReviewAuditEntry[],
  ): Promise<void> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, REVIEW_AUDIT_FILE);
    const file: ExperienceReviewAuditCollectionFile = {
      schemaVersion: 1,
      ownerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(filePath, file);
  }

  private async readConflicts(ownerId: string): Promise<ExperienceIngestConflictCollectionFile> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, CONFLICTS_FILE);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ExperienceIngestConflictCollectionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyConflictsFile(ownerId);
      }
      throw error;
    }
  }

  private async writeCandidates(
    ownerId: string,
    records: ExperienceCandidate[],
  ): Promise<void> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, CANDIDATES_FILE);
    const file: ExperienceCandidateCollectionFile = {
      schemaVersion: 1,
      ownerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(filePath, file);
  }

  private async writeConflicts(
    ownerId: string,
    records: ExperienceIngestConflict[],
  ): Promise<void> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, CONFLICTS_FILE);
    const file: ExperienceIngestConflictCollectionFile = {
      schemaVersion: 1,
      ownerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(filePath, file);
  }

  private async readLessons(ownerId: string): Promise<ExperienceLessonCollectionFile> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, LESSONS_FILE);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ExperienceLessonCollectionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyLessonsFile(ownerId);
      }
      throw error;
    }
  }

  private async writeLessons(ownerId: string, records: ExperienceLesson[]): Promise<void> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, LESSONS_FILE);
    const file: ExperienceLessonCollectionFile = {
      schemaVersion: 1,
      ownerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(filePath, file);
  }

  private async readPromotionAudit(
    ownerId: string,
  ): Promise<ExperiencePromotionAuditCollectionFile> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, PROMOTION_AUDIT_FILE);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ExperiencePromotionAuditCollectionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyPromotionAuditFile(ownerId);
      }
      throw error;
    }
  }

  private async appendPromotionAudit(
    ownerId: string,
    entry: ExperiencePromotionAuditEntry,
  ): Promise<void> {
    const file = await this.readPromotionAudit(ownerId);
    await this.writePromotionAudit(ownerId, [...file.records, entry]);
  }

  private async writePromotionAudit(
    ownerId: string,
    records: ExperiencePromotionAuditEntry[],
  ): Promise<void> {
    const ownerDir = this.resolveOwnerDir(ownerId);
    const filePath = path.join(ownerDir, PROMOTION_AUDIT_FILE);
    const file: ExperiencePromotionAuditCollectionFile = {
      schemaVersion: 1,
      ownerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(filePath, file);
  }

  private buildExistingPromotionResult(
    candidate: ExperienceCandidate,
    lesson: ExperienceLesson,
    auditEntry: ExperiencePromotionAuditEntry,
  ): ExperiencePromotionResult {
    return {
      outcome: "existing",
      lesson,
      candidate,
      auditEntry,
    };
  }

  private async readTraceArtifact(
    ownerId: string,
    traceId: string,
  ): Promise<SynapseTraceEnvelopeV1 | null> {
    const artifactPath = this.resolveTraceArtifactPath(ownerId, traceId);
    try {
      const raw = await fs.readFile(artifactPath, "utf8");
      return JSON.parse(raw) as SynapseTraceEnvelopeV1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async writeTraceArtifact(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<void> {
    const artifactPath = this.resolveTraceArtifactPath(ownerId, envelope.traceId);
    await atomicWriteJson(artifactPath, envelope);
  }

  private async persistIncomingConflictEnvelope(
    ownerId: string,
    conflictId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<void> {
    const incomingPath = this.resolveConflictIncomingPath(ownerId, conflictId);
    await atomicWriteJson(incomingPath, envelope);
  }

  private buildCandidate(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
    candidateId: string,
    timestamp: string,
  ): ExperienceCandidate {
    return {
      id: candidateId,
      ownerId,
      dedupeKey: candidateId,
      traceRef: {
        traceId: envelope.traceId,
        sessionId: envelope.sessionId,
        runId: envelope.runId,
        source: "synapse",
        signature: envelope.signature,
        ingestedAt: timestamp,
        contractVersion: SYNAPSE_TRACE_ENVELOPE_CONTRACT,
      },
      summary: deriveCandidateSummary({
        tool: envelope.action.tool,
        target: envelope.action.target,
        outcome: envelope.outcome,
        summary: envelope.summary,
      }),
      outcome: envelope.outcome,
      tags: envelope.tags,
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async recordContentConflict(
    ownerId: string,
    candidateId: string,
    envelope: SynapseTraceEnvelopeV1,
    existingArtifact: SynapseTraceEnvelopeV1,
    existingCandidate: ExperienceCandidate,
  ): Promise<ExperienceIngestResult> {
    const incomingDigest = digestTraceEnvelope(envelope);
    const existingDigest = digestTraceEnvelope(existingArtifact);
    const conflictId = randomUUID();
    const timestamp = nowIso();

    const conflict: ExperienceIngestConflict = {
      id: conflictId,
      ownerId,
      candidateId,
      traceId: envelope.traceId,
      reason: "CANDIDATE_CONTENT_DIVERGENCE",
      existingEnvelopeDigest: existingDigest,
      incomingEnvelopeDigest: incomingDigest,
      status: "OPEN",
      createdAt: timestamp,
    };

    const conflicts = await this.readConflicts(ownerId);
    await this.persistIncomingConflictEnvelope(ownerId, conflictId, envelope);
    await this.writeConflicts(ownerId, [...conflicts.records, conflict]);

    return {
      outcome: "conflict",
      candidate: existingCandidate,
      conflict,
    };
  }

  async ingestTraceCandidate(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<ExperienceIngestResult> {
    return withOwnerLock(ownerId, async () => {
      const actionHash = computeActionHash(envelope.action);
      const candidateId = computeExperienceCandidateId({
        signedTraceId: envelope.traceId,
        actionHash,
        actor: envelope.actor,
        policyVersion: envelope.policyVersion,
        observationWindow: envelope.observationWindow,
      });
      const incomingDigest = digestTraceEnvelope(envelope);

      const file = await this.readCandidates(ownerId);
      const existingCandidate = file.records.find((record) => record.id === candidateId);
      const existingArtifact = await this.readTraceArtifact(ownerId, envelope.traceId);

      if (existingArtifact) {
        const storedDigest = digestTraceEnvelope(existingArtifact);
        if (storedDigest !== incomingDigest) {
          if (existingCandidate) {
            return this.recordContentConflict(
              ownerId,
              candidateId,
              envelope,
              existingArtifact,
              existingCandidate,
            );
          }
          throw new ExperienceTraceArtifactMutationError(
            "Trace artifact is immutable; replay rejected because content diverges for the same traceId",
          );
        }
      }

      if (existingCandidate) {
        return {
          outcome: "existing",
          candidate: existingCandidate,
        };
      }

      const timestamp = nowIso();
      const candidate = this.buildCandidate(ownerId, envelope, candidateId, timestamp);

      if (!existingArtifact) {
        await this.writeTraceArtifact(ownerId, envelope);
      }
      await this.writeCandidates(ownerId, [...file.records, candidate]);

      return {
        outcome: "created",
        candidate,
      };
    });
  }

  async reviewCandidate(
    ownerId: string,
    candidateId: string,
    action: ExperienceReviewAction,
    actor: string,
    reason: string,
    reviewCommandId?: string,
  ): Promise<ExperienceReviewResult> {
    return withOwnerLock(ownerId, async () => {
      const file = await this.readCandidates(ownerId);
      const index = file.records.findIndex((record) => record.id === candidateId);
      if (index < 0) {
        throw new ExperienceNotFoundError("Experience candidate not found");
      }

      const candidate = file.records[index]!;
      const targetStatus = resolveReviewTargetStatus(action);
      const auditFile = await this.readReviewAudit(ownerId);

      if (reviewCommandId) {
        const existingAudit = auditFile.records.find(
          (entry) =>
            entry.candidateId === candidateId && entry.reviewCommandId === reviewCommandId,
        );
        if (existingAudit) {
          return {
            outcome: "existing",
            candidate,
            auditEntry: existingAudit,
          };
        }
      }

      if (candidate.status === targetStatus) {
        const existingAudit = [...auditFile.records]
          .reverse()
          .find(
            (entry) =>
              entry.candidateId === candidateId && entry.nextStatus === targetStatus,
          );
        if (!existingAudit) {
          throw new Error("Candidate review state is inconsistent with audit history");
        }
        return {
          outcome: "existing",
          candidate,
          auditEntry: existingAudit,
        };
      }

      assertReviewTransitionAllowed(candidate.status, action);

      const timestamp = nowIso();
      const auditEntry: ExperienceReviewAuditEntry = {
        id: randomUUID(),
        ownerId,
        candidateId,
        action,
        previousStatus: candidate.status,
        nextStatus: targetStatus,
        actor,
        reason,
        reviewCommandId,
        createdAt: timestamp,
      };

      const updatedCandidate: ExperienceCandidate = {
        ...candidate,
        status: targetStatus,
        updatedAt: timestamp,
      };
      const records = [...file.records];
      records[index] = updatedCandidate;

      await this.writeCandidates(ownerId, records);
      await this.appendReviewAudit(ownerId, auditEntry);

      return {
        outcome: "applied",
        candidate: updatedCandidate,
        auditEntry,
      };
    });
  }

  async listReviewAudit(
    ownerId: string,
    candidateId?: string,
  ): Promise<ExperienceReviewAuditEntry[]> {
    const file = await this.readReviewAudit(ownerId);
    if (!candidateId) return file.records;
    return file.records.filter((entry) => entry.candidateId === candidateId);
  }

  async promoteCandidate(
    ownerId: string,
    candidateId: string,
    actor: string,
    reason: string,
    lessonText?: string,
    promotionCommandId?: string,
  ): Promise<ExperiencePromotionResult> {
    return withOwnerLock(ownerId, async () => {
      const file = await this.readCandidates(ownerId);
      const index = file.records.findIndex((record) => record.id === candidateId);
      if (index < 0) {
        throw new ExperienceNotFoundError("Experience candidate not found");
      }

      const candidate = file.records[index]!;
      const lessonsFile = await this.readLessons(ownerId);
      const auditFile = await this.readPromotionAudit(ownerId);
      const existingLesson = lessonsFile.records.find(
        (record) => record.candidateId === candidateId,
      );

      if (promotionCommandId) {
        const existingAudit = auditFile.records.find(
          (entry) =>
            entry.candidateId === candidateId &&
            entry.promotionCommandId === promotionCommandId,
        );
        if (existingAudit) {
          const lesson =
            existingLesson ??
            lessonsFile.records.find((record) => record.id === existingAudit.lessonId);
          if (!lesson) {
            throw new Error("Promotion audit references a missing lesson record");
          }
          const currentCandidate = file.records[index]!;
          return this.buildExistingPromotionResult(currentCandidate, lesson, existingAudit);
        }
      }

      if (candidate.status === "VERIFIED") {
        if (!existingLesson) {
          throw new Error("Candidate is VERIFIED but no lesson record exists");
        }
        const existingAudit = [...auditFile.records]
          .reverse()
          .find((entry) => entry.candidateId === candidateId);
        if (!existingAudit) {
          throw new Error("Candidate promotion state is inconsistent with audit history");
        }
        return this.buildExistingPromotionResult(candidate, existingLesson, existingAudit);
      }

      assertPromotionEligible(candidate.status);

      const timestamp = nowIso();
      const lessonId = randomUUID();
      const lessonContent = lessonText?.trim() || candidate.summary;
      const lesson: ExperienceLesson = {
        id: lessonId,
        ownerId,
        candidateId,
        traceRef: { ...candidate.traceRef },
        lesson: lessonContent,
        approvedBy: "operator",
        approvedAt: timestamp,
        status: "VERIFIED",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const auditEntry: ExperiencePromotionAuditEntry = {
        id: randomUUID(),
        ownerId,
        candidateId,
        lessonId,
        actor,
        approvedBy: "operator",
        reason,
        previousCandidateStatus: candidate.status,
        promotionCommandId,
        promotedAt: timestamp,
        createdAt: timestamp,
      };

      const updatedCandidate: ExperienceCandidate = {
        ...candidate,
        status: "VERIFIED",
        updatedAt: timestamp,
      };
      const records = [...file.records];
      records[index] = updatedCandidate;

      await this.writeCandidates(ownerId, records);
      await this.writeLessons(ownerId, [...lessonsFile.records, lesson]);
      await this.appendPromotionAudit(ownerId, auditEntry);

      return {
        outcome: "promoted",
        lesson,
        candidate: updatedCandidate,
        auditEntry,
      };
    });
  }

  async listLessons(ownerId: string): Promise<ExperienceLesson[]> {
    const file = await this.readLessons(ownerId);
    return file.records;
  }

  async listPromotionAudit(
    ownerId: string,
    candidateId?: string,
  ): Promise<ExperiencePromotionAuditEntry[]> {
    const file = await this.readPromotionAudit(ownerId);
    if (!candidateId) return file.records;
    return file.records.filter((entry) => entry.candidateId === candidateId);
  }

  async listCandidates(ownerId: string, status?: string): Promise<ExperienceCandidate[]> {
    const file = await this.readCandidates(ownerId);
    if (!status) return file.records;
    return file.records.filter((record) => record.status === status);
  }

  async listIngestConflicts(ownerId: string): Promise<ExperienceIngestConflict[]> {
    const file = await this.readConflicts(ownerId);
    return file.records;
  }

  async getCandidateSnapshot(ownerId: string): Promise<ExperienceCandidateSnapshot> {
    const [candidates, conflicts, lessons] = await Promise.all([
      this.listCandidates(ownerId),
      this.listIngestConflicts(ownerId),
      this.listLessons(ownerId),
    ]);
    return {
      candidates,
      summary: {
        candidateCount: candidates.length,
        draftCount: candidates.filter((record) => record.status === "DRAFT").length,
        verifiedCount: candidates.filter((record) => record.status === "VERIFIED").length,
        disputedCount: candidates.filter((record) => record.status === "DISPUTED").length,
        rejectedCount: candidates.filter((record) => record.status === "REJECTED").length,
        archivedCount: candidates.filter((record) => record.status === "ARCHIVED").length,
        lessonCount: lessons.length,
        openConflictCount: conflicts.filter((record) => record.status === "OPEN").length,
      },
    };
  }
}

export function resetLocalExperienceRepositoryLocksForTests(): void {
  ownerLocks.clear();
}
