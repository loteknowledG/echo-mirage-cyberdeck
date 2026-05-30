import { cn } from "@/lib/utils";
import type { DeckMode } from "@/lib/deck-mode";

/** Base class — square face + hard-offset shadow wall under [data-deck-mode="realmorphism"]. */
export const REALMORPHISM_CONTROL = "realmorphism-control";

export type RealmorphismControlOptions = {
  /** Icon square (default) or compact text button. */
  size?: "icon" | "compact" | "send" | "toolbar" | "action" | "menu" | "micro" | "wide" | "tile" | "filter";
  signal?: boolean;
  amber?: boolean;
  critical?: boolean;
  danger?: boolean;
  off?: boolean;
  /** Flat list-row style (context menus). */
  menu?: boolean;
  /** Tailwind classes used when deck mode is wireframe override (`ascii`). */
  legacyClassName?: string;
};

export function realmorphismControlClass(
  deckMode: DeckMode,
  {
    size = "icon",
    signal,
    amber,
    critical,
    danger,
    off,
    menu,
    legacyClassName,
  }: RealmorphismControlOptions = {},
): string {
  return cn(
    REALMORPHISM_CONTROL,
    "inline-flex items-center justify-center font-mono shrink-0 border border-transparent transition disabled:cursor-not-allowed",
    size === "compact" && "h-8 min-w-[1.75rem] px-1 text-[11px]",
    size === "icon" && "h-8 w-8 text-[10px]",
    size === "toolbar" && "h-7 w-7 text-[10px]",
    size === "send" && "h-9 w-9 text-[10px]",
    size === "action" && "px-2 py-1 text-[9px] tracking-[0.08em]",
    size === "micro" && "h-5 w-5 text-[9px] tracking-[0.08em]",
    size === "wide" && "flex-1 px-3 py-2 text-[9px] tracking-[0.08em]",
    size === "filter" && "rounded-sm px-2 py-1 text-[9px] tracking-[0.08em]",
    size === "tile" && "w-full justify-start px-2 py-2 text-left text-[9px] tracking-[0.06em]",
    size === "menu" && "w-full justify-start px-3 py-2 text-left text-[10px] tracking-[0.08em]",
    menu && "is-menu",
    signal && "is-signal",
    amber && "is-amber",
    critical && "is-critical",
    danger && "is-danger",
    off && "is-off",
    deckMode === "ascii" && legacyClassName,
  );
}

export type RealmorphismActionVariant = "neutral" | "accent" | "danger";

export function realmorphismActionClass(
  deckMode: DeckMode,
  variant: RealmorphismActionVariant = "neutral",
  options: Omit<RealmorphismControlOptions, "legacyClassName" | "signal" | "amber" | "danger"> = {},
): string {
  const legacy =
    variant === "accent"
      ? LEGACY_ACTION_ACCENT
      : variant === "danger"
        ? LEGACY_ACTION_DANGER
        : LEGACY_ACTION_NEUTRAL;

  return realmorphismControlClass(deckMode, {
    size: "action",
    ...options,
    signal: variant === "accent",
    danger: variant === "danger",
    legacyClassName: legacy,
  });
}

export function realmorphismMenuItemClass(deckMode: DeckMode, danger = false): string {
  return realmorphismControlClass(deckMode, {
    size: "menu",
    menu: true,
    danger,
    legacyClassName: danger ? LEGACY_MENU_ITEM_DANGER : LEGACY_MENU_ITEM,
  });
}

export function realmorphismFilterClass(
  deckMode: DeckMode,
  active: boolean,
  tone: "signal" | "amber" = "signal",
): string {
  const legacyActive =
    tone === "amber" ? LEGACY_FILTER_ACTIVE_AMBER : LEGACY_FILTER_ACTIVE_SIGNAL;
  const legacyInactive = LEGACY_FILTER_INACTIVE;

  return realmorphismControlClass(deckMode, {
    size: "filter",
    signal: active && tone === "signal",
    amber: active && tone === "amber",
    legacyClassName: active ? legacyActive : legacyInactive,
  });
}

export function voiceControlClass(
  deckMode: DeckMode,
  voiceEnabled: boolean,
  voiceHealth: "idle" | "backend" | "fallback" | "off",
): string {
  const legacy =
    !voiceEnabled || voiceHealth === "off"
      ? LEGACY_VOICE_CONTROL.off
      : voiceHealth === "backend"
        ? LEGACY_VOICE_CONTROL.backend
        : voiceHealth === "fallback"
          ? LEGACY_VOICE_CONTROL.fallback
          : LEGACY_VOICE_CONTROL.idle;

  return realmorphismControlClass(deckMode, {
    size: "icon",
    legacyClassName: legacy,
    signal: voiceEnabled && voiceHealth !== "fallback" && voiceHealth !== "off",
    amber: voiceEnabled && voiceHealth === "fallback",
    off: !voiceEnabled || voiceHealth === "off",
  });
}

export const LEGACY_VOICE_CONTROL = {
  off: "rounded-[6px] border border-gray-700 bg-black text-gray-400 transition hover:border-gray-500 hover:-translate-y-px active:translate-y-px active:scale-[0.98]",
  backend:
    "rounded-[6px] border border-emerald-500/90 bg-emerald-500/10 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.30)_inset,0_0_14px_rgba(16,185,129,0.22),0_3px_10px_rgba(0,0,0,0.5)] transition hover:-translate-y-px active:translate-y-px active:scale-[0.98]",
  fallback:
    "rounded-[6px] border border-amber-500/80 bg-amber-500/10 text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.20)_inset,0_0_12px_rgba(245,158,11,0.12),0_3px_10px_rgba(0,0,0,0.5)] transition hover:-translate-y-px active:translate-y-px active:scale-[0.98]",
  idle: "rounded-[6px] border border-emerald-700/80 bg-black text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.16)_inset,0_3px_10px_rgba(0,0,0,0.5)] transition hover:-translate-y-px hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200 active:translate-y-px active:scale-[0.98]",
} as const;

export const LEGACY_COMPACT_CONTROL =
  "rounded-[6px] border border-gray-700 bg-black text-gray-400 transition hover:border-emerald-600/80 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-35";

export const LEGACY_COMPACT_AMBER =
  "rounded-[6px] border border-gray-700 bg-black text-gray-400 transition hover:border-amber-600/80 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-35";

export const LEGACY_SEND_CONTROL =
  "rounded-[6px] border border-emerald-700/80 bg-black text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.16)_inset,0_3px_10px_rgba(0,0,0,0.5)] transition hover:-translate-y-px hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200 active:translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export const LEGACY_STOP_CONTROL =
  "rounded border border-red-700 px-2 py-1 text-[10px] font-mono text-red-300 transition hover:border-red-500 hover:text-red-200";

export const LEGACY_ACTION_NEUTRAL =
  "rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:opacity-35";

export const LEGACY_ACTION_ACCENT =
  "rounded border border-emerald-700/70 bg-black text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-35";

export const LEGACY_ACTION_DANGER =
  "rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200 disabled:opacity-35";

export const LEGACY_MENU_ITEM =
  "flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200";

export const LEGACY_MENU_ITEM_DANGER =
  "flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#ff8f8f] transition hover:bg-[#171717] hover:text-red-200";

export const LEGACY_TOOLBAR_ICON =
  "inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:opacity-30";

export const LEGACY_FILTER_ACTIVE_SIGNAL =
  "rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition border-emerald-500/60 text-emerald-200";

export const LEGACY_FILTER_ACTIVE_AMBER =
  "rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition border-amber-500/60 text-amber-200";

export const LEGACY_FILTER_INACTIVE =
  "rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition border-[#2d2d2d] text-[#9a9a9a] hover:border-emerald-500/50 hover:text-emerald-100";

export const LEGACY_TILE_NEUTRAL =
  "mb-1 block w-full border px-2 py-2 text-left text-[9px] tracking-[0.06em] transition border-[#252525] text-[#b8b8b8] hover:border-amber-500/35 hover:text-amber-200";

export const LEGACY_TILE_SELECTED =
  "mb-1 block w-full border px-2 py-2 text-left text-[9px] tracking-[0.06em] transition border-emerald-500/55 bg-emerald-950/25 text-emerald-200";

export const LEGACY_OPERATOR_CARD =
  "text-left rounded-sm border bg-black/80 p-3 font-mono text-[10px] transition hover:border-emerald-500/60 focus:outline-none focus-visible:border-emerald-500/70";

export const LEGACY_SWITCH_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";
