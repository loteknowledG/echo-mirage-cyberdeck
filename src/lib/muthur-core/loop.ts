import type { MuthurLoopState, ToolLoopStep, ToolRegistry } from "./types";

export function createEmptyToolRegistry(): ToolRegistry {
  return { tools: {} };
}

export function runMuthurCoreLoop(intent: string, _registry: ToolRegistry): MuthurLoopState {
  const normalizedIntent = (intent || "").trim();
  const steps: ToolLoopStep[] = [];

  const step: ToolLoopStep = {
    index: 0,
    intent: normalizedIntent,
    action: "respond",
    toolCall: null,
    toolResult: null,
    note: normalizedIntent ? "Phase 1: placeholder action selected." : "Phase 1: empty intent.",
  };
  steps.push(step);

  return {
    intent: normalizedIntent,
    steps,
    finalized: true,
    finalResponse: normalizedIntent,
  };
}
