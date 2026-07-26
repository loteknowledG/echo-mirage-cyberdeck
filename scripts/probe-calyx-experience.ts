/**
 * L-CALYX-110 — Experience candidate ingest probe (slices 1–3).
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
  getExperienceCandidateSnapshot,
  ingestExperienceTrace,
  listExperienceIngestConflicts,
  listExperienceReviewAudit,
  mapExperienceServiceError,
  reviewExperienceCandidate,
} from "../src/lib/calyx/domains/experience/experience-service.server";
import { experienceError } from "../src/lib/calyx/domains/experience/experience-api.server";
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
  console.log("[probe:calyx-experience] PASS");
}

main().catch((error) => {
  console.error("[probe:calyx-experience] FAIL", error);
  process.exitCode = 1;
});
