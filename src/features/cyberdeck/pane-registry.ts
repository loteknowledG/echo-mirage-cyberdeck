/** Metadata-only pane registry — no pane body imports, no loader import(). */

export const CYBERDECK_PANE_KINDS = [
  "operator",
  "settings",
  "document",
  "diagnostics",
  "pi",
  "catalog",
  "operators",
  "memory-atlas",
  "voice-lab",
  "flight-log",
  "drop-bay",
  "glyph-channel",
  "rola-dex",
  "tunes",
  "test-pane",
  "call-center",
  "photoshop",
  "db8",
  "cadre",
] as const;

export type CyberdeckPaneKind = (typeof CYBERDECK_PANE_KINDS)[number];

export type CyberdeckPaneRegistryEntry = {
  label: string;
  /** UX sub-steps shown while the pane chunk compiles (cold webpack can be slow). */
  fetchHints?: readonly string[];
};

export const CYBERDECK_PANE_REGISTRY: Record<CyberdeckPaneKind, CyberdeckPaneRegistryEntry> = {
  operator: {
    label: "OPERATOR",
    fetchHints: ["ROUTING", "TOOLBAR", "MARKDOWN RENDERER", "FOLDER NAV", "EXPORT PIPELINE"],
  },
  settings: { label: "SETTINGS" },
  document: {
    label: "DOCUMENT",
    fetchHints: ["SURFACE", "FILE INGEST", "EDITOR"],
  },
  diagnostics: {
    label: "DIAGNOSTIC",
    fetchHints: ["BUS", "MEMORY", "VOICE", "HEAP"],
  },
  pi: { label: "PI CHAT", fetchHints: ["CHAT CORE", "STREAM"] },
  catalog: { label: "CATALOG" },
  operators: { label: "OPERATORS" },
  "memory-atlas": { label: "MEMORY ATLAS" },
  "voice-lab": { label: "VOICE LAB", fetchHints: ["PRESET", "AUDIO CHAIN"] },
  "flight-log": { label: "FLIGHT LOG" },
  "drop-bay": {
    label: "DROP BAY",
    fetchHints: ["INTAKE", "JSONL STORE", "SSE FEED"],
  },
  "glyph-channel": { label: "GLYPH CHANNEL", fetchHints: ["GLYPH BUS", "RENDER"] },
  "rola-dex": { label: "ROLA-DEX", fetchHints: ["DEX", "CAROUSEL"] },
  tunes: { label: "TUNES", fetchHints: ["PLAYLIST", "QUEUE", "PROVIDERS"] },
  "test-pane": { label: "TEST", fetchHints: ["EMBLA", "4-WAY"] },
  "call-center": { label: "CALL CENTER", fetchHints: ["QUEUE", "INBOUND", "RESIDENT COMMS"] },
  photoshop: { label: "PHOTOSHOP", fetchHints: ["CANVAS", "LAYERS", "EXPORT"] },
  db8: { label: "DB8", fetchHints: ["CHAMBER", "DEBATE ROUND", "CONSENSUS"] },
  cadre: { label: "CADRE", fetchHints: ["TERMINAL HOST", "RUNTIME REGISTRY", "OUTPUT STREAM"] },
};

const TAB_KIND_ALIASES: Record<string, CyberdeckPaneKind> = {
  catelog: "catalog",
  diagnostic: "diagnostics",
  execution: "diagnostics",
  "execution-pane": "diagnostics",
  muthur_execution: "diagnostics",
  "muthur-execution": "diagnostics",
  dropbay: "drop-bay",
  music: "tunes",
  tunes: "tunes",
};

export function normalizeCyberdeckPaneKind(kind: string): CyberdeckPaneKind | null {
  const normalized = TAB_KIND_ALIASES[kind] ?? kind;
  return (CYBERDECK_PANE_KINDS as readonly string[]).includes(normalized)
    ? (normalized as CyberdeckPaneKind)
    : null;
}

export function paneLabelForKind(kind: string): string {
  const normalized = normalizeCyberdeckPaneKind(kind);
  if (!normalized) return kind.toUpperCase();
  return CYBERDECK_PANE_REGISTRY[normalized].label;
}

export function paneFetchHintsForKind(kind: string): readonly string[] {
  const normalized = normalizeCyberdeckPaneKind(kind);
  if (!normalized) return [];
  return CYBERDECK_PANE_REGISTRY[normalized].fetchHints ?? [];
}
