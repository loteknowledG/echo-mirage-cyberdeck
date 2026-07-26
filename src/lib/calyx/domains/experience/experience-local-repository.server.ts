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
} from "./experience-types";

const CANDIDATES_FILE = "candidates.json";
const CONFLICTS_FILE = "conflicts.json";
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

function emptyConflictsFile(ownerId: string): ExperienceIngestConflictCollectionFile {
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
    const [candidates, conflicts] = await Promise.all([
      this.listCandidates(ownerId),
      this.listIngestConflicts(ownerId),
    ]);
    return {
      candidates,
      summary: {
        candidateCount: candidates.length,
        draftCount: candidates.filter((record) => record.status === "DRAFT").length,
        openConflictCount: conflicts.filter((record) => record.status === "OPEN").length,
      },
    };
  }
}

export function resetLocalExperienceRepositoryLocksForTests(): void {
  ownerLocks.clear();
}
