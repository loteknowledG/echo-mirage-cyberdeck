"use client";

/** Runtime boot profile — controls which subsystems may mount at startup. */
export type DeckBootMode = "minimal" | "standard" | "full";

export const DECK_BOOT_MODE_STORAGE_KEY = "echo-mirage-deck-boot-mode-v1";

const VALID_MODES: DeckBootMode[] = ["minimal", "standard", "full"];

export function normalizeDeckBootMode(value: unknown): DeckBootMode {
  if (typeof value === "string" && VALID_MODES.includes(value as DeckBootMode)) {
    return value as DeckBootMode;
  }
  return "standard";
}

export function loadDeckBootMode(): DeckBootMode {
  if (typeof window === "undefined") return "standard";
  try {
    return normalizeDeckBootMode(window.localStorage.getItem(DECK_BOOT_MODE_STORAGE_KEY));
  } catch {
    return "standard";
  }
}

export function saveDeckBootMode(mode: DeckBootMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DECK_BOOT_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage write failures
  }
}

/** Subsystems allowed to auto-mount on first paint for each boot profile. */
export function isSubsystemEnabledAtBoot(
  mode: DeckBootMode,
  subsystem:
    | "muthur"
    | "operator"
    | "settings"
    | "card-table"
    | "voice-lab"
    | "glyph-channel"
    | "atlas"
    | "pi-chat"
    | "catalog"
    | "operators"
    | "flight-log"
    | "rola-dex",
): boolean {
  if (mode === "full") return true;
  if (mode === "minimal") {
    return subsystem === "muthur" || subsystem === "operator" || subsystem === "settings";
  }
  return (
    subsystem === "muthur" ||
    subsystem === "operator" ||
    subsystem === "settings" ||
    subsystem === "glyph-channel" ||
    subsystem === "flight-log"
  );
}
