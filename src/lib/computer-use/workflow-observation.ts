import {
  queueQuestion,
  getNextPendingQuestion,
  getPendingQuestionCount,
  clearQuestions,
  getAnswerSummary,
  type SupportedAnswer,
} from "./question-queue";

export type ObservationState = "inactive" | "observing" | "paused" | "complete";
export { getNextPendingQuestion, getPendingQuestionCount, answerQuestion } from "./question-queue";

export interface ObservedEvent {
  id: string;
  type: string;
  label: string;
  context: string;
  timestamp: string;
  confirmed: boolean;
  answer?: SupportedAnswer;
}

export interface ObservationSession {
  state: ObservationState;
  workflowName: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  events: ObservedEvent[];
  pendingQuestionCount: number;
}

const ALLOWED_EVENT_TYPES = new Set([
  "indicate_point",
  "indicate_highlight",
  "clear_indicators",
  "cursor_enter_region",
  "step_acknowledged",
  "teaching_start",
  "teaching_end",
  "self_status_request",
  "inspect_request",
  "alias_resolved",
]);

const BLOCKED_KEYWORDS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "credential",
  "private",
  "ssn",
  "credit",
]);

let session: ObservationSession = {
  state: "inactive",
  workflowName: null,
  startedAt: null,
  stoppedAt: null,
  events: [],
  pendingQuestionCount: 0,
};

function sanitizeContext(context: string): string {
  const lower = context.toLowerCase();
  for (const kw of BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) return "[redacted: sensitive content]";
  }
  return context.length > 200 ? context.substring(0, 200) + "..." : context;
}

function makeId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function startObservation(workflowName?: string): ObservationSession {
  session = {
    state: "observing",
    workflowName: workflowName ?? null,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    events: [],
    pendingQuestionCount: 0,
  };
  clearQuestions();
  return getSession();
}

export function pauseObservation(): ObservationSession {
  if (session.state !== "observing") return getSession();
  session.state = "paused";
  return getSession();
}

export function resumeObservation(): ObservationSession {
  if (session.state !== "paused") return getSession();
  session.state = "observing";
  return getSession();
}

export function stopObservation(): ObservationSession {
  if (session.state === "inactive") return getSession();
  session.state = "complete";
  session.stoppedAt = new Date().toISOString();
  return getSession();
}

export function isObserving(): boolean {
  return session.state === "observing";
}

export function isPaused(): boolean {
  return session.state === "paused";
}

export function isActive(): boolean {
  return session.state === "observing" || session.state === "paused";
}

export function getSession(): ObservationSession {
  return {
    state: session.state,
    workflowName: session.workflowName,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    events: [...session.events],
    pendingQuestionCount: getPendingQuestionCount(),
  };
}

export function recordEvent(type: string, label: string, context: string): ObservedEvent | null {
  if (session.state !== "observing") return null;
  if (!ALLOWED_EVENT_TYPES.has(type)) return null;

  const sanitized = sanitizeContext(context);
  const event: ObservedEvent = {
    id: makeId(),
    type,
    label,
    context: sanitized,
    timestamp: new Date().toISOString(),
    confirmed: false,
  };

  session.events.push(event);
  queueQuestion(type, sanitized, event.id);
  return event;
}

export function confirmEvent(eventId: string, answer: SupportedAnswer): boolean {
  const event = session.events.find((e) => e.id === eventId);
  if (!event) return false;

  event.answer = answer;
  event.confirmed = answer === "record_this" || answer === "yes";

  return true;
}

export function getEvents(): readonly ObservedEvent[] {
  return [...session.events];
}

export function getConfirmedEvents(): readonly ObservedEvent[] {
  return session.events.filter((e) => e.confirmed);
}

export function getOptionalEvents(): readonly ObservedEvent[] {
  return session.events.filter((e) => e.answer === "optional");
}

export function getRecoveryEvents(): readonly ObservedEvent[] {
  return session.events.filter((e) => e.answer === "recovery");
}

export function getEventCount(): number {
  return session.events.length;
}

export function formatDraftProcedure(): string {
  if (session.state !== "complete") {
    return "Observation not complete. Use stop workflow observation to finalize.";
  }

  const lines: string[] = [];
  lines.push("=== WORKFLOW PROCEDURE DRAFT ===");
  lines.push("");

  if (session.workflowName) {
    lines.push(`Workflow: ${session.workflowName}`);
    lines.push("");
  }

  if (session.startedAt) {
    lines.push(`Observed: ${session.startedAt}`);
  }
  if (session.stoppedAt) {
    lines.push(`Completed: ${session.stoppedAt}`);
  }
  lines.push("");

  const confirmed = getConfirmedEvents();
  const optional = getOptionalEvents();
  const recovery = getRecoveryEvents();
  const ignored = session.events.filter(
    (e) => !e.confirmed && e.answer && (e.answer === "ignore_this" || e.answer === "no")
  );

  if (confirmed.length > 0) {
    lines.push("## Confirmed Steps");
    for (const e of confirmed) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      lines.push(`  ${time} — ${e.type}: ${e.label} [${e.context}]`);
    }
    lines.push("");
  }

  if (optional.length > 0) {
    lines.push("## Optional Steps");
    for (const e of optional) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      lines.push(`  ${time} — ${e.type}: ${e.label} [${e.context}]`);
    }
    lines.push("");
  }

  if (recovery.length > 0) {
    lines.push("## Recovery Steps");
    for (const e of recovery) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      lines.push(`  ${time} — ${e.type}: ${e.label} [${e.context}]`);
    }
    lines.push("");
  }

  if (ignored.length > 0) {
    lines.push("## Skipped / Not Recorded");
    for (const e of ignored) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      lines.push(`  ${time} — ${e.type}: ${e.label}`);
    }
    lines.push("");
  }

  const pendingQ = getNextPendingQuestion();
  if (pendingQ) {
    lines.push("## Unresolved Questions");
    lines.push(`  [${pendingQ.id}] ${pendingQ.question}`);
    lines.push(`  Context: ${pendingQ.context}`);
    lines.push("");
  }

  lines.push(`Total events observed: ${session.events.length}`);
  lines.push(`Confirmed: ${confirmed.length} | Optional: ${optional.length} | Recovery: ${recovery.length} | Skipped: ${ignored.length}`);

  return lines.join("\n");
}

export function resetObservation(): void {
  session = {
    state: "inactive",
    workflowName: null,
    startedAt: null,
    stoppedAt: null,
    events: [],
    pendingQuestionCount: 0,
  };
  clearQuestions();
}