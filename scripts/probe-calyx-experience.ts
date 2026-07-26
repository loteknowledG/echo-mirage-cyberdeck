/**
 * L-CALYX-110 — Experience candidate ingest probe (slices 1–5).
 * Run: pnpm probe:calyx-experience
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  computeActionHash,
  computeExperienceCandidateId,
} from "../src/lib/calyx/domains/experience/experience-identity";
import {
  LocalExperienceRepository,
  resetLocalExperienceRepositoryLocksForTests,
} from "../src/lib/calyx/domains/experience/experience-local-repository.server";
import {
  CalyxExperienceRepository,
  CalyxExperienceRepositoryUnavailableError,
  probeCalyxExperienceRepositoryCapabilities,
} from "../src/lib/calyx/domains/experience/experience-calyx-repository.server";
import {
  getExperienceRepository,
  resetExperienceRepositoryForTests,
  resolveExperienceStorageMode,
  setExperienceRepositoryForTests,
} from "../src/lib/calyx/domains/experience/experience-repository-factory.server";
import { ExperienceTraceArtifactMutationError } from "../src/lib/calyx/domains/experience/experience-repository";
import {
  getExperienceCandidate,
  getExperienceCandidateLineage,
  getExperienceCandidateSnapshot,
  getExperienceLessonLineage,
  getExperienceOperationalMetrics,
  ingestExperienceTrace,
  listExperienceDomainEvents,
  listExperienceIngestConflicts,
  listExperienceLessons,
  listExperiencePromotionAudit,
  listExperienceReviewAudit,
  mapExperienceServiceError,
  promoteExperienceCandidate,
  reviewExperienceCandidate,
} from "../src/lib/calyx/domains/experience/experience-service.server";
import { experienceError } from "../src/lib/calyx/domains/experience/experience-api.server";
import { ExperiencePromotionNotAllowedError } from "../src/lib/calyx/domains/experience/experience-promotion";
import { ExperienceInvalidReviewTransitionError } from "../src/lib/calyx/domains/experience/experience-review";
import {
  buildSignedSynapseTraceEnvelope,
  ExperienceTraceVerificationError,
  signSynapseTraceEnvelope,
  verifySynapseTraceEnvelope,
  type SynapseTraceEnvelopePayload,
} from "../src/lib/calyx/domains/experience/experience-trace.server";
import { SYNAPSE_TRACE_ENVELOPE_CONTRACT } from "../src/lib/calyx/domains/experience/experience-types";
import { validateOwnerId } from "../src/lib/calyx/domains/experience/experience-validation";

const TEST_OWNER = "experience-probe-owner";
const OTHER_OWNER = "experience-probe-other";
const TEST_HMAC_SECRET = "probe-experience-hmac-secret";
let probeCandidateSeq = 0;

function baseEnvelopePayload(): SynapseTraceEnvelopePayload {
  return {
    contractVersion: SYNAPSE_TRACE_ENVELOPE_CONTRACT,
    traceId: "synapse-trace-probe-001",
    sessionId: "session-probe-001",
    runId: "run-probe-001",
    actor: "probe-agent",
    policyVersion: "experience-policy/v1",
    observationWindow: "2026-07-26T00:00:00.000Z/2026-07-26T00:05:00.000Z",
    action: {
      tool: "browser_click",
      target: "submit-button",
      parameters: { ref: "btn-submit" },
    },
    outcome: "success",
    summary: "Probe click action completed.",
    tags: ["probe"],
    observedAt: "2026-07-26T00:04:12.000Z",
  };
}

async function withTempRepository<T>(
  fn: (repo: LocalExperienceRepository, root: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), "echo-experience-probe-"));
  const repo = new LocalExperienceRepository(root);
  process.env.CALYX_EXPERIENCE_STORAGE = "local";
  process.env.CALYX_EXPERIENCE_INGEST_HMAC_SECRET = TEST_HMAC_SECRET;
  setExperienceRepositoryForTests(repo, root);
  try {
    return await fn(repo, root);
  } finally {
    resetExperienceRepositoryForTests();
    resetLocalExperienceRepositoryLocksForTests();
    delete process.env.CALYX_EXPERIENCE_INGEST_HMAC_SECRET;
    await rm(root, { recursive: true, force: true });
  }
}

function testIdentityAndActionHash() {
  const actionHash = computeActionHash({
    tool: "browser_click",
    target: "submit-button",
    parameters: { ref: "btn-submit", z: 1, a: 2 },
  });
  const actionHashReordered = computeActionHash({
    tool: "browser_click",
    target: "submit-button",
    parameters: { a: 2, z: 1, ref: "btn-submit" },
  });
  assert.equal(actionHash, actionHashReordered);

  const id = computeExperienceCandidateId({
    signedTraceId: "trace-1",
    actionHash,
    actor: "agent-a",
    policyVersion: "policy/v1",
    observationWindow: "window-a",
  });
  assert.match(id, /^[a-f0-9]{64}$/);

  const id2 = computeExperienceCandidateId({
    signedTraceId: "trace-1",
    actionHash,
    actor: "agent-a",
    policyVersion: "policy/v1",
    observationWindow: "window-a",
  });
  assert.equal(id, id2);
}

function testTraceVerification() {
  const payload = baseEnvelopePayload();
  const envelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
  const verified = verifySynapseTraceEnvelope(envelope, TEST_HMAC_SECRET);
  assert.equal(verified.traceId, payload.traceId);

  const tampered = {
    ...envelope,
    summary: "Tampered summary",
  };
  assert.throws(
    () => verifySynapseTraceEnvelope(tampered, TEST_HMAC_SECRET),
    ExperienceTraceVerificationError,
  );

  const unsigned = { ...payload, signature: "" };
  assert.throws(
    () => verifySynapseTraceEnvelope(unsigned, TEST_HMAC_SECRET),
    /signature is required/,
  );

  const wrongContract = { ...envelope, contractVersion: "synapse-trace-envelope/v0" };
  assert.throws(
    () => verifySynapseTraceEnvelope(wrongContract, TEST_HMAC_SECRET),
    /Unsupported trace envelope contract/,
  );
}

function testOwnerValidation() {
  assert.equal(validateOwnerId("../escape").ok, false);
  assert.equal(validateOwnerId("valid-owner").ok, true);
}

async function testIngestCreatesDraftCandidate() {
  await withTempRepository(async () => {
    const envelope = buildSignedSynapseTraceEnvelope(
      baseEnvelopePayload(),
      TEST_HMAC_SECRET,
    );
    const result = await ingestExperienceTrace(TEST_OWNER, envelope);
    assert.equal(result.outcome, "created");
    assert.equal(result.candidate.status, "DRAFT");
    assert.equal(result.candidate.dedupeKey, result.candidate.id);
    assert.equal(result.candidate.traceRef.traceId, envelope.traceId);

    const snapshot = await getExperienceCandidateSnapshot(TEST_OWNER);
    assert.equal(snapshot.summary.candidateCount, 1);
    assert.equal(snapshot.summary.draftCount, 1);
    assert.equal(snapshot.summary.verifiedCount, 0);
    assert.equal(snapshot.summary.lessonCount, 0);
    assert.equal(snapshot.summary.openConflictCount, 0);
  });
}

async function testIdempotentIngestAndPersistence() {
  await withTempRepository(async (repo, root) => {
    const envelope = buildSignedSynapseTraceEnvelope(
      baseEnvelopePayload(),
      TEST_HMAC_SECRET,
    );
    const first = await ingestExperienceTrace(TEST_OWNER, envelope);
    assert.equal(first.outcome, "created");

    const second = await ingestExperienceTrace(TEST_OWNER, envelope);
    assert.equal(second.outcome, "existing");
    assert.equal(first.candidate.id, second.candidate.id);

    const snapshot = await getExperienceCandidateSnapshot(TEST_OWNER);
    assert.equal(snapshot.candidates.length, 1);

    const tracePath = path.join(root, TEST_OWNER, "traces", `${envelope.traceId}.json`);
    const traceRaw = await readFile(tracePath, "utf8");
    assert.ok(traceRaw.includes("browser_click"));
    assert.doesNotMatch(traceRaw, /\\\\|\/tmp\/|probe-experience-hmac-secret/);

    const recreated = new LocalExperienceRepository(root);
    setExperienceRepositoryForTests(recreated, root);
    const persisted = await recreated.getCandidateSnapshot(TEST_OWNER);
    assert.equal(persisted.candidates[0]?.id, first.candidate.id);
    assert.equal(persisted.candidates[0]?.status, "DRAFT");
  });
}

async function testDivergentReplaySameIdentitySurfacesConflict() {
  await withTempRepository(async (repo, root) => {
    const payload = baseEnvelopePayload();
    const firstEnvelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
    const created = await ingestExperienceTrace(TEST_OWNER, firstEnvelope);
    assert.equal(created.outcome, "created");

    const divergentPayload = {
      ...payload,
      summary: "Divergent summary for the same identity.",
    };
    const divergentEnvelope = buildSignedSynapseTraceEnvelope(
      divergentPayload,
      TEST_HMAC_SECRET,
    );
    const conflict = await ingestExperienceTrace(TEST_OWNER, divergentEnvelope);
    assert.equal(conflict.outcome, "conflict");
    assert.equal(conflict.candidate.id, created.candidate.id);
    assert.equal(conflict.candidate.summary, created.candidate.summary);
    assert.ok(conflict.conflict);
    assert.equal(conflict.conflict?.reason, "CANDIDATE_CONTENT_DIVERGENCE");

    const snapshot = await getExperienceCandidateSnapshot(TEST_OWNER);
    assert.equal(snapshot.candidates.length, 1);
    assert.equal(snapshot.summary.openConflictCount, 1);

    const conflicts = await listExperienceIngestConflicts(TEST_OWNER);
    assert.equal(conflicts.length, 1);

    const incomingPath = path.join(
      root,
      TEST_OWNER,
      "conflict-incoming",
      `${conflicts[0]!.id}.json`,
    );
    const incomingRaw = await readFile(incomingPath, "utf8");
    assert.ok(incomingRaw.includes("Divergent summary"));
  });
}

async function testTraceArtifactMutationRejected() {
  await withTempRepository(async () => {
    const first = buildSignedSynapseTraceEnvelope(baseEnvelopePayload(), TEST_HMAC_SECRET);
    await ingestExperienceTrace(TEST_OWNER, first);

    const mutatedPayload = {
      ...baseEnvelopePayload(),
      action: {
        tool: "browser_type",
        target: "input-field",
        parameters: { text: "hello" },
      },
    };
    const mutated = buildSignedSynapseTraceEnvelope(mutatedPayload, TEST_HMAC_SECRET);

    await assert.rejects(
      () => ingestExperienceTrace(TEST_OWNER, mutated),
      ExperienceTraceArtifactMutationError,
    );

    const snapshot = await getExperienceCandidateSnapshot(TEST_OWNER);
    assert.equal(snapshot.candidates.length, 1);
    assert.equal(snapshot.summary.openConflictCount, 0);
  });
}

async function testOwnerIsolation() {
  await withTempRepository(async (repo) => {
    const envelope = buildSignedSynapseTraceEnvelope(
      baseEnvelopePayload(),
      TEST_HMAC_SECRET,
    );
    const result = await repo.ingestTraceCandidate(TEST_OWNER, envelope);
    assert.equal(result.outcome, "created");

    const ownerA = await repo.getCandidateSnapshot(TEST_OWNER);
    const ownerB = await repo.getCandidateSnapshot(OTHER_OWNER);
    assert.equal(ownerA.summary.candidateCount, 1);
    assert.equal(ownerB.summary.candidateCount, 0);
  });
}

async function testIngestRequiresSecret() {
  await withTempRepository(async () => {
    delete process.env.CALYX_EXPERIENCE_INGEST_HMAC_SECRET;
    const envelope = buildSignedSynapseTraceEnvelope(
      baseEnvelopePayload(),
      TEST_HMAC_SECRET,
    );
    await assert.rejects(() => ingestExperienceTrace(TEST_OWNER, envelope), /not configured/);
  });
}

function testApiEnvelopesAndPathLeak() {
  const ok = experienceError("TRACE_VERIFICATION_FAILED", "bad", 400);
  assert.equal(ok.status, 400);

  const mapped = mapExperienceServiceError(
    new ExperienceTraceVerificationError("signature failed"),
  );
  assert.equal(mapped.code, "TRACE_VERIFICATION_FAILED");
  const body = JSON.stringify(mapped);
  assert.doesNotMatch(body, /\\\\|\/tmp\/|\.calyx|probe-experience-hmac-secret/);

  const mutation = mapExperienceServiceError(
    new ExperienceTraceArtifactMutationError("Trace artifact is immutable"),
  );
  assert.equal(mutation.code, "TRACE_ARTIFACT_MUTATION");
  assert.equal(mutation.status, 409);

  const internal = mapExperienceServiceError(new Error("ENOENT: /secret/path/trace.json"));
  assert.equal(internal.code, "INTERNAL_ERROR");
  assert.doesNotMatch(internal.message, /\/secret\/path/);
}

function testRepositorySelection() {
  resetExperienceRepositoryForTests();
  process.env.CALYX_EXPERIENCE_STORAGE = "local";
  assert.equal(resolveExperienceStorageMode(), "local");
  assert.ok(getExperienceRepository() instanceof LocalExperienceRepository);

  process.env.CALYX_EXPERIENCE_STORAGE = "calyx";
  assert.equal(resolveExperienceStorageMode(), "calyx");
  assert.ok(getExperienceRepository() instanceof CalyxExperienceRepository);
  process.env.CALYX_EXPERIENCE_STORAGE = "local";
}

async function testUnavailableCalyxRepository() {
  const repo = new CalyxExperienceRepository("probe unavailable");
  await assert.rejects(async () => repo.getCandidateSnapshot(TEST_OWNER));
  const probe = await probeCalyxExperienceRepositoryCapabilities();
  assert.equal(probe.available, false);
}

async function testCandidateIdRecomputation() {
  const payload = baseEnvelopePayload();
  const envelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
  const actionHash = computeActionHash(envelope.action);
  const expectedId = computeExperienceCandidateId({
    signedTraceId: envelope.traceId,
    actionHash,
    actor: envelope.actor,
    policyVersion: envelope.policyVersion,
    observationWindow: envelope.observationWindow,
  });

  await withTempRepository(async () => {
    const result = await ingestExperienceTrace(TEST_OWNER, envelope);
    assert.equal(result.candidate.id, expectedId);
  });
}

function testSignatureDeterministic() {
  const payload = baseEnvelopePayload();
  const a = signSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
  const b = signSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
  assert.equal(a, b);
}

async function ingestProbeCandidate(ownerId = TEST_OWNER) {
  probeCandidateSeq += 1;
  const payload: SynapseTraceEnvelopePayload = {
    ...baseEnvelopePayload(),
    traceId: `synapse-trace-probe-review-${probeCandidateSeq}`,
    runId: `run-probe-review-${probeCandidateSeq}`,
  };
  const envelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
  const result = await ingestExperienceTrace(ownerId, envelope);
  assert.equal(result.outcome, "created");
  return result.candidate;
}

async function testReviewWorkflowTransitions() {
  await withTempRepository(async (repo, root) => {
    const candidate = await ingestProbeCandidate();

    const rejected = await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "reject",
      reason: "Insufficient evidence for promotion review.",
      reviewCommandId: "review-cmd-reject-001",
    });
    assert.equal(rejected.outcome, "applied");
    assert.equal(rejected.candidate.status, "REJECTED");
    assert.equal(rejected.auditEntry.previousStatus, "DRAFT");
    assert.equal(rejected.auditEntry.nextStatus, "REJECTED");
    assert.equal(rejected.auditEntry.actor, "local-operator");

    const rejectedAgain = await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "reject",
      reason: "Insufficient evidence for promotion review.",
      reviewCommandId: "review-cmd-reject-001",
    });
    assert.equal(rejectedAgain.outcome, "existing");
    assert.equal(rejectedAgain.auditEntry.id, rejected.auditEntry.id);

    await assert.rejects(
      () =>
        reviewExperienceCandidate(TEST_OWNER, candidate.id, {
          action: "dispute",
          reason: "Too late to dispute.",
        }),
      ExperienceInvalidReviewTransitionError,
    );

    const disputedCandidate = await ingestProbeCandidate();
    const disputed = await reviewExperienceCandidate(TEST_OWNER, disputedCandidate.id, {
      action: "dispute",
      reason: "Needs operator clarification.",
    });
    assert.equal(disputed.candidate.status, "DISPUTED");

    const archivedFromDispute = await reviewExperienceCandidate(
      TEST_OWNER,
      disputedCandidate.id,
      {
        action: "archive",
        reason: "Withdrawn from active review.",
      },
    );
    assert.equal(archivedFromDispute.candidate.status, "ARCHIVED");

    const disputedForReject = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, disputedForReject.id, {
      action: "dispute",
      reason: "Escalated for second opinion.",
    });
    const rejectedFromDispute = await reviewExperienceCandidate(
      TEST_OWNER,
      disputedForReject.id,
      {
        action: "reject",
        reason: "Dispute resolved as reject.",
      },
    );
    assert.equal(rejectedFromDispute.candidate.status, "REJECTED");

    const draftArchived = await ingestProbeCandidate();
    const archived = await reviewExperienceCandidate(TEST_OWNER, draftArchived.id, {
      action: "archive",
      reason: "Not relevant to current portfolio.",
    });
    assert.equal(archived.candidate.status, "ARCHIVED");

    const audit = await listExperienceReviewAudit(TEST_OWNER, candidate.id);
    assert.equal(audit.length, 1);

    const tracePath = path.join(root, TEST_OWNER, "traces", `${candidate.traceRef.traceId}.json`);
    const traceBefore = await readFile(tracePath, "utf8");
    const traceCheckCandidate = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, traceCheckCandidate.id, {
      action: "reject",
      reason: "trace immutability check",
      reviewCommandId: "review-cmd-trace-check",
    });
    const traceAfter = await readFile(tracePath, "utf8");
    assert.equal(traceBefore, traceAfter);

    const conflicts = await listExperienceIngestConflicts(TEST_OWNER);
    assert.equal(conflicts.length, 0);
  });
}

async function testReviewAuditIsAppendOnly() {
  await withTempRepository(async () => {
    const candidate = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "dispute",
      reason: "First review action",
      reviewCommandId: "audit-append-001",
    });
    const midAudit = await listExperienceReviewAudit(TEST_OWNER, candidate.id);
    assert.equal(midAudit.length, 1);

    await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "archive",
      reason: "Second review action",
      reviewCommandId: "audit-append-002",
    });
    const finalAudit = await listExperienceReviewAudit(TEST_OWNER, candidate.id);
    assert.equal(finalAudit.length, 2);
    assert.equal(finalAudit[0]?.id, midAudit[0]?.id);
    assert.notEqual(finalAudit[0]?.id, finalAudit[1]?.id);
  });
}

async function testOpenConflictsRemainAfterReview() {
  await withTempRepository(async () => {
    const payload = baseEnvelopePayload();
    const firstEnvelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
    const created = await ingestExperienceTrace(TEST_OWNER, firstEnvelope);
    assert.equal(created.outcome, "created");

    const divergent = buildSignedSynapseTraceEnvelope(
      { ...payload, summary: "Conflicting summary for review slice." },
      TEST_HMAC_SECRET,
    );
    const conflict = await ingestExperienceTrace(TEST_OWNER, divergent);
    assert.equal(conflict.outcome, "conflict");

    await reviewExperienceCandidate(TEST_OWNER, created.candidate.id, {
      action: "archive",
      reason: "Archive despite open ingest conflict elsewhere.",
    });

    const conflicts = await listExperienceIngestConflicts(TEST_OWNER);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, "OPEN");
  });
}

async function testExplicitPromotionCreatesLesson() {
  await withTempRepository(async (repo, root) => {
    const candidate = await ingestProbeCandidate();

    const promoted = await promoteExperienceCandidate(TEST_OWNER, candidate.id, {
      reason: "Operator verified this trace as reusable guidance.",
      lesson: "Click submit only after form validation passes.",
      promotionCommandId: "promote-cmd-001",
    });
    assert.equal(promoted.outcome, "promoted");
    assert.equal(promoted.candidate.status, "VERIFIED");
    assert.equal(promoted.lesson.candidateId, candidate.id);
    assert.equal(promoted.lesson.traceRef.traceId, candidate.traceRef.traceId);
    assert.equal(promoted.lesson.approvedBy, "operator");
    assert.equal(promoted.auditEntry.actor, "local-operator");
    assert.equal(promoted.auditEntry.previousCandidateStatus, "DRAFT");

    const promotedAgain = await promoteExperienceCandidate(TEST_OWNER, candidate.id, {
      reason: "Operator verified this trace as reusable guidance.",
      lesson: "Click submit only after form validation passes.",
      promotionCommandId: "promote-cmd-001",
    });
    assert.equal(promotedAgain.outcome, "existing");
    assert.equal(promotedAgain.lesson.id, promoted.lesson.id);
    assert.equal(promotedAgain.auditEntry.id, promoted.auditEntry.id);

    const lessons = await listExperienceLessons(TEST_OWNER);
    assert.equal(lessons.length, 1);

    const snapshot = await getExperienceCandidateSnapshot(TEST_OWNER);
    assert.equal(snapshot.summary.verifiedCount, 1);
    assert.equal(snapshot.summary.lessonCount, 1);
    assert.equal(snapshot.summary.draftCount, 0);

    const tracePath = path.join(root, TEST_OWNER, "traces", `${candidate.traceRef.traceId}.json`);
    const traceBefore = await readFile(tracePath, "utf8");
    const otherCandidate = await ingestProbeCandidate();
    await promoteExperienceCandidate(TEST_OWNER, otherCandidate.id, {
      reason: "Second promotion trace check",
      promotionCommandId: "promote-cmd-trace-check",
    });
    const traceAfter = await readFile(tracePath, "utf8");
    assert.equal(traceBefore, traceAfter);

    const reviewAuditBefore = await listExperienceReviewAudit(TEST_OWNER, candidate.id);
    await promoteExperienceCandidate(TEST_OWNER, otherCandidate.id, {
      reason: "duplicate idempotency check",
      promotionCommandId: "promote-cmd-other-check",
    });
    const reviewAuditAfter = await listExperienceReviewAudit(TEST_OWNER, candidate.id);
    assert.equal(reviewAuditBefore.length, reviewAuditAfter.length);
  });
}

async function testPromotionRejectedForNonDraftCandidates() {
  await withTempRepository(async () => {
    const candidate = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "reject",
      reason: "Not promotable.",
    });

    await assert.rejects(
      () =>
        promoteExperienceCandidate(TEST_OWNER, candidate.id, {
          reason: "Too late to promote.",
        }),
      ExperiencePromotionNotAllowedError,
    );

    const disputed = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, disputed.id, {
      action: "dispute",
      reason: "Under dispute.",
    });
    await assert.rejects(
      () =>
        promoteExperienceCandidate(TEST_OWNER, disputed.id, {
          reason: "Cannot promote disputed candidate.",
        }),
      ExperiencePromotionNotAllowedError,
    );
  });
}

async function testPromotionAuditIsAppendOnly() {
  await withTempRepository(async () => {
    const first = await ingestProbeCandidate();
    const second = await ingestProbeCandidate();

    await promoteExperienceCandidate(TEST_OWNER, first.id, {
      reason: "First lesson promotion",
      promotionCommandId: "promote-audit-001",
    });
    const midAudit = await listExperiencePromotionAudit(TEST_OWNER);
    assert.equal(midAudit.length, 1);

    await promoteExperienceCandidate(TEST_OWNER, second.id, {
      reason: "Second lesson promotion",
      promotionCommandId: "promote-audit-002",
    });
    const finalAudit = await listExperiencePromotionAudit(TEST_OWNER);
    assert.equal(finalAudit.length, 2);
    assert.equal(finalAudit[0]?.id, midAudit[0]?.id);
    assert.notEqual(finalAudit[0]?.id, finalAudit[1]?.id);
  });
}

async function testOpenConflictsRemainAfterPromotion() {
  await withTempRepository(async () => {
    const payload = baseEnvelopePayload();
    const firstEnvelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
    const created = await ingestExperienceTrace(TEST_OWNER, firstEnvelope);
    assert.equal(created.outcome, "created");

    const divergent = buildSignedSynapseTraceEnvelope(
      { ...payload, summary: "Conflicting summary for promotion slice." },
      TEST_HMAC_SECRET,
    );
    const conflict = await ingestExperienceTrace(TEST_OWNER, divergent);
    assert.equal(conflict.outcome, "conflict");

    await promoteExperienceCandidate(TEST_OWNER, created.candidate.id, {
      reason: "Promote despite open ingest conflict elsewhere.",
    });

    const conflicts = await listExperienceIngestConflicts(TEST_OWNER);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, "OPEN");
  });
}

async function testCandidateLineageLinksTraceAndLesson() {
  await withTempRepository(async () => {
    const candidate = await ingestProbeCandidate();
    const promoted = await promoteExperienceCandidate(TEST_OWNER, candidate.id, {
      reason: "Lineage probe promotion",
      lesson: "Validated lineage lesson text.",
      promotionCommandId: "lineage-promote-001",
    });

    const lineage = await getExperienceCandidateLineage(TEST_OWNER, candidate.id);
    assert.equal(lineage.candidate.id, candidate.id);
    assert.equal(lineage.trace.traceId, candidate.traceRef.traceId);
    assert.equal(lineage.trace.artifactPresent, true);
    assert.ok(lineage.trace.envelopeDigest);
    assert.equal(lineage.trace.ingestedAt, candidate.traceRef.ingestedAt);
    assert.equal(lineage.lesson?.id, promoted.lesson.id);
    assert.equal(lineage.promotionEvents.length, 1);

    const lessonLineage = await getExperienceLessonLineage(
      TEST_OWNER,
      promoted.lesson.id,
    );
    assert.equal(lessonLineage.lesson.candidateId, candidate.id);
    assert.equal(lessonLineage.candidate.id, candidate.id);
    assert.equal(lessonLineage.trace.traceId, candidate.traceRef.traceId);
  });
}

async function testDomainEventsMergeReviewAndPromotionPortfolio() {
  await withTempRepository(async () => {
    const reviewed = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, reviewed.id, {
      action: "reject",
      reason: "Portfolio event probe reject",
      reviewCommandId: "lineage-review-portfolio",
    });

    const promotedCandidate = await ingestProbeCandidate();
    await promoteExperienceCandidate(TEST_OWNER, promotedCandidate.id, {
      reason: "Portfolio event probe promote",
      promotionCommandId: "lineage-promote-portfolio",
    });

    const allEvents = await listExperienceDomainEvents(TEST_OWNER);
    assert.equal(allEvents.length, 2);
    assert.equal(allEvents.some((event) => event.kind === "review"), true);
    assert.equal(allEvents.some((event) => event.kind === "promotion"), true);

    const reviewOnly = await listExperienceDomainEvents(TEST_OWNER, reviewed.id);
    assert.equal(reviewOnly.length, 1);
    assert.equal(reviewOnly[0]?.kind, "review");
  });
}

async function testDomainEventsMergeReviewAndPromotionDraftPath() {
  await withTempRepository(async () => {
    const candidate = await ingestProbeCandidate();
    await promoteExperienceCandidate(TEST_OWNER, candidate.id, {
      reason: "Promotion event probe",
      promotionCommandId: "lineage-promote-events-002",
    });

    const allEvents = await listExperienceDomainEvents(TEST_OWNER);
    assert.equal(allEvents.length, 1);
    assert.equal(allEvents[0]?.kind, "promotion");

    const candidateEvents = await listExperienceDomainEvents(TEST_OWNER, candidate.id);
    assert.equal(candidateEvents.length, 1);
    assert.equal(candidateEvents[0]?.entry.candidateId, candidate.id);
  });
}

async function testOperationalMetricsReflectPersistedState() {
  await withTempRepository(async () => {
    const candidate = await ingestProbeCandidate();
    await reviewExperienceCandidate(TEST_OWNER, candidate.id, {
      action: "reject",
      reason: "Metrics probe reject",
    });
    const promotedCandidate = await ingestProbeCandidate();
    await promoteExperienceCandidate(TEST_OWNER, promotedCandidate.id, {
      reason: "Metrics probe promote",
    });

    const payload = baseEnvelopePayload();
    const envelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
    await ingestExperienceTrace(TEST_OWNER, envelope);
    const divergent = buildSignedSynapseTraceEnvelope(
      { ...payload, summary: "Metrics conflict probe" },
      TEST_HMAC_SECRET,
    );
    await ingestExperienceTrace(TEST_OWNER, divergent);

    const metrics = await getExperienceOperationalMetrics(TEST_OWNER);
    assert.equal(metrics.candidateCount, 3);
    assert.equal(metrics.rejectedCount, 1);
    assert.equal(metrics.verifiedCount, 1);
    assert.equal(metrics.draftCount, 1);
    assert.equal(metrics.lessonCount, 1);
    assert.equal(metrics.openConflictCount, 1);
    assert.equal(metrics.totalConflictCount, 1);
    assert.equal(metrics.promotionEventCount, 1);
    assert.equal(metrics.reviewEventCount, 1);
  });
}

async function testLineageSurvivesIdempotentIngestReplay() {
  await withTempRepository(async () => {
    probeCandidateSeq += 1;
    const payload: SynapseTraceEnvelopePayload = {
      ...baseEnvelopePayload(),
      traceId: `synapse-trace-lineage-replay-${probeCandidateSeq}`,
      runId: `run-lineage-replay-${probeCandidateSeq}`,
    };
    const envelope = buildSignedSynapseTraceEnvelope(payload, TEST_HMAC_SECRET);
    const created = await ingestExperienceTrace(TEST_OWNER, envelope);
    await promoteExperienceCandidate(TEST_OWNER, created.candidate.id, {
      reason: "Lineage replay probe",
      promotionCommandId: "lineage-replay-promote",
    });

    const replay = await ingestExperienceTrace(TEST_OWNER, envelope);
    assert.equal(replay.outcome, "existing");

    const lineage = await getExperienceCandidateLineage(TEST_OWNER, created.candidate.id);
    assert.equal(lineage.lesson?.candidateId, created.candidate.id);
    assert.equal(lineage.trace.artifactPresent, true);

    const fetched = await getExperienceCandidate(TEST_OWNER, created.candidate.id);
    assert.equal(fetched.status, "VERIFIED");
  });
}

async function testLineageSurvivesRepositoryRecreation() {
  await withTempRepository(async (_repo, root) => {
    const candidate = await ingestProbeCandidate();
    const promoted = await promoteExperienceCandidate(TEST_OWNER, candidate.id, {
      reason: "Persistence lineage probe",
      promotionCommandId: "lineage-persist-promote",
    });

    const recreated = new LocalExperienceRepository(root);
    setExperienceRepositoryForTests(recreated, root);

    const lineage = await getExperienceCandidateLineage(TEST_OWNER, candidate.id);
    assert.equal(lineage.lesson?.id, promoted.lesson.id);
    assert.equal(lineage.trace.traceId, candidate.traceRef.traceId);

    const metrics = await getExperienceOperationalMetrics(TEST_OWNER);
    assert.equal(metrics.lessonCount, 1);
    assert.equal(metrics.promotionEventCount, 1);
  });
}

async function main() {
  testIdentityAndActionHash();
  testTraceVerification();
  testOwnerValidation();
  testApiEnvelopesAndPathLeak();
  testRepositorySelection();
  testSignatureDeterministic();
  await testUnavailableCalyxRepository();
  await testIngestCreatesDraftCandidate();
  await testIdempotentIngestAndPersistence();
  await testDivergentReplaySameIdentitySurfacesConflict();
  await testTraceArtifactMutationRejected();
  await testOwnerIsolation();
  await testIngestRequiresSecret();
  await testCandidateIdRecomputation();
  await testReviewWorkflowTransitions();
  await testReviewAuditIsAppendOnly();
  await testOpenConflictsRemainAfterReview();
  await testExplicitPromotionCreatesLesson();
  await testPromotionRejectedForNonDraftCandidates();
  await testPromotionAuditIsAppendOnly();
  await testOpenConflictsRemainAfterPromotion();
  await testCandidateLineageLinksTraceAndLesson();
  await testDomainEventsMergeReviewAndPromotionPortfolio();
  await testDomainEventsMergeReviewAndPromotionDraftPath();
  await testOperationalMetricsReflectPersistedState();
  await testLineageSurvivesIdempotentIngestReplay();
  await testLineageSurvivesRepositoryRecreation();
  console.log("[probe:calyx-experience] PASS");
}

main().catch((error) => {
  console.error("[probe:calyx-experience] FAIL", error);
  process.exitCode = 1;
});
