import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startWorkflow,
  endWorkflow,
  getCurrentStep,
  getWorkflowState,
  getNextStep,
  setMarkerForStep,
  acknowledgeCurrentStep,
  advanceWorkflow,
  registerWatchdogCanceller,
} from "../src/lib/computer-use/guided-workflow";
import { isTeachingDemoTrigger, proceedToNextStep, runTeachingDemo } from "../src/lib/computer-use/guided-teaching";
import { addNarrationListener, narrate, pauseNarration, resumeNarration, isNarrationPaused, resetNarrationDebounce } from "../src/lib/computer-use/narration";
import { trackCursorPosition, resetPresence } from "../src/lib/computer-use/cursor-presence";
import { emergencyStop, acknowledgeWatchdog, cancelTeachingWatchdog, startStepWatchdog, cancelStepWatchdog } from "../src/lib/computer-use/teardown";
import type { IndicateMarker } from "../src/lib/computer-use/computer-use-types";
import { getComputerUseStatus } from "../src/lib/computer-use/introspection";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeMarker(id: string, x: number, y: number, w: number, h: number, style: IndicateMarker["style"] = "ring"): IndicateMarker {
  return {
    id,
    position: { x, y },
    width: w,
    height: h,
    style,
    createdAt: Date.now(),
  };
}

function installMockDocument() {
  const commandInput = {
    textContent: "",
    className: "mock-input-field",
    id: "mock-command-input",
    getBoundingClientRect: () => ({
      left: 20,
      top: 700,
      width: 360,
      height: 44,
      right: 380,
      bottom: 744,
    }),
  };
  const voiceLab = {
    textContent: "Voice Lab",
    className: "mock-voice-lab",
    id: "mock-voice-lab",
    getBoundingClientRect: () => ({
      left: 520,
      top: 120,
      width: 220,
      height: 140,
      right: 740,
      bottom: 260,
    }),
  };
  const mockDocument = {
    querySelector: (selector: string) => {
      if (selector === '[data-pointer-target="command-input"]') return commandInput;
      if (selector === '[data-pointer-target="voice-lab"]') return voiceLab;
      if (selector === "input[type='text'], input:not([type])") return commandInput;
      return null;
    },
    querySelectorAll: () => [voiceLab],
  };
  (globalThis as typeof globalThis & { document: Document }).document = mockDocument as unknown as Document;
}

async function main() {
  resumeNarration();
  endWorkflow();

  const heard: string[] = [];
  const removeListener = addNarrationListener((n) => heard.push(n.event));
  void removeListener;

  assert("trigger: exact 'muthur, start teaching demo'", isTeachingDemoTrigger("MUTHUR, start teaching demo"));
  assert("trigger: exact 'muthur start teaching demo'", isTeachingDemoTrigger("muthur start teaching demo"));
  assert("trigger: exact 'muthur, guide me through the interface'", isTeachingDemoTrigger("MUTHUR, guide me through the interface"));
  assert("trigger: 'start teaching demo' alone", isTeachingDemoTrigger("start teaching demo"));
  assert("trigger: 'guide me through the interface' alone", isTeachingDemoTrigger("guide me through the interface"));
  assert("no trigger: 'muthur status'", !isTeachingDemoTrigger("muthur status"));
  assert("no trigger: 'indicate message box'", !isTeachingDemoTrigger("indicate message box"));

  installMockDocument();
  await runTeachingDemo();
  const demoState = getWorkflowState();
  assert("runTeachingDemo starts workflow", demoState.active && demoState.currentStepIndex === 0, demoState);
  assert("runTeachingDemo assigns marker to first step", typeof demoState.markerId === "string", demoState);
  assert("runTeachingDemo creates one active marker", getComputerUseStatus().pointerLayer.activeMarkers === 1);

  const firstMarker = demoState.markerId as string | null;
  const ackResult = acknowledgeCurrentStep(firstMarker ?? undefined);
  assert("teaching demo first marker acknowledges", ackResult, demoState);
  const demoAfterAck = getWorkflowState();
  assert("teaching demo marker set before acknowledge", demoAfterAck.markerId === firstMarker, demoAfterAck);
  const demoNext = advanceWorkflow();
  assert("teaching demo advanceWorkflow returns step2", demoNext?.id === "step2", demoNext);
  const afterAdvance = getWorkflowState();
  assert("advanceWorkflow moves to step2 (index 1)", afterAdvance.currentStepIndex === 1, afterAdvance);
  assert("advanceWorkflow clears prior markerId", afterAdvance.markerId === null, afterAdvance);
  assert("advanceWorkflow sets acknowledged=false", afterAdvance.acknowledged === false, afterAdvance);
  const step2Marker = "probe-step2-marker";
  setMarkerForStep("step2", step2Marker);
  const afterSetMarker = getWorkflowState();
  assert("step2 marker manually set", afterSetMarker.markerId === step2Marker, afterSetMarker);
  const ackResult2 = acknowledgeCurrentStep(step2Marker);
  assert("step2 marker acknowledges", ackResult2, getWorkflowState());
  const afterAck2 = getWorkflowState();
  assert("step2 acknowledged=true", afterAck2.acknowledged === true, afterAck2);
  const finalStep = advanceWorkflow();
  assert("final advanceWorkflow returns null", finalStep === null, finalStep);
  const afterFinalAdvance = getWorkflowState();
  assert("after final advance, workflow not active", afterFinalAdvance.active === false, afterFinalAdvance);
  assert("active marker count is 0 after workflow end", getComputerUseStatus().pointerLayer.activeMarkers === 0, getComputerUseStatus().pointerLayer);
assert("pauseNarration called when workflow naturally ends via advanceWorkflow", isNarrationPaused(), isNarrationPaused());
  resumeNarration();

  resetNarrationDebounce();
  resetNarrationDebounce();
  assert("narrate CURSOR_ENTER_REGION emits", narrate("CURSOR_ENTER_REGION") !== null);
  assert("narrate STEP_ACKNOWLEDGED emits", narrate("STEP_ACKNOWLEDGED") !== null);
  assert("listener heard events", heard.length >= 2, heard);

  const files = [
    "src/lib/computer-use/guided-workflow.ts",
    "src/lib/computer-use/cursor-presence.ts",
    "src/lib/computer-use/guided-teaching.ts",
    "src/lib/computer-use/IndicateOverlay.tsx",
  ];
  const source = files.map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");
  assert(
    "no synthetic MouseEvent dispatch",
    !/\bdispatchEvent\b|\bnew\s+MouseEvent\b|\bnew\s+KeyboardEvent\b/.test(source),
  );
  assert(
    "overlay remains pointer-events: none",
    /pointerEvents:\s*"none"/.test(source),
  );
  assert(
    "no click injection via element.click",
    !/\.click\(\)/.test(source),
  );

  resumeNarration();
  cancelTeachingWatchdog();

  assert("emergencyStop clears workflow", (() => {
    startWorkflow([{ id: "e1", label: "E1", target: "COMMAND_INPUT", instruction: "e" }]);
    const result = emergencyStop();
    const state = getWorkflowState();
    return result.workflowEnded && !state.active;
  })());

  assert("emergencyStop clears indicators", (() => {
    const { getComputerUseStatus } = require("../src/lib/computer-use/introspection");
    return emergencyStop().indicatorsCleared;
  })());

  assert("emergencyStop pauses narration", emergencyStop().narrationPaused === true);

  assert("watchdog starts on acknowledgeWatchdog", (() => {
    cancelTeachingWatchdog();
    acknowledgeWatchdog();
    const active = require("../src/lib/computer-use/teardown").isWatchdogActive();
    cancelTeachingWatchdog();
    return active;
  })());

  endWorkflow();
}

void main();
