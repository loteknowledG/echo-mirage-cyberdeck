import { createHash } from "node:crypto";
import type { ExperienceOutcome } from "./experience-types";

const IDENTITY_FIELD_SEPARATOR = "\n";

export type ExperienceCandidateIdentityInput = {
  signedTraceId: string;
  actionHash: string;
  actor: string;
  policyVersion: string;
  observationWindow: string;
};

export type NormalizedTraceAction = {
  tool: string;
  target?: string;
  parameters?: Record<string, unknown>;
};

export function computeActionHash(action: NormalizedTraceAction): string {
  const canonical = JSON.stringify({
    tool: action.tool,
    target: action.target ?? "",
    parameters: sortRecordKeys(action.parameters ?? {}),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function computeExperienceCandidateId(
  input: ExperienceCandidateIdentityInput,
): string {
  const payload = [
    input.signedTraceId,
    input.actionHash,
    input.actor,
    input.policyVersion,
    input.observationWindow,
  ].join(IDENTITY_FIELD_SEPARATOR);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function deriveCandidateSummary(input: {
  tool: string;
  target?: string;
  outcome?: ExperienceOutcome;
  summary?: string;
}): string {
  if (input.summary?.trim()) {
    return input.summary.trim();
  }
  const target = input.target ? ` on ${input.target}` : "";
  const outcome = input.outcome ? ` (${input.outcome})` : "";
  return `${input.tool}${target}${outcome}`;
}

function sortRecordKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = value[key];
      return accumulator;
    }, {});
}
