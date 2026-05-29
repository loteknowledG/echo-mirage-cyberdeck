import type { MuthurObservationSnapshot, MuthurObservationSnapshotInput } from "./observation-types";

const MAX_TEXT_LENGTH = 800;
const MAX_ITEMS = 12;

function text(value: unknown, limit = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  return value.slice(0, limit);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ITEMS)
    .map((entry) => text(entry, 300))
    .filter((entry): entry is string => entry !== null);
}

function tickets(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ITEMS).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(entry as Record<string, unknown>)) {
      output[key] = typeof raw === "string" ? raw.slice(0, MAX_TEXT_LENGTH) : raw;
    }
    return [output];
  });
}

function sanitizeSnapshot(raw: unknown): MuthurObservationSnapshotInput {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const observedAt = typeof input.observedAt === "number" && Number.isFinite(input.observedAt) ? input.observedAt : Date.now();
  return {
    observedAt,
    route: text(input.route, 200) ?? "/",
    surface: input.surface === "property-manager" ? "property-manager" : "cyberdeck",
    observing: input.observing === true,
    observingPanelId: text(input.observingPanelId, 120),
    observingSubsystem: text(input.observingSubsystem, 120),
    activeTab: text(input.activeTab, 120),
    activePane: text(input.activePane, 120),
    visibleDocument: text(input.visibleDocument, 240),
    documentExcerpt: text(input.documentExcerpt),
    selectedProperty: text(input.selectedProperty, 240),
    selectedUnit: text(input.selectedUnit, 120),
    visibleLogs: stringList(input.visibleLogs),
    activeTickets: tickets(input.activeTickets),
    operationalMode: "OBSERVE",
    transcriptState: text(input.transcriptState, 120),
    operationalWarnings: stringList(input.operationalWarnings),
    continuityIndicators: stringList(input.continuityIndicators),
  };
}

class MuthurObservationStore {
  private latest: MuthurObservationSnapshot | null = null;
  private bySurface = new Map<MuthurObservationSnapshot["surface"], MuthurObservationSnapshot>();

  record(raw: unknown): MuthurObservationSnapshot {
    const snapshotInput = sanitizeSnapshot(raw);
    const currentForSurface = this.bySurface.get(snapshotInput.surface);
    if (
      currentForSurface?.observedAt != null &&
      snapshotInput.observedAt != null &&
      snapshotInput.observedAt < currentForSurface.observedAt
    ) {
      return { ...currentForSurface };
    }
    this.latest = {
      ...snapshotInput,
      capturedAt: new Date().toISOString(),
      authority: "READ_ONLY_OBSERVATION",
    };
    this.bySurface.set(this.latest.surface, this.latest);
    return this.latest;
  }

  getLatest(surface?: MuthurObservationSnapshot["surface"]): MuthurObservationSnapshot | null {
    const snapshot = surface ? this.bySurface.get(surface) ?? null : this.latest;
    return snapshot ? { ...snapshot } : null;
  }
}

const globalForObservation = globalThis as typeof globalThis & {
  __muthurObservationStore?: MuthurObservationStore;
};

export function getMuthurObservationStore(): MuthurObservationStore {
  if (!globalForObservation.__muthurObservationStore) {
    globalForObservation.__muthurObservationStore = new MuthurObservationStore();
  }
  return globalForObservation.__muthurObservationStore;
}

export function recordMuthurObservation(raw: unknown): MuthurObservationSnapshot {
  return getMuthurObservationStore().record(raw);
}

export function getLatestMuthurObservation(
  surface?: MuthurObservationSnapshot["surface"],
): MuthurObservationSnapshot | null {
  return getMuthurObservationStore().getLatest(surface);
}
