import type { PropertyCase } from "@/lib/property-manager/cases/types";

export type CallSessionDirection = "inbound" | "outbound";

export type CallSessionParticipantType = "resident" | "vendor" | "property_manager" | "unknown";

export type CallSessionStatus = "ringing" | "active" | "ended" | "declined";

export type CallSession = {
  id: string;
  direction: CallSessionDirection;
  participantType: CallSessionParticipantType;
  participantName?: string;
  phoneNumber: string;
  caseId?: string;
  caseSlug?: string;
  caseTitle?: string;
  casePropertyName?: string;
  caseUnitId?: string;
  status: CallSessionStatus;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DialerEventType =
  | "outbound_call_started"
  | "inbound_call_started"
  | "inbound_call_declined"
  | "call_ended"
  | "call_attached_to_case"
  | "incoming_call_ringing";

export type DialerEvent = {
  id: string;
  type: DialerEventType;
  sessionId: string;
  timestamp: string;
  actor: "operator";
  payload?: Record<string, unknown>;
};

export type DialerState = {
  incoming: CallSession | null;
  active: CallSession | null;
  recent: CallSession[];
};

export type SimulatedInboundPresetId = "resident-4b" | "vendor-maintenance";

export const DIALER_MAX_DIGITS = 20;

/** Known vendor line — hook for future vendor simulator workflow. */
export const VENDOR_PHONE_NORMALIZED = "5555551000";

const KEYPAD_LETTERS: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
};

export const KEYPAD_ROWS: ReadonlyArray<ReadonlyArray<{ digit: string; letters?: string }>> = [
  [{ digit: "1" }, { digit: "2", letters: "ABC" }, { digit: "3", letters: "DEF" }],
  [{ digit: "4", letters: "GHI" }, { digit: "5", letters: "JKL" }, { digit: "6", letters: "MNO" }],
  [{ digit: "7", letters: "PQRS" }, { digit: "8", letters: "TUV" }, { digit: "9", letters: "WXYZ" }],
  [{ digit: "*" }, { digit: "0", letters: "+" }, { digit: "#" }],
];

export function keypadLetters(digit: string): string | undefined {
  return KEYPAD_LETTERS[digit];
}

export function normalizePhoneInput(raw: string): string {
  return raw.replace(/[^\d*#+]/g, "").slice(0, DIALER_MAX_DIGITS);
}

export function appendDialDigit(current: string, digit: string): string {
  if (!/^[\d*#+]$/.test(digit)) return current;
  return normalizePhoneInput(current + digit);
}

export function detectParticipantType(phoneNumber: string): CallSessionParticipantType {
  const normalized = normalizePhoneInput(phoneNumber).replace(/\D/g, "");
  if (normalized === VENDOR_PHONE_NORMALIZED || normalized.endsWith("5551000")) {
    return "vendor";
  }
  return "unknown";
}

export function formatPhoneDisplay(raw: string): string {
  const value = normalizePhoneInput(raw);
  if (!value) return "";

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    if (digits.length <= 1) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)})`;
    if (digits.length <= 7) {
      return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    }
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

export type SelectedCaseDialerContext = Pick<
  PropertyCase,
  "id" | "slug" | "title" | "residentName" | "residentPhone" | "propertyName" | "unitId"
>;

export function formatCallDuration(startedAtIso: string | undefined, nowMs = Date.now()): string {
  if (!startedAtIso) return "00:00:00";
  const elapsed = Math.max(0, nowMs - new Date(startedAtIso).getTime());
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** E.164-style display for caller ID (e.g. +1 (555) 555-1000). */
export function formatPhoneCallerId(raw: string): string {
  const normalized = normalizePhoneInput(raw);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return formatPhoneDisplay(normalized);
}

export async function fetchDialerState(): Promise<DialerState> {
  const response = await fetch("/api/property-manager/call-sessions", { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<DialerState>;
}

export async function postDialerAction(
  body: Record<string, unknown>,
  sessionId?: string,
): Promise<DialerState> {
  const url = sessionId
    ? `/api/property-manager/call-sessions/${encodeURIComponent(sessionId)}/actions`
    : "/api/property-manager/call-sessions";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  const data = await response.json();
  return data.state as DialerState;
}
