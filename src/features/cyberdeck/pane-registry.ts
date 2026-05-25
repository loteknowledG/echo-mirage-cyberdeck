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
  "glyph-channel",
  "rola-dex",
  "sound-profile",
] as const;

export type CyberdeckPaneKind = (typeof CYBERDECK_PANE_KINDS)[number];

export type CyberdeckPaneRegistryEntry = {
  label: string;
};

export const CYBERDECK_PANE_REGISTRY: Record<CyberdeckPaneKind, CyberdeckPaneRegistryEntry> = {
  operator: { label: "OPERATOR" },
  settings: { label: "SETTINGS" },
  document: { label: "DOCUMENT" },
  diagnostics: { label: "DIAGNOSTIC" },
  pi: { label: "PI CHAT" },
  catalog: { label: "CATALOG" },
  operators: { label: "OPERATORS" },
  "memory-atlas": { label: "MEMORY ATLAS" },
  "voice-lab": { label: "VOICE LAB" },
  "flight-log": { label: "FLIGHT LOG" },
  "glyph-channel": { label: "GLYPH CHANNEL" },
  "rola-dex": { label: "ROLA-DEX" },
  "sound-profile": { label: "SOUND PROFILE" },
};

const TAB_KIND_ALIASES: Record<string, CyberdeckPaneKind> = {
  catelog: "catalog",
  diagnostic: "diagnostics",
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
