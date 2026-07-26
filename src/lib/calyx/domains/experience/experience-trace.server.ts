import { createHmac, timingSafeEqual } from "node:crypto";
import {
  SYNAPSE_TRACE_ENVELOPE_CONTRACT,
  type ExperienceOutcome,
} from "./experience-types";
import { computeActionHash, type NormalizedTraceAction } from "./experience-identity";

export type SynapseTraceEnvelopeV1 = {
  contractVersion: typeof SYNAPSE_TRACE_ENVELOPE_CONTRACT;
  traceId: string;
  sessionId?: string;
  runId?: string;
  actor: string;
  policyVersion: string;
  observationWindow: string;
  action: NormalizedTraceAction;
  outcome?: ExperienceOutcome;
  summary?: string;
  tags?: string[];
  observedAt: string;
  signature: string;
};

export type SynapseTraceEnvelopePayload = Omit<SynapseTraceEnvelopeV1, "signature">;

export class ExperienceTraceVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceTraceVerificationError";
  }
}

export function resolveExperienceIngestHmacSecret(): string | null {
  const secret = process.env.CALYX_EXPERIENCE_INGEST_HMAC_SECRET?.trim();
  return secret ? secret : null;
}

export function canonicalizeTraceEnvelopePayload(
  payload: SynapseTraceEnvelopePayload,
): string {
  return JSON.stringify({
    contractVersion: payload.contractVersion,
    traceId: payload.traceId,
    sessionId: payload.sessionId ?? null,
    runId: payload.runId ?? null,
    actor: payload.actor,
    policyVersion: payload.policyVersion,
    observationWindow: payload.observationWindow,
    action: {
      tool: payload.action.tool,
      target: payload.action.target ?? null,
      parameters: payload.action.parameters ?? {},
    },
    outcome: payload.outcome ?? null,
    summary: payload.summary ?? null,
    tags: payload.tags ?? [],
    observedAt: payload.observedAt,
  });
}

export function signSynapseTraceEnvelope(
  payload: SynapseTraceEnvelopePayload,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(canonicalizeTraceEnvelopePayload(payload), "utf8")
    .digest("hex");
}

export function buildSignedSynapseTraceEnvelope(
  payload: SynapseTraceEnvelopePayload,
  secret: string,
): SynapseTraceEnvelopeV1 {
  const signature = signSynapseTraceEnvelope(payload, secret);
  return { ...payload, signature };
}

export function verifySynapseTraceEnvelope(
  envelope: unknown,
  secret: string,
): SynapseTraceEnvelopeV1 {
  if (!envelope || typeof envelope !== "object") {
    throw new ExperienceTraceVerificationError("Trace envelope must be an object");
  }

  const candidate = envelope as Partial<SynapseTraceEnvelopeV1>;
  if (candidate.contractVersion !== SYNAPSE_TRACE_ENVELOPE_CONTRACT) {
    throw new ExperienceTraceVerificationError("Unsupported trace envelope contract version");
  }

  const errors = validateTraceEnvelopeFields(candidate);
  if (errors.length > 0) {
    throw new ExperienceTraceVerificationError(errors.join("; "));
  }

  const signature = candidate.signature!;
  const payload: SynapseTraceEnvelopePayload = {
    contractVersion: SYNAPSE_TRACE_ENVELOPE_CONTRACT,
    traceId: candidate.traceId!.trim(),
    sessionId: candidate.sessionId?.trim() || undefined,
    runId: candidate.runId?.trim() || undefined,
    actor: candidate.actor!.trim(),
    policyVersion: candidate.policyVersion!.trim(),
    observationWindow: candidate.observationWindow!.trim(),
    action: {
      tool: candidate.action!.tool.trim(),
      target: candidate.action!.target?.trim() || undefined,
      parameters: candidate.action!.parameters,
    },
    outcome: candidate.outcome,
    summary: candidate.summary?.trim() || undefined,
    tags: candidate.tags?.map((tag) => tag.trim()).filter(Boolean),
    observedAt: candidate.observedAt!.trim(),
  };

  const expected = signSynapseTraceEnvelope(payload, secret);
  if (!safeEqualHex(signature, expected)) {
    throw new ExperienceTraceVerificationError("Trace envelope signature verification failed");
  }

  // Ensure action hash is computable (normalization guard).
  computeActionHash(payload.action);

  return { ...payload, signature };
}

function validateTraceEnvelopeFields(candidate: Partial<SynapseTraceEnvelopeV1>): string[] {
  const errors: string[] = [];
  if (!candidate.traceId?.trim()) errors.push("traceId is required");
  if (!candidate.actor?.trim()) errors.push("actor is required");
  if (!candidate.policyVersion?.trim()) errors.push("policyVersion is required");
  if (!candidate.observationWindow?.trim()) errors.push("observationWindow is required");
  if (!candidate.observedAt?.trim()) errors.push("observedAt is required");
  if (!candidate.signature?.trim()) errors.push("signature is required");
  if (!candidate.action || typeof candidate.action !== "object") {
    errors.push("action is required");
  } else if (!candidate.action.tool?.trim()) {
    errors.push("action.tool is required");
  }
  if (
    candidate.outcome &&
    !["success", "failure", "partial", "unknown"].includes(candidate.outcome)
  ) {
    errors.push("outcome must be a valid experience outcome");
  }
  return errors;
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}
