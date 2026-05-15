import { clearMarkers } from "./indicate-layer";
import { pauseNarration } from "./narration";

let _cancelWatchdog: (() => void) | null = null;

export function registerWatchdogCanceller(fn: () => void): void {
  _cancelWatchdog = fn;
}

export interface WorkflowStep {
  id: string;
  label: string;
  target: string;
  instruction: string;
}

export interface WorkflowState {
  active: boolean;
  steps: WorkflowStep[];
  currentStepIndex: number;
  acknowledged: boolean;
  markerId: string | null;
}

const state: WorkflowState = {
  active: false,
  steps: [],
  currentStepIndex: -1,
  acknowledged: false,
  markerId: null,
};

export function startWorkflow(steps: WorkflowStep[]): void {
  if (steps.length === 0) return;
  state.steps = steps.map((step) => ({ ...step }));
  state.currentStepIndex = 0;
  state.acknowledged = false;
  state.markerId = null;
  state.active = true;
}

export function getCurrentStep(): WorkflowStep | null {
  if (!state.active || state.currentStepIndex < 0 || state.currentStepIndex >= state.steps.length) {
    return null;
  }
  return state.steps[state.currentStepIndex];
}

export function getNextStep(): WorkflowStep | null {
  if (!state.active) return null;
  const nextIdx = state.currentStepIndex + 1;
  if (nextIdx >= state.steps.length) return null;
  return state.steps[nextIdx];
}

export function getWorkflowState(): WorkflowState {
  return {
    active: state.active,
    steps: state.steps.map((step) => ({ ...step })),
    currentStepIndex: state.currentStepIndex,
    acknowledged: state.acknowledged,
    markerId: state.markerId,
  };
}

export function setMarkerForStep(stepId: string, markerId: string): void {
  const idx = state.steps.findIndex((s) => s.id === stepId);
  if (idx >= 0 && idx === state.currentStepIndex) {
    state.markerId = markerId;
  }
}

export function acknowledgeCurrentStep(markerId?: string): boolean {
  if (!state.active || state.currentStepIndex < 0) return false;
  if (state.acknowledged) return false;
  if (markerId !== undefined && state.markerId !== null && state.markerId !== markerId) return false;
  state.acknowledged = true;
  return true;
}

export function advanceWorkflow(): WorkflowStep | null {
  if (!state.active) return null;
  if (!state.acknowledged) return null;
  const nextIdx = state.currentStepIndex + 1;
  if (nextIdx >= state.steps.length) {
    state.active = false;
    state.currentStepIndex = -1;
    state.acknowledged = false;
    state.markerId = null;
    clearMarkers();
    pauseNarration();
    if (_cancelWatchdog) {
      _cancelWatchdog();
      _cancelWatchdog = null;
    }
    return null;
  }
  state.currentStepIndex = nextIdx;
  state.acknowledged = false;
  state.markerId = null;
  return state.steps[nextIdx];
}

export function endWorkflow(): void {
  state.active = false;
  state.steps = [];
  state.currentStepIndex = -1;
  state.acknowledged = false;
  state.markerId = null;
  clearMarkers();
}

export function isWorkflowActive(): boolean {
  return state.active;
}

export function isCurrentStepAcknowledged(): boolean {
  return state.acknowledged;
}

export function getActiveStepCount(): number {
  return state.steps.length;
}

export function getCompletedStepCount(): number {
  if (!state.active) return 0;
  return state.currentStepIndex;
}