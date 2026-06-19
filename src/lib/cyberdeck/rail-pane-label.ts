import {
  normalizeCyberdeckPaneKind,
  paneLabelForKind,
  type CyberdeckPaneKind,
} from "@/features/cyberdeck/pane-registry";

const FIXED_SERVER_PANE_LABELS: Record<string, string> = {
  m: "OPERATOR",
  s: "MAINNET-UPLINK",
  ct: "CARD TABLE",
  b: "SETTINGS",
};

/** Shorter rail tooltip names for a few panes (user-facing kind, not tab index). */
const RAIL_KIND_DISPLAY: Partial<Record<CyberdeckPaneKind, string>> = {
  "glyph-channel": "ASCII",
  "voice-lab": "VOICE",
  "sound-profile": "SOUND",
  tunes: "TUNES",
  "rola-dex": "POWERFIST",
  "test-pane": "TEST",
  "call-center": "CALL CENTER",
  photoshop: "PHOTOSHOP",
  db8: "DB8",
};

/** Human pane name for a fixed server-rail tab (m / s / ct / b). */
export function railPaneLabelForFixedServer(serverId: string, fallbackLabel: string): string {
  return FIXED_SERVER_PANE_LABELS[serverId] ?? fallbackLabel.toUpperCase();
}

/** Human pane name for a custom rail tab — pane kind wins over TAB 1 / TAB 2 labels. */
export function railPaneLabelForCustomTab(tab: { kind: string; label?: string }): string {
  if (tab.kind === "blank") {
    return tab.label?.trim().toUpperCase() || "BLANK TAB";
  }

  if (tab.kind === "realmorphism-kit") return "REALMORPHISM KIT";
  if (tab.kind === "web") return "WEB BROWSER";
  if (tab.kind === "connection") return "CONNECTION";

  const normalized = normalizeCyberdeckPaneKind(tab.kind);
  if (normalized) {
    return RAIL_KIND_DISPLAY[normalized] ?? paneLabelForKind(normalized);
  }

  return paneLabelForKind(tab.kind);
}
