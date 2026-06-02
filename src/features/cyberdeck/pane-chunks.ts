import type { ComponentType } from "react";
import { normalizeCyberdeckPaneKind, type CyberdeckPaneKind } from "@/features/cyberdeck/pane-registry";

export type CyberdeckPaneModule = {
  default: ComponentType<any>;
};

/** Direct dynamic imports — one async boundary per pane, no loader-router hop. */
const PANE_IMPORTS: Record<CyberdeckPaneKind, () => Promise<CyberdeckPaneModule>> = {
  operator: () => import("@/features/cyberdeck/pane-loaders/operator"),
  settings: () => import("@/features/cyberdeck/pane-loaders/settings"),
  document: () => import("@/features/cyberdeck/pane-loaders/document"),
  diagnostics: () => import("@/features/cyberdeck/pane-loaders/diagnostics"),
  pi: () => import("@/features/cyberdeck/pane-loaders/pi-chat"),
  catalog: () => import("@/features/cyberdeck/pane-loaders/catalog"),
  operators: () => import("@/features/cyberdeck/pane-loaders/operators"),
  "memory-atlas": () => import("@/features/cyberdeck/pane-loaders/memory-atlas"),
  "voice-lab": () => import("@/features/cyberdeck/pane-loaders/voice-lab"),
  "flight-log": () => import("@/features/cyberdeck/pane-loaders/flight-log"),
  "drop-bay": () => import("@/features/cyberdeck/pane-loaders/drop-bay"),
  "glyph-channel": () => import("@/features/cyberdeck/pane-loaders/glyph-channel"),
  "rola-dex": () => import("@/features/cyberdeck/pane-loaders/rola-dex"),
  "sound-profile": () => import("@/features/cyberdeck/pane-loaders/sound-profile"),
};

export function importCyberdeckPane(kind: string): Promise<CyberdeckPaneModule> {
  const normalized = normalizeCyberdeckPaneKind(kind);
  if (!normalized) {
    return Promise.reject(new Error(`Unknown cyberdeck pane kind: ${kind}`));
  }
  return PANE_IMPORTS[normalized]();
}

/** Warm a pane chunk during idle time (dev cold-compile mitigation). */
export function prefetchCyberdeckPane(kind: string): void {
  const normalized = normalizeCyberdeckPaneKind(kind);
  if (!normalized) return;
  void PANE_IMPORTS[normalized]();
}

/** Panes worth pre-warming when the deck shell mounts. */
export const PREFETCH_PANE_KINDS: readonly CyberdeckPaneKind[] = [
  "glyph-channel",
  "operator",
  "rola-dex",
];
