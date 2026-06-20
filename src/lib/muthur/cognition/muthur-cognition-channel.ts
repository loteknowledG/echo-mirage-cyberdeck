import {
  createMuthurCognitionEventId,
  createMuthurCognitionStreamEntryId,
  MUTHUR_COGNITION_MAX_EVENTS,
  MUTHUR_COGNITION_MAX_STREAM,
  saveMuthurCognition,
  stampMuthurCognitionNow,
} from "@/lib/muthur/cognition/muthur-cognition-store";
import type {
  MuthurCognitionEmitInput,
  MuthurCognitionEvent,
  MuthurCognitionMode,
  MuthurCognitionState,
  MuthurCognitionStreamEntry,
} from "@/lib/muthur/cognition/muthur-cognition-types";

export function normalizeMuthurCognitionMode(value: unknown): MuthurCognitionMode {
  if (value === "off" || value === "summary" || value === "live") return value;
  return "off";
}

export function formatMuthurCognitionLiveLine(event: MuthurCognitionEvent): string {
  return `[${event.category}]\n${event.message}`;
}

function buildSummaryText(events: MuthurCognitionEvent[]): string {
  const sections: string[] = [];

  const observationMessages = events
    .filter((entry) => entry.category === "observe" || entry.category === "pattern")
    .map((entry) => entry.message);
  const retrieveMessages = events
    .filter((entry) => entry.category === "retrieve" || entry.category === "memory")
    .map((entry) => entry.message);
  const synthesizeMessages = events
    .filter((entry) => entry.category === "synthesize" || entry.category === "reflect")
    .map((entry) => entry.message);
  const recommendMessages = events.filter((entry) => entry.category === "recommend").map((entry) => entry.message);
  const missionMessages = events.filter((entry) => entry.category === "mission").map((entry) => entry.message);
  const warningMessages = events.filter((entry) => entry.category === "warning").map((entry) => entry.message);

  if (observationMessages.length > 0) {
    sections.push(`OBSERVATION:\n${observationMessages.join("\n")}`);
  }
  if (retrieveMessages.length > 0) {
    sections.push(`RETRIEVE:\n${retrieveMessages.join("\n")}`);
  }
  if (synthesizeMessages.length > 0) {
    sections.push(`SYNTHESIZE:\n${synthesizeMessages.join("\n")}`);
  }
  if (recommendMessages.length > 0) {
    sections.push(`RECOMMENDATION:\n${recommendMessages.join("\n")}`);
  }
  if (missionMessages.length > 0) {
    sections.push(`MISSION:\n${missionMessages.join("\n")}`);
  }
  if (warningMessages.length > 0) {
    sections.push(`WARNING:\n${warningMessages.join("\n")}`);
  }

  return sections.join("\n\n");
}

function createEvent(input: MuthurCognitionEmitInput): MuthurCognitionEvent {
  return {
    id: createMuthurCognitionEventId(),
    category: input.category,
    message: input.message.trim(),
    createdAt: stampMuthurCognitionNow(),
    missionId: input.missionId,
    source: input.source,
  };
}

function prependStreamEntry(
  stream: MuthurCognitionStreamEntry[],
  entry: MuthurCognitionStreamEntry,
): MuthurCognitionStreamEntry[] {
  return [entry, ...stream].slice(0, MUTHUR_COGNITION_MAX_STREAM);
}

export function setMuthurCognitionMode(
  state: MuthurCognitionState,
  mode: MuthurCognitionMode,
): MuthurCognitionState {
  const next: MuthurCognitionState = {
    ...state,
    mode,
    stream: mode === "off" ? [] : state.stream,
    pendingSummary: mode === "summary" ? state.pendingSummary : [],
  };
  saveMuthurCognition(next);
  return next;
}

export type RecordMuthurCognitionResult = {
  state: MuthurCognitionState;
  needsSummaryFlush: boolean;
};

export function recordMuthurCognitionEvent(
  state: MuthurCognitionState,
  input: MuthurCognitionEmitInput,
): RecordMuthurCognitionResult {
  const event = createEvent(input);
  const events = [event, ...state.events].slice(0, MUTHUR_COGNITION_MAX_EVENTS);

  if (state.mode === "off") {
    const next = { ...state, events };
    saveMuthurCognition(next);
    return { state: next, needsSummaryFlush: false };
  }

  if (state.mode === "live") {
    const streamEntry: MuthurCognitionStreamEntry = {
      id: createMuthurCognitionStreamEntryId(),
      kind: "live",
      text: formatMuthurCognitionLiveLine(event),
      createdAt: event.createdAt,
    };
    const next: MuthurCognitionState = {
      ...state,
      events,
      stream: prependStreamEntry(state.stream, streamEntry),
    };
    saveMuthurCognition(next);
    return { state: next, needsSummaryFlush: false };
  }

  const pendingSummary = [...state.pendingSummary, event];
  const next: MuthurCognitionState = {
    ...state,
    events,
    pendingSummary,
  };
  saveMuthurCognition(next);
  return { state: next, needsSummaryFlush: true };
}

export function flushMuthurCognitionSummary(state: MuthurCognitionState): MuthurCognitionState {
  if (state.mode !== "summary" || state.pendingSummary.length === 0) {
    return state;
  }

  const text = buildSummaryText(state.pendingSummary);
  if (!text.trim()) {
    const cleared = { ...state, pendingSummary: [] };
    saveMuthurCognition(cleared);
    return cleared;
  }

  const streamEntry: MuthurCognitionStreamEntry = {
    id: createMuthurCognitionStreamEntryId(),
    kind: "summary",
    text,
    createdAt: stampMuthurCognitionNow(),
  };

  const next: MuthurCognitionState = {
    ...state,
    pendingSummary: [],
    stream: prependStreamEntry(state.stream, streamEntry),
  };
  saveMuthurCognition(next);
  return next;
}

export function shouldShowMuthurCognitionStream(mode: MuthurCognitionMode): boolean {
  return mode !== "off";
}
