import { createHash } from "node:crypto";
import {
  canonicalizeTraceEnvelopePayload,
  type SynapseTraceEnvelopeV1,
} from "./experience-trace.server";

export function digestTraceEnvelope(envelope: SynapseTraceEnvelopeV1): string {
  const payload = canonicalizeTraceEnvelopePayload(envelope);
  return createHash("sha256")
    .update(`${payload}\n${envelope.signature}`, "utf8")
    .digest("hex");
}

export function envelopesMateriallyEqual(
  left: SynapseTraceEnvelopeV1,
  right: SynapseTraceEnvelopeV1,
): boolean {
  return digestTraceEnvelope(left) === digestTraceEnvelope(right);
}
