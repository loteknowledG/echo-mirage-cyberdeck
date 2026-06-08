import type { MuthurEditorState, MuthurObservationSnapshot, MuthurObservationSnapshotInput } from "./observation-types";

const MAX_TEXT_LENGTH = 800;

function text(value: unknown, limit = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  return value.slice(0, limit);
}

function sanitizeEditor(raw: unknown): MuthurEditorState | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const content = typeof e.content === "string" ? e.content : null;
  const excerpt = content && content.length > 200 ? content.slice(0, 200) + "..." : content;
  return {
    active: e.active === true,
    filePath: text(e.filePath, 500) ?? null,
    fileName: text(e.fileName, 260) ?? null,
    fileExtension: text(e.fileExtension, 20) ?? null,
    language: text(e.language, 40) ?? null,
    content,
    contentExcerpt: excerpt,
    selectionText: text(e.selectionText, 500) ?? null,
    cursorLine: typeof e.cursorLine === "number" ? e.cursorLine : null,
    cursorColumn: typeof e.cursorColumn === "number" ? e.cursorColumn : null,
    dirty: e.dirty === true,
    readOnly: e.readOnly === true,
  };
}

function sanitizeSnapshot(raw: unknown): MuthurObservationSnapshotInput {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const observedAt =
    typeof input.observedAt === "number" && Number.isFinite(input.observedAt) ? input.observedAt : Date.now();
  return {
    observedAt,
    route: text(input.route, 200) ?? "/",
    surface: input.surface === "property-manager" ? "property-manager" : "cyberdeck",
    activeTab: text(input.activeTab, 120),
    activePane: text(input.activePane, 120),
    visibleDocument: text(input.visibleDocument, 240),
    documentExcerpt: text(input.documentExcerpt),
    editor: sanitizeEditor(input.editor),
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
