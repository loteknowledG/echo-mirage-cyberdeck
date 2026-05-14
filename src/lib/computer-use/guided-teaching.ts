import { runComputerUseAction } from "./electron-computer-use-bridge";
import {
  startWorkflow,
  endWorkflow,
  getCurrentStep,
  getWorkflowState,
  setMarkerForStep,
} from "./guided-workflow";
import { narrate } from "./narration";
import { acknowledgeWatchdog, cancelTeachingWatchdog, startStepWatchdog, cancelStepWatchdog } from "./teardown";

const DEBUG = process.env.NODE_ENV !== "production";
const TEACHING_MARKER_TTL_MS = 120_000;

export interface TeachingTarget {
  element: HTMLElement;
  rect: DOMRect;
  label: string;
}

function findVisibleTextTarget(label: string): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-pointer-target], button, [role="button"], h1, h2, h3, span'),
  );
  return candidates.find((candidate) => {
    if (!candidate.textContent?.toLowerCase().includes(label.toLowerCase())) return false;
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0;
  }) ?? null;
}

export function findTeachingTarget(targetName: string): TeachingTarget | null {
  let element: HTMLElement | null = null;
  let label = targetName;

  if (targetName === "COMMAND_INPUT") {
    element =
      document.querySelector<HTMLElement>('[data-pointer-target="command-input"]') ??
      document.querySelector<HTMLElement>("input[type='text']") ??
      document.querySelector<HTMLElement>("textarea") ??
      document.querySelector<HTMLElement>("[contenteditable='true']") ??
      null;
    label = "COMMAND_INPUT";
  } else if (targetName === "VOICE_LAB") {
    element =
      document.querySelector<HTMLElement>('[data-pointer-target="voice-lab"]') ??
      document.querySelector<HTMLElement>('[data-cy="voice-lab-button"]') ??
      findVisibleTextTarget("voice lab") ??
      null;
    label = "VOICE_LAB";
  } else if (targetName === "LEFT_CONSOLE") {
    element = document.querySelector<HTMLElement>('[data-pointer-target="left-console"]') ?? null;
    label = "LEFT_CONSOLE";
  } else if (targetName === "RIGHT_PANEL") {
    element = document.querySelector<HTMLElement>('[data-pointer-target="right-panel"]') ?? null;
    label = "RIGHT_PANEL";
  }

  if (!element) {
    if (DEBUG) console.debug(`[TEACHING-DEBUG] findTeachingTarget: ${targetName} -> element null`);
    return null;
  }

  const rect = element.getBoundingClientRect();
  const visible = rect.width > 0 && rect.height > 0;

  if (DEBUG) {
    console.debug(`[TEACHING-DEBUG] findTeachingTarget: ${targetName}`, {
      elementTag: element.tagName,
      elementId: element.id,
      elementClass: (element.className ?? "").substring(0, 40),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      visible,
    });
  }

  if (!visible) return null;

  return { element, rect, label };
}

const TEACHING_DEMO_STEPS = [
  {
    id: "step1",
    label: "Command Input",
    target: "COMMAND_INPUT",
    instruction: "Move your cursor into the command input area.",
  },
  {
    id: "step2",
    label: "Voice Lab",
    target: "VOICE_LAB",
    instruction: "Move your cursor into the highlighted Voice Lab panel.",
  },
];

export function isTeachingDemoTrigger(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "muthur, start teaching demo" ||
    lower === "muthur start teaching demo" ||
    lower === "muthur, guide me through the interface" ||
    lower === "muthur guide me through the interface" ||
    /^(?:muthur[,]?\s+)?start\s+teaching\s+demo$/i.test(lower) ||
    /^(?:muthur[,]?\s+)?guide\s+me\s+through\s+(?:the\s+)?interface$/i.test(lower)
  );
}

export async function runTeachingDemo(): Promise<void> {
  if (DEBUG) console.debug("[TEACHING-DEBUG] runTeachingDemo invoked");

  endWorkflow();
  await runComputerUseAction({ name: "clear_indicators" });

  startWorkflow(TEACHING_DEMO_STEPS);

  const step1 = getCurrentStep();
  if (!step1) return;

  if (DEBUG) console.debug("[TEACHING-DEBUG] step 0 started", { stepId: step1.id, label: step1.label, target: step1.target });

  const target = findTeachingTarget(step1.target);

  if (!target) {
    if (DEBUG) console.debug("[TEACHING-DEBUG] COMMAND_INPUT target not found");
    narrate("TARGET_NOT_FOUND");
    return;
  }

  const { rect, label } = target;

  if (DEBUG) console.debug("[TEACHING-DEBUG] COMMAND_INPUT target bounds", { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });

  const pos1 = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const width1 = Math.max(80, Math.min(rect.width, 480));
  const height1 = Math.max(48, Math.min(rect.height, 240));

  const result1 = await runComputerUseAction({
    name: "indicate_highlight",
    params: {
      position: pos1,
      width: width1,
      height: height1,
      label,
      ttlMs: TEACHING_MARKER_TTL_MS,
    },
  });

if (result1.success && result1.data && typeof result1.data === "object" && "markerId" in result1.data) {
    const markerId = result1.data.markerId as string;
    setMarkerForStep(step1.id, markerId);
    if (DEBUG) console.debug("[TEACHING-DEBUG] indicate_highlight completed", { markerId, pos: pos1, width: width1, height: height1 });
  }

  narrate("INDICATE_POINT");
  acknowledgeWatchdog();
  startStepWatchdog(() => {
    if (DEBUG) console.debug("[TEACHING-DEBUG] step 1 watchdog timeout");
    narrate("TARGET_NOT_FOUND");
    cancelStepWatchdog();
  });
}

export async function proceedToNextStep(): Promise<void> {
  if (DEBUG) console.debug("[TEACHING-DEBUG] proceedToNextStep invoked");

  const state = getWorkflowState();
  if (!state.active) {
    if (DEBUG) console.debug("[TEACHING-DEBUG] proceedToNextStep skipped - no active workflow");
    return;
  }

  const currentStep = getCurrentStep();
  if (!currentStep) {
    if (DEBUG) console.debug("[TEACHING-DEBUG] no next step - clearing and ending workflow");
    await runComputerUseAction({ name: "clear_indicators" });
    return;
  }

  if (DEBUG) console.debug("[TEACHING-DEBUG] advancing to step", { stepId: currentStep.id, label: currentStep.label, target: currentStep.target });

  const target = findTeachingTarget(currentStep.target);

  if (!target) {
    if (DEBUG) console.debug("[TEACHING-DEBUG] target not found for", currentStep.target);
    narrate("TARGET_NOT_FOUND");
    return;
  }

  const { rect, label } = target;

  if (rect.width <= 0 || rect.height <= 0) {
    if (DEBUG) console.debug("[TEACHING-DEBUG] target bounds invalid", { target: currentStep.target, width: rect.width, height: rect.height });
    narrate("TARGET_NOT_FOUND");
    return;
  }

  if (DEBUG) console.debug("[TEACHING-DEBUG] target bounds", { target: currentStep.target, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });

  const pos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const width = Math.max(80, Math.min(rect.width, 480));
  const height = Math.max(48, Math.min(rect.height, 240));

  const result = await runComputerUseAction({
    name: "indicate_highlight",
    params: {
      position: pos,
      width,
      height,
      label,
      ttlMs: TEACHING_MARKER_TTL_MS,
    },
  });

  if (result.success && result.data && typeof result.data === "object" && "markerId" in result.data) {
    const markerId = result.data.markerId as string;
    setMarkerForStep(currentStep.id, markerId);
    if (DEBUG) console.debug("[TEACHING-DEBUG] indicate_highlight completed", { markerId, pos, width, height });
  }

  narrate("INDICATE_HIGHLIGHT");
  acknowledgeWatchdog();
  startStepWatchdog(() => {
    if (DEBUG) console.debug("[TEACHING-DEBUG] step watchdog timeout for", currentStep.id);
    narrate("TARGET_NOT_FOUND");
    cancelStepWatchdog();
  });
}

export function getTeachingDemoSteps() {
  return TEACHING_DEMO_STEPS;
}
