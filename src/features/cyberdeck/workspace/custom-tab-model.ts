import type { OperatorAssetSurface } from "@/lib/operator-file-surface";

export const CUSTOM_TAB_KINDS = [
  "blank",
  "document",
  "web",
  "settings",
  "connection",
  "pi",
  "diagnostics",
  "memory-atlas",
  "flight-log",
  "drop-bay",
  "glyph-channel",
  "rola-dex",
  "realmorphism-kit",
  "call-center",
  "photoshop",
  "db8",
  "survey",
  "career",
] as const;

export type CustomTabKind = (typeof CUSTOM_TAB_KINDS)[number];

/** Tab-stored operator asset; full drop shape moves to operator-drop-utils (P1.3). */
export type CustomTabStoredAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
  pdfSrc?: string;
  docxSrc?: string;
  localFilePath?: string;
  surface?: OperatorAssetSurface;
};

export type CustomTab = {
  id: string;
  label: string;
  glyph: string;
  kind: CustomTabKind;
  browserUrl?: string;
  asset?: CustomTabStoredAsset | null;
};

export type CustomTabContextMenuAction =
  | { label: string; kind: CustomTabKind; action: "convert" }
  | { label: string; action: "settings-pane" | "kit-pane" };

export const CUSTOM_TAB_CONTEXT_MENU_ACTIONS = ([
  { label: "Document", kind: "document", action: "convert" },
  { label: "Web", kind: "web", action: "convert" },
  { label: "Memory Atlas", kind: "memory-atlas", action: "convert" },
  { label: "Flight Log", kind: "flight-log", action: "convert" },
  { label: "Call Center", kind: "call-center", action: "convert" },
  { label: "Photoshop", kind: "photoshop", action: "convert" },
  { label: "Drop Bay", kind: "drop-bay", action: "convert" },
  { label: "Ascii", kind: "glyph-channel", action: "convert" },
  { label: "Kit", action: "kit-pane" },
  { label: "Survey", kind: "survey", action: "convert" },
  { label: "Career", kind: "career", action: "convert" },
  { label: "Powerfist", kind: "rola-dex", action: "convert" },
  { label: "Diagnostics", kind: "diagnostics", action: "convert" },
  { label: "Pi", kind: "pi", action: "convert" },
  { label: "DB8", kind: "db8", action: "convert" },
  { label: "Settings", action: "settings-pane" },
] as CustomTabContextMenuAction[]).sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
);

export function isCustomTabKind(kind: unknown): kind is CustomTabKind {
  return typeof kind === "string" && normalizeCustomTabKind(kind) !== null;
}

/** Blank tabs can still pick a surface; assigned tabs are type-locked. */
export function isUnassignedCustomTab(tab: { kind: string } | null | undefined): boolean {
  return Boolean(tab && tab.kind === "blank");
}

export function migrateLegacyTestPaneKind(kind: string): string {
  if (kind === "test-pane" || kind === "test_pane" || kind === "test") {
    return "rola-dex";
  }
  if (
    kind === "install" ||
    kind === "install-desktop" ||
    kind === "install_desktop" ||
    kind === "desktop-install"
  ) {
    return "survey";
  }
  return kind;
}

/** Retired P2 demo panes — remap saved tab kinds on load. */
export function migrateRetiredDemoPaneKind(kind: string): string {
  if (kind === "catalog" || kind === "catelog") {
    return "realmorphism-kit";
  }
  if (kind === "voice-lab" || kind === "voicelab" || kind === "voice_lab") {
    return "settings";
  }
  if (kind === "operators") {
    return "blank";
  }
  if (
    kind === "tunes" ||
    kind === "music" ||
    kind === "dj" ||
    kind === "sound-profile" ||
    kind === "sound_profile" ||
    kind === "soundprofile"
  ) {
    return "blank";
  }
  if (kind === "cadre" || kind === "terminal-host" || kind === "terminal_host") {
    return "blank";
  }
  return kind;
}

export function sanitizeCustomTabs(value: unknown): CustomTab[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tab = item as Partial<CustomTab>;
    const id = typeof tab.id === "string" && tab.id.trim() ? tab.id.trim() : "";
    const kindRaw = typeof tab.kind === "string" ? tab.kind : "blank";
    const migratedKind = migrateRetiredDemoPaneKind(migrateLegacyTestPaneKind(kindRaw));
    const kind = isCustomTabKind(migratedKind) ? migratedKind : "blank";
    const rawLabel = typeof tab.label === "string" && tab.label.trim() ? tab.label.trim() : "TAB";
    let label = kindRaw !== migratedKind && migratedKind === "survey" ? "Survey" : rawLabel;
    if (
      kindRaw !== migratedKind &&
      migratedKind === "realmorphism-kit" &&
      (kindRaw === "catalog" || kindRaw === "catelog")
    ) {
      label = "Registry";
    }
    if (kindRaw !== migratedKind && migratedKind === "settings" && kindRaw.includes("voice")) {
      label = "Settings";
    }
    const rawGlyph = typeof tab.glyph === "string" && tab.glyph.trim() ? tab.glyph.trim() : "□";
    const glyph =
      kind === "rola-dex"
        ? defaultCustomTabGlyphForKind("rola-dex")
        : kind === "survey"
          ? defaultCustomTabGlyphForKind("survey")
          : rawGlyph;
    const browserUrl =
      typeof tab.browserUrl === "string" && tab.browserUrl.trim() ? tab.browserUrl.trim() : undefined;
    const asset =
      tab.asset && typeof tab.asset === "object" ? (tab.asset as CustomTabStoredAsset) : null;

    if (!id) return [];
    return [
      {
        id,
        label,
        glyph,
        kind,
        browserUrl,
        asset,
      },
    ];
  });
}

export function normalizeCustomTabGlyph(label: string, glyph?: string) {
  const trimmedGlyph = (glyph || "").trim();
  if (trimmedGlyph) return trimmedGlyph.slice(0, 2);
  const trimmedLabel = label.trim();
  return trimmedLabel ? trimmedLabel[0].toUpperCase() : "□";
}

export function normalizeCustomTabKind(kind: string) {
  const nextKind = migrateRetiredDemoPaneKind(migrateLegacyTestPaneKind(kind.trim().toLowerCase()));
  if (nextKind === "diagnostic") {
    return "diagnostics" as CustomTabKind;
  }
  if (
    nextKind === "muthur-execution" ||
    nextKind === "muthur_execution" ||
    nextKind === "execution" ||
    nextKind === "execution-pane"
  ) {
    return "diagnostics" as CustomTabKind;
  }
  if (nextKind === "memoryatlas" || nextKind === "memory_atlas") {
    return "memory-atlas" as CustomTabKind;
  }
  if (nextKind === "flightlog" || nextKind === "flight_log") {
    return "flight-log" as CustomTabKind;
  }
  if (nextKind === "dropbay" || nextKind === "drop_bay") {
    return "drop-bay" as CustomTabKind;
  }
  if (
    nextKind === "glyph" ||
    nextKind === "glyph-channel" ||
    nextKind === "glyph_channel" ||
    nextKind === "glyphchannel"
  ) {
    return "glyph-channel" as CustomTabKind;
  }
  if (
    nextKind === "preview" ||
    nextKind === "rola-dex" ||
    nextKind === "rola_dex" ||
    nextKind === "roladex"
  ) {
    return "rola-dex" as CustomTabKind;
  }
  if (nextKind === "survey" || nextKind === "espionage") {
    return "survey" as CustomTabKind;
  }
  if (
    nextKind === "realmorphism-kit" ||
    nextKind === "realmorphism_kit" ||
    nextKind === "realmorphismkit" ||
    nextKind === "realmorphism" ||
    nextKind === "registry" ||
    nextKind === "kit"
  ) {
    return "realmorphism-kit" as CustomTabKind;
  }
  if (nextKind === "debate" || nextKind === "debate-forum" || nextKind === "debate_forum") {
    return "db8" as CustomTabKind;
  }
  if (
    nextKind === "call-center" ||
    nextKind === "call_center" ||
    nextKind === "callcenter"
  ) {
    return "call-center" as CustomTabKind;
  }
  if (nextKind === "photo-shop" || nextKind === "photo_shop") {
    return "photoshop" as CustomTabKind;
  }
  if (CUSTOM_TAB_KINDS.includes(nextKind as CustomTabKind)) {
    return nextKind as CustomTabKind;
  }
  return null;
}

export function defaultCustomTabGlyphForKind(kind: CustomTabKind) {
  if (kind === "web") return "W";
  if (kind === "document") return "D";
  if (kind === "settings") return "S";
  if (kind === "connection") return "C";
  if (kind === "memory-atlas") return "M";
  if (kind === "flight-log") return "F";
  if (kind === "drop-bay") return "⬇";
  if (kind === "glyph-channel") return "⟁";
  if (kind === "rola-dex") return "#";
  if (kind === "survey") return "◉";
  if (kind === "realmorphism-kit") return "K";
  if (kind === "call-center") return "CC";
  if (kind === "photoshop") return "Ps";
  if (kind === "db8") return "8";
  if (kind === "career") return "Cr";
  if (kind === "pi" || kind === "diagnostics") return "π";
  return "□";
}

export function defaultCustomTabLabelForKind(kind: CustomTabKind) {
  if (kind === "memory-atlas") return "MEMORY ATLAS";
  if (kind === "flight-log") return "FLIGHT LOG";
  if (kind === "drop-bay") return "DROP BAY";
  if (kind === "glyph-channel") return "⟁ GLYPH";
  if (kind === "rola-dex") return "Rola Dex";
  if (kind === "survey") return "Survey";
  if (kind === "realmorphism-kit") return "Registry";
  if (kind === "call-center") return "CALL CENTER";
  if (kind === "photoshop") return "PHOTOSHOP";
  if (kind === "db8") return "DB8";
  if (kind === "career") return "CAREER";
  return kind.toUpperCase();
}

export function parseCustomTabCommand(input: string) {
  const text = input.trim();
  if (!text) return null;

  const clearMatch = text.match(/^(?:\/tab|tab:)?\s*(?:clear|reset)(?:\s+tab)?(?:\s+state)?$/i);
  if (clearMatch) {
    return {
      kind: "clear" as const,
    };
  }

  const createMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:(?:create|make|add)(?:\s+a)?(?:\s+new)?|new)\s+tab(?:\s+(?:named|called|as|with name)\s+(.+?))?(?:\s+glyph\s+(.+))?$/i,
  );
  if (createMatch) {
    const label = (createMatch[1] || "").trim();
    const glyph = (createMatch[2] || "").trim();
    return {
      kind: "create" as const,
      label: label || "NEW TAB",
      glyph: normalizeCustomTabGlyph(label || "NEW TAB", glyph),
    };
  }

  const renameMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:rename|name|label|set)\s+tab(?:\s+(?:to|as|with name)\s+)?(.+?)(?:\s+glyph\s+(.+))?$/i,
  );
  if (renameMatch) {
    const label = (renameMatch[1] || "").trim();
    const glyph = (renameMatch[2] || "").trim();
    if (!label) return null;
    return {
      kind: "rename" as const,
      label,
      glyph: normalizeCustomTabGlyph(label, glyph),
    };
  }

  const convertMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:(?:convert|turn|make|set)(?:\s+this)?(?:\s+tab)?(?:\s+(?:to|into|as)\s+)?|(?:set|make)\s+tab\s+(?:to|as)?\s+)(blank|document|web|settings|connection|pi|db8|debate|diagnostics|diagnostic|execution|muthur-execution|memory-atlas|flight-log|drop-bay|dropbay|glyph-channel|glyph|rola-dex|preview|roladex|spy|espionage|realmorphism-kit|kit|registry|survey|career|test-pane|test|call-center|callcenter|call_center|photoshop|photo-shop|photo_shop)(?:\s+tab)?(?:\s+(?:named|called)\s+(.+?))?(?:\s+glyph\s+(.+))?$/i,
  );
  if (convertMatch) {
    const surfaceKind = normalizeCustomTabKind(convertMatch[1] || "");
    if (!surfaceKind) return null;
    const label = (convertMatch[2] || "").trim();
    const glyph = (convertMatch[3] || "").trim();
    return {
      kind: "convert" as const,
      surfaceKind,
      label: label || undefined,
      glyph: glyph || undefined,
    };
  }

  return null;
}

export {
  isFixedServerTabId,
  safeServerId,
  SERVER_IDS,
  servers,
  type ServerId,
  type ServerRailButton,
} from "./server-rail-config";
