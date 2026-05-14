export type NarrationEvent =
  | "INDICATE_POINT"
  | "INDICATE_HIGHLIGHT"
  | "INDICATE_CLEARED"
  | "CONTROL_REQUESTED"
  | "CONTROL_GRANTED"
  | "CONTROL_RETURNED"
  | "OWNERSHIP_DENIED"
  | "UNSUPPORTED_ACTION"
  | "BUILD_SUCCESS"
  | "BUILD_FAILURE"
  | "CURSOR_ENTER_REGION"
  | "STEP_ACKNOWLEDGED"
  | "TARGET_NOT_FOUND";

export interface Narration {
  event: NarrationEvent;
  text: string;
  timestamp: string;
}

export type NarrationListener = (narration: Narration) => void;

const NARRATION_MAP: Record<NarrationEvent, string> = {
  INDICATE_POINT: "Indicating command input.",
  INDICATE_HIGHLIGHT: "Highlighting target area.",
  INDICATE_CLEARED: "Indicators cleared.",
  CONTROL_REQUESTED: "Control handoff requested.",
  CONTROL_GRANTED: "Control granted.",
  CONTROL_RETURNED: "Control returned to user.",
  OWNERSHIP_DENIED: "Action denied by ownership policy.",
  UNSUPPORTED_ACTION: "Unsupported action.",
  BUILD_SUCCESS: "Build completed.",
  BUILD_FAILURE: "Build failed.",
  CURSOR_ENTER_REGION: "Step acknowledged.",
  STEP_ACKNOWLEDGED: "Proceeding to next instruction.",
  TARGET_NOT_FOUND: "Unable to locate teaching target.",
};

const listeners: Set<NarrationListener> = new Set();
const recentEvents: { event: NarrationEvent; count: number; timestamp: number }[] = [];
const DEBOUNCE_WINDOW_MS = 3000;
const DEBOUNCE_MAX_REPEAT = 3;

export function addNarrationListener(fn: NarrationListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function narrate(event: NarrationEvent): Narration | null {
  if (narrationPaused) return null;
  const now = Date.now();

  for (let i = recentEvents.length - 1; i >= 0; i--) {
    if (now - recentEvents[i].timestamp > DEBOUNCE_WINDOW_MS) {
      recentEvents.splice(i, 1);
    }
  }

  const existingIdx = recentEvents.findIndex((r) => r.event === event);
  if (existingIdx >= 0) {
    recentEvents[existingIdx].count++;
    recentEvents[existingIdx].timestamp = now;
    if (recentEvents[existingIdx].count > DEBOUNCE_MAX_REPEAT) {
      return null;
    }
  } else {
    recentEvents.push({ event, count: 1, timestamp: now });
  }

  const text = NARRATION_MAP[event] ?? "Operational event.";
  const narration: Narration = {
    event,
    text,
    timestamp: new Date().toISOString(),
  };

  for (const listener of listeners) {
    try {
      listener(narration);
    } catch {
      /* drop listener errors */
    }
  }

  return narration;
}

export function speakNarration(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const cleanup = () => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  };

  cleanup();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
  };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 0.95;
  utterance.volume = 0.7;
  utterance.onend = finish;
  utterance.onerror = finish;
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    finish();
    return;
  }
  setTimeout(finish, 2000);
}

export function narrateAndSpeak(event: NarrationEvent, speakEnabled: boolean): Narration | null {
  const narration = narrate(event);
  if (!narration || !speakEnabled) return narration;
  void speakNarration(narration.text);
  return narration;
}

let narrationPaused = false;

export function pauseNarration(): void {
  narrationPaused = true;
}

export function resumeNarration(): void {
  narrationPaused = false;
}

export function isNarrationPaused(): boolean {
  return narrationPaused;
}
