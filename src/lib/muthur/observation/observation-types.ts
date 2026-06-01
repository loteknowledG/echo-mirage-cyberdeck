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

export type MuthurObservationSnapshotInput = {
  observedAt?: number;
  route: string;
  surface: MuthurObservationSurface;
  observing: boolean;
  observingPanelId: string | null;
  observingSubsystem: string | null;
  activeTab: string | null;
  activePane: string | null;
  visibleDocument: string | null;
  documentExcerpt: string | null;
  selectedProperty: string | null;
  selectedUnit: string | null;
  visibleLogs: string[];
  activeTickets: Array<Record<string, unknown>>;
  operationalMode: "OBSERVE";
  transcriptState: string | null;
  operationalWarnings: string[];
  continuityIndicators: string[];
  editor?: MuthurEditorState | null;
};

export type MuthurObservationSnapshot = MuthurObservationSnapshotInput & {
  capturedAt: string;
  authority: "READ_ONLY_OBSERVATION";
};
