export type MuthurObservationSurface = "cyberdeck" | "property-manager";

export type MuthurEditorState = {
  active: boolean;
  filePath: string | null;
  fileName: string | null;
  fileExtension: string | null;
  language: string | null;
  content: string | null;
  contentExcerpt: string | null;
  selectionText: string | null;
  cursorLine: number | null;
  cursorColumn: number | null;
  dirty: boolean;
  readOnly: boolean;
};

/** Latest operator/cockpit context for MUTHUR tools (not a permission mode). */
export type MuthurObservationSnapshotInput = {
  observedAt?: number;
  route: string;
  surface: MuthurObservationSurface;
  activeTab: string | null;
  activePane: string | null;
  visibleDocument: string | null;
  documentExcerpt: string | null;
  editor?: MuthurEditorState | null;
};

export type MuthurObservationSnapshot = MuthurObservationSnapshotInput & {
  capturedAt: string;
};
