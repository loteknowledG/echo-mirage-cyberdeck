import type { MuthurObservationSnapshotInput } from "./observation-types";

const OBSERVATION_DEBOUNCE_MS = 400;

let pendingSnapshot: MuthurObservationSnapshotInput | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function postObservation(snapshot: MuthurObservationSnapshotInput): Promise<void> {
  try {
    await fetch("/api/muthur/observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: { ...snapshot, observedAt: Date.now() } }),
      keepalive: true,
    });
  } catch {
    // Observation is supplemental context; a failed publish must not interrupt the operator surface.
  }
}

function scheduleObservationFlush(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    if (snapshot) {
      void postObservation(snapshot);
    }
  }, OBSERVATION_DEBOUNCE_MS);
}

/** Coalesce rapid cockpit/editor updates into one POST (keystrokes, tab churn). */
export function publishMuthurObservation(snapshot: MuthurObservationSnapshotInput): void {
  pendingSnapshot = snapshot;
  scheduleObservationFlush();
}

/** Bypass debounce — use when the surface is about to unmount. */
export function flushMuthurObservation(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  if (snapshot) {
    void postObservation(snapshot);
  }
}
