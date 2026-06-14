import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";

export type MuthurDiagnosticEntry = {
  id: string;
  text: string;
  at: number;
};

export type MuthurDiagnosticsState = {
  entries: MuthurDiagnosticEntry[];
  /** Dropped by rate limiter since last reset. */
  rateLimitedCount: number;
  /** Dropped when cap exceeded. */
  cappedCount: number;
};

export const MUTHUR_DIAGNOSTICS_CAP = 200;
export const MUTHUR_DIAGNOSTICS_COLLAPSE_THRESHOLD = 50;
export const MUTHUR_DIAGNOSTICS_RATE_WINDOW_MS = 1_000;
export const MUTHUR_DIAGNOSTICS_RATE_MAX = 12;
export const MUTHUR_RESPONSE_STALL_MS = 120_000;

let diagnosticIdSeq = 0;

export function createEmptyMuthurDiagnosticsState(): MuthurDiagnosticsState {
  return { entries: [], rateLimitedCount: 0, cappedCount: 0 };
}

function nextDiagnosticId(): string {
  diagnosticIdSeq += 1;
  return `diag-${diagnosticIdSeq}`;
}

function countRecentEntries(entries: MuthurDiagnosticEntry[], now: number): number {
  const windowStart = now - MUTHUR_DIAGNOSTICS_RATE_WINDOW_MS;
  let count = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].at < windowStart) break;
    count += 1;
  }
  return count;
}

/** Append one diagnostic line with rate limit + cap. Never blocks caller. */
export function appendMuthurDiagnosticEntry(
  state: MuthurDiagnosticsState,
  text: string,
  now = Date.now(),
): MuthurDiagnosticsState {
  const trimmed = text.trim();
  if (!trimmed) return state;

  const recent = countRecentEntries(state.entries, now);
  if (recent >= MUTHUR_DIAGNOSTICS_RATE_MAX) {
    return { ...state, rateLimitedCount: state.rateLimitedCount + 1 };
  }

  const entry: MuthurDiagnosticEntry = { id: nextDiagnosticId(), text: trimmed, at: now };
  let entries = [...state.entries, entry];
  let cappedCount = state.cappedCount;

  if (entries.length > MUTHUR_DIAGNOSTICS_CAP) {
    const overflow = entries.length - MUTHUR_DIAGNOSTICS_CAP;
    entries = entries.slice(overflow);
    cappedCount += overflow;
  }

  return { ...state, entries, cappedCount };
}

export function appendMuthurDiagnosticBatch(
  state: MuthurDiagnosticsState,
  lines: string[],
  now = Date.now(),
): MuthurDiagnosticsState {
  return lines.reduce((current, line) => appendMuthurDiagnosticEntry(current, line, now), state);
}

export function muthurDiagnosticsToChatMessages(state: MuthurDiagnosticsState): MuthurChatMessage[] {
  return state.entries.map((entry) => ({ role: "system", text: entry.text }));
}

export type MuthurDiagnosticsPresentation = {
  visible: MuthurChatMessage[];
  totalCount: number;
  collapsedSummary: string | null;
  hiddenCount: number;
};

/** Collapse long diagnostic tails into a single summary line for the panel. */
export function presentMuthurDiagnostics(state: MuthurDiagnosticsState): MuthurDiagnosticsPresentation {
  const suppressed = state.rateLimitedCount + state.cappedCount;
  const totalCount = state.entries.length + suppressed;
  const threshold = MUTHUR_DIAGNOSTICS_COLLAPSE_THRESHOLD;

  if (state.entries.length <= threshold) {
    return {
      visible: muthurDiagnosticsToChatMessages(state),
      totalCount,
      collapsedSummary: suppressed > 0 ? formatDiagnosticsSuppressedLine(suppressed) : null,
      hiddenCount: suppressed,
    };
  }

  const head = state.entries.slice(0, 8);
  const tail = state.entries.slice(-12);
  const hiddenInTail = state.entries.length - head.length - tail.length;
  const hiddenCount = hiddenInTail + suppressed;

  const visibleEntries = [...head, ...tail];
  const summary = `[SYS] ${hiddenCount} additional diagnostic events collapsed (${totalCount} total). Expand for recent tail.`;

  return {
    visible: [
      ...muthurDiagnosticsToChatMessages({ ...state, entries: visibleEntries }),
      { role: "system", text: summary },
    ],
    totalCount,
    collapsedSummary: summary,
    hiddenCount,
  };
}

export function formatDiagnosticsSuppressedLine(count: number): string {
  return `[SYS] ${count} diagnostic event(s) suppressed by rate limit or cap.`;
}

export type MuthurResponseStall = {
  phase: string;
  elapsedMs: number;
};

export function buildMuthurStallMessage(stall: MuthurResponseStall): string {
  const phase = stall.phase.trim() || "MUTHUR uplink active";
  const seconds = Math.max(1, Math.round(stall.elapsedMs / 1000));
  return `MUTHUR response stalled // last phase: ${phase} // ${seconds}s`;
}

export function shouldFireMuthurComposeWatchdog(args: {
  isStreaming: boolean;
  streamText: string;
  composeStartedAt: number | null;
  now?: number;
}): MuthurResponseStall | null {
  if (!args.isStreaming && !args.streamText.trim()) return null;
  if (args.composeStartedAt == null) return null;
  const now = args.now ?? Date.now();
  const elapsedMs = now - args.composeStartedAt;
  if (elapsedMs < MUTHUR_RESPONSE_STALL_MS) return null;
  return {
    phase: extractMuthurProgressStatusFromText(args.streamText),
    elapsedMs,
  };
}

function extractMuthurProgressStatusFromText(text: string): string {
  const lines = [...text.matchAll(/^⏳ MUTHUR[^\n]*/gm)].map((match) => match[0]);
  const status = lines.at(-1)?.trim() ?? "";
  return status.replace(/^⏳\s*/, "");
}
