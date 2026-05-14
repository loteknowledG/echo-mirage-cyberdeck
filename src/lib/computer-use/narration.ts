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
  | "BUILD_FAILURE";

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
  const now = Date.now();

  const existing = recentEvents.find((r) => r.event === event);
  if (existing) {
    existing.count++;
    existing.timestamp = now;
    if (existing.count > DEBOUNCE_MAX_REPEAT) {
      return null;
    }
  } else {
    recentEvents.push({ event, event, count: 1, timestamp: now });
  }

  const old = recentEvents.filter((r) => now - r.timestamp > DEBOUNCE_WINDOW_MS);
  for (const o of old) {
    const idx = recentEvents.indexOf(o);
    if (idx >= 0) recentEvents.splice(idx, 1);
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

export function speakNarration(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.95;
    utterance.volume = 0.7;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    setTimeout(resolve, 2000);
  });
}

export function narrateAndSpeak(event: NarrationEvent, speakEnabled: boolean): Narration | null {
  const narration = narrate(event);
  if (!narration || !speakEnabled) return narration;
  void speakNarration(narration.text);
  return narration;
}