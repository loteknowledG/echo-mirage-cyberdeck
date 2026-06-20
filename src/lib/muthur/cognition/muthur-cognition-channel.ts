import type { MuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurPosture } from "@/lib/muthur/muthur-posture";
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

export function shouldSurfaceCognitionForPosture(posture: MuthurPosture): boolean {
  return posture === "plan" || posture === "agent" || posture === "commander";
}

export function formatMuthurCognitionDiagnostic(event: MuthurCognitionEvent): string {
  return `[COGNITION ${event.category}] ${event.message}`;
}

export function formatMuthurCognitionDiagnosticFromInput(input: MuthurCognitionEmitInput): string {
  return `[COGNITION ${input.category}] ${input.message.trim()}`;
}

export function buildMuthurCognitionStatusLine(
  posture: MuthurPosture,
  context?: {
    commanderPosture?: MuthurCommanderPosture | null;
    missionTitle?: string;
  },
): string | null {
  switch (posture) {
    case "plan":
      return "[COGNITION] PLAN — observe panes, ask questions; read-only, no edits.";
    case "agent":
      return "[COGNITION] AGENT — full tool execution and operator edits.";
    case "commander": {
      const missionPosture = context?.commanderPosture ?? "AWAITING_MISSION";
      const missionPostureLabel = missionPosture.replace(/_/g, " ");
      if (missionPosture === "EXECUTING" && context?.missionTitle) {
        return `[COGNITION] COMMANDER — EXECUTING: ${context.missionTitle}; event-driven loops active.`;
      }
      return `[COGNITION] COMMANDER — ${missionPostureLabel}; orchestration when mission is active.`;
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
