export const VERIFY_CHECK_KINDS = [
  "route_loads",
  "text_exists",
  "button_visible",
  "no_console_errors",
  "screenshot_captured",
  "api_returns_200",
] as const;

export type VerifyCheckKind = (typeof VERIFY_CHECK_KINDS)[number];

export type VerifyConditionPayload = {
  check: VerifyCheckKind;
  route?: string;
  url?: string;
  text?: string;
  selector?: string;
  api_path?: string;
  max_console_errors?: number;
  screenshot_path?: string;
  base_url?: string;
  expect_status?: number;
};

export type VerifyCheckResult = {
  check: VerifyCheckKind;
  passed: boolean;
  message: string;
  evidence_path?: string;
  metadata?: Record<string, unknown>;
};

export type VerificationOutcome = {
  passed: boolean;
  checks: VerifyCheckResult[];
  evidence_paths: string[];
  receipt_path?: string;
};

export const VERIFICATION_STATUSES = [
  "awaiting_verification",
  "verified",
  "verification_failed",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DEFAULT_VERIFICATION_BASE_URL = "http://127.0.0.1:3050";

export function parseVerifyChecks(raw: unknown): VerifyConditionPayload[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is VerifyConditionPayload => {
      return Boolean(item && typeof item === "object" && typeof (item as VerifyConditionPayload).check === "string");
    });
  }
  if (typeof raw === "object" && typeof (raw as VerifyConditionPayload).check === "string") {
    return [raw as VerifyConditionPayload];
  }
  return [];
}
