import type { MuthurObservationSnapshotInput } from "./observation-types";

export async function publishMuthurObservation(snapshot: MuthurObservationSnapshotInput): Promise<void> {
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
