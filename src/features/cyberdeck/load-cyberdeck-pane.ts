import type { ComponentType } from "react";
import { normalizeCyberdeckPaneKind, type CyberdeckPaneKind } from "@/features/cyberdeck/pane-registry";

export type CyberdeckPaneModule = {
  default: ComponentType<any>;
};

/** Resolve a pane chunk only when activated — each branch is an isolated async boundary. */
export function loadCyberdeckPane(kind: string): Promise<CyberdeckPaneModule> {
  const normalized = normalizeCyberdeckPaneKind(kind);
  if (!normalized) {
    return Promise.reject(new Error(`Unknown cyberdeck pane kind: ${kind}`));
  }

  return loadPaneByKind(normalized);
}

function loadPaneByKind(kind: CyberdeckPaneKind): Promise<CyberdeckPaneModule> {
  switch (kind) {
    case "operator":
      return import("@/features/cyberdeck/pane-loaders/operator");
    case "settings":
      return import("@/features/cyberdeck/pane-loaders/settings");
    case "document":
      return import("@/features/cyberdeck/pane-loaders/document");
    case "diagnostics":
      return import("@/features/cyberdeck/pane-loaders/diagnostics");
    case "pi":
      return import("@/features/cyberdeck/pane-loaders/pi-chat");
    case "catalog":
      return import("@/features/cyberdeck/pane-loaders/catalog");
    case "operators":
      return import("@/features/cyberdeck/pane-loaders/operators");
    case "memory-atlas":
      return import("@/features/cyberdeck/pane-loaders/memory-atlas");
    case "voice-lab":
      return import("@/features/cyberdeck/pane-loaders/voice-lab");
    case "flight-log":
      return import("@/features/cyberdeck/pane-loaders/flight-log");
    case "drop-bay":
      return import("@/features/cyberdeck/pane-loaders/drop-bay");
    case "glyph-channel":
      return import("@/features/cyberdeck/pane-loaders/glyph-channel");
    case "rola-dex":
      return import("@/features/cyberdeck/pane-loaders/rola-dex");
    case "sound-profile":
      return import("@/features/cyberdeck/pane-loaders/sound-profile");
    default: {
      const _exhaustive: never = kind;
      return Promise.reject(new Error(`Unhandled pane kind: ${_exhaustive}`));
    }
  }
}
