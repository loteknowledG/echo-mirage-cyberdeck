import type { MuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurUplinkMode } from "@/lib/muthur-uplink-mode";
import {
  createMuthurCognitionEventId,
  MUTHUR_COGNITION_MAX_EVENTS,
  saveMuthurCognition,
  stampMuthurCognitionNow,
} from "@/lib/muthur/cognition/muthur-cognition-store";
import type {
  MuthurCognitionEmitInput,
  MuthurCognitionEvent,
  MuthurCognitionState,
} from "@/lib/muthur/cognition/muthur-cognition-types";

export function shouldSurfaceCognitionForUplinkMode(mode: MuthurUplinkMode): boolean {
  return mode === "plan" || mode === "agent" || mode === "commander";
}

export function formatMuthurCognitionDiagnostic(event: MuthurCognitionEvent): string {
  return `[COGNITION ${event.category}] ${event.message}`;
}

export function formatMuthurCognitionDiagnosticFromInput(input: MuthurCognitionEmitInput): string {
  return `[COGNITION ${input.category}] ${input.message.trim()}`;
}

export function buildMuthurCognitionStatusLine(
  mode: MuthurUplinkMode,
  context?: {
    commanderPosture?: MuthurCommanderPosture | null;
    missionTitle?: string;
  },
): string | null {
  switch (mode) {
    case "plan":
      return "[COGNITION] PLAN — observe panes, ask questions; read-only, no edits.";
    case "agent":
      return "[COGNITION] AGENT — full tool execution and operator edits.";
    case "commander": {
      const posture = context?.commanderPosture ?? "AWAITING_MISSION";
      const postureLabel = posture.replace(/_/g, " ");
      if (posture === "EXECUTING" && context?.missionTitle) {
        return `[COGNITION] COMMANDER — EXECUTING: ${context.missionTitle}; event-driven loops active.`;
      }
      return `[COGNITION] COMMANDER — ${postureLabel}; orchestration when mission is active.`;
    }
    default:
      return null;
  }
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

export type RecordMuthurCognitionResult = {
  state: MuthurCognitionState;
  event: MuthurCognitionEvent;
};

export function recordMuthurCognitionEvent(
  state: MuthurCognitionState,
  input: MuthurCognitionEmitInput,
): RecordMuthurCognitionResult {
  const event = createEvent(input);
  const events = [event, ...state.events].slice(0, MUTHUR_COGNITION_MAX_EVENTS);
  const next: MuthurCognitionState = { events };
  saveMuthurCognition(next);
  return { state: next, event };
}
