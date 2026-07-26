export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const MAX_SHORT = 256;
const MAX_MEDIUM = 2048;

export function validateOwnerId(ownerId: string): ValidationResult<string> {
  const trimmed = ownerId.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push("ownerId is required");
  if (trimmed.includes("..")) errors.push("ownerId must not contain '..'");
  if (/[/\\]/.test(trimmed)) errors.push("ownerId must not contain path separators");
  if (trimmed.length > 128) errors.push("ownerId exceeds maximum length");
  return errors.length ? { ok: false, errors } : { ok: true, value: trimmed };
}

export function validateTraceId(traceId: string): ValidationResult<string> {
  const trimmed = traceId.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push("traceId is required");
  if (trimmed.includes("..")) errors.push("traceId must not contain '..'");
  if (/[/\\]/.test(trimmed)) errors.push("traceId must not contain path separators");
  if (trimmed.length > MAX_SHORT) errors.push("traceId exceeds maximum length");
  return errors.length ? { ok: false, errors } : { ok: true, value: trimmed };
}

export function validateCandidateListQuery(input: unknown): ValidationResult<{ status?: string }> {
  if (input == null) return { ok: true, value: {} };
  if (typeof input !== "object") {
    return { ok: false, errors: ["Query payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const statusRaw = payload.status;
  if (statusRaw == null) return { ok: true, value: {} };
  if (typeof statusRaw !== "string" || !statusRaw.trim()) {
    return { ok: false, errors: ["status must be a non-empty string when provided"] };
  }
  if (statusRaw.length > MAX_MEDIUM) {
    return { ok: false, errors: ["status exceeds maximum length"] };
  }
  return { ok: true, value: { status: statusRaw.trim() } };
}

const REVIEW_ACTIONS = new Set(["reject", "dispute", "archive"]);

export type ReviewCandidateInput = {
  action: "reject" | "dispute" | "archive";
  reason: string;
  reviewCommandId?: string;
};

export function validateReviewCandidateInput(input: unknown): ValidationResult<ReviewCandidateInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Review payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  const actionRaw = payload.action;
  if (typeof actionRaw !== "string" || !REVIEW_ACTIONS.has(actionRaw)) {
    errors.push("action must be reject, dispute, or archive");
  }
  const reasonRaw = payload.reason;
  if (typeof reasonRaw !== "string" || !reasonRaw.trim()) {
    errors.push("reason is required");
  } else if (reasonRaw.trim().length > MAX_MEDIUM) {
    errors.push("reason exceeds maximum length");
  }
  const reviewCommandIdRaw = payload.reviewCommandId;
  if (
    reviewCommandIdRaw != null &&
    (typeof reviewCommandIdRaw !== "string" || !reviewCommandIdRaw.trim())
  ) {
    errors.push("reviewCommandId must be a non-empty string when provided");
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      action: actionRaw as ReviewCandidateInput["action"],
      reason: (reasonRaw as string).trim(),
      reviewCommandId:
        typeof reviewCommandIdRaw === "string" ? reviewCommandIdRaw.trim() : undefined,
    },
  };
}
