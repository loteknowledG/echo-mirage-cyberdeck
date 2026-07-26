import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
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
  type ExperienceRepository,
} from "./experience-repository";
import type {
  SynapseTraceEnvelopeV1,
} from "./experience-trace.server";
import {
  SYNAPSE_TRACE_ENVELOPE_CONTRACT,
  type ExperienceCandidate,
  type ExperienceCandidateCollectionFile,
  type ExperienceCandidateSnapshot,
} from "./experience-types";

const CANDIDATES_FILE = "candidates.json";

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

  private async persistTraceArtifact(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<void> {
    const artifactPath = this.resolveTraceArtifactPath(ownerId, envelope.traceId);
    try {
      await fs.access(artifactPath);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    await atomicWriteJson(artifactPath, envelope);
  }

  async ingestTraceCandidate(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<ExperienceCandidate> {
    return withOwnerLock(ownerId, async () => {
      const actionHash = computeActionHash(envelope.action);
      const candidateId = computeExperienceCandidateId({
        signedTraceId: envelope.traceId,
        actionHash,
        actor: envelope.actor,
        policyVersion: envelope.policyVersion,
        observationWindow: envelope.observationWindow,
      });

      const file = await this.readCandidates(ownerId);
      const existing = file.records.find((record) => record.id === candidateId);
      if (existing) {
        await this.persistTraceArtifact(ownerId, envelope);
        return existing;
      }

      const timestamp = nowIso();
      const candidate: ExperienceCandidate = {
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

      await this.persistTraceArtifact(ownerId, envelope);
      await this.writeCandidates(ownerId, [...file.records, candidate]);
      return candidate;
    });
  }

  async listCandidates(ownerId: string, status?: string): Promise<ExperienceCandidate[]> {
    const file = await this.readCandidates(ownerId);
    if (!status) return file.records;
    return file.records.filter((record) => record.status === status);
  }

  async getCandidateSnapshot(ownerId: string): Promise<ExperienceCandidateSnapshot> {
    const candidates = await this.listCandidates(ownerId);
    return {
      candidates,
      summary: {
        candidateCount: candidates.length,
        draftCount: candidates.filter((record) => record.status === "DRAFT").length,
      },
    };
  }
}

export function resetLocalExperienceRepositoryLocksForTests(): void {
  ownerLocks.clear();
}
