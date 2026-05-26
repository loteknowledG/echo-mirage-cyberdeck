import { get, set } from "idb-keyval";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";

export const GLYPH_CHANNEL_STORAGE_KEY = "echo-mirage-glyph-channel";
export const GLYPH_MODE_STORAGE_KEY = "echo-mirage-glyph-mode";
export const GLYPH_SETTINGS_STORAGE_KEY = "echo-mirage-glyph-settings";
export const GLYPH_CHANNEL_UPDATE_EVENT = "echo-mirage-glyph-channel-update";
export const GLYPH_MODE_UPDATE_EVENT = "echo-mirage-glyph-mode-update";
export const GLYPH_PANE_MODE_UPDATE_EVENT = "echo-mirage-glyph-pane-mode-update";

export type GlyphPaneViewMode = "view" | "edit";
export type GlyphMergeMode = "append" | "replace";

export type GlyphPaneEngine = "ascii" | "figlet";

export type GlyphPaneSettings = {
  engine: GlyphPaneEngine;
  figletFont: string;
  zoomPercent: number;
};

const DEFAULT_GLYPH_SETTINGS: GlyphPaneSettings = {
  engine: "figlet",
  figletFont: DEFAULT_FIGLET_FONT,
  zoomPercent: 100,
};

export const GLYPH_CHANNEL_DEFAULT_TEXT = `╔════════════════════════════════════╗
║        E C H O   M I R A G E       ║
║        MACHINE GLYPH CHANNEL       ║
╚════════════════════════════════════╝

⟁ SIGNAL ACQUIRED
⟁ OPERATOR LINKED
⟁ MUTHUR ONLINE
`;

export function normalizeGlyphChannelText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Join new figlet/ascii output below existing channel text (blank line between blocks). */
export function mergeGlyphChannelContent(
  existing: string,
  incoming: string,
  merge: GlyphMergeMode,
): string {
  if (merge === "replace") return normalizeGlyphChannelText(incoming);
  return appendGlyphChannelText(existing, incoming);
}

export function appendGlyphChannelText(existing: string, addition: string): string {
  const base = normalizeGlyphChannelText(existing).trimEnd();
  const next = normalizeGlyphChannelText(addition).trim();
  if (!base) return next;
  if (!next) return base;
  return `${base}\n\n${next}`;
}

/** Insert rendered output at a cursor range in the channel text. */
export function insertGlyphChannelTextAt(
  existing: string,
  start: number,
  end: number,
  addition: string,
): string {
  const base = normalizeGlyphChannelText(existing);
  const insert = normalizeGlyphChannelText(addition);
  const safeStart = Math.max(0, Math.min(start, base.length));
  const safeEnd = Math.max(safeStart, Math.min(end, base.length));
  return `${base.slice(0, safeStart)}${insert}${base.slice(safeEnd)}`;
}

export function readGlyphModeActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GLYPH_MODE_STORAGE_KEY) === "1";
}

export function writeGlyphModeActive(active: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GLYPH_MODE_STORAGE_KEY, active ? "1" : "0");
  window.dispatchEvent(new CustomEvent(GLYPH_MODE_UPDATE_EVENT, { detail: { active } }));
}

export function readGlyphPaneSettings(): GlyphPaneSettings {
  if (typeof window === "undefined") return DEFAULT_GLYPH_SETTINGS;
  try {
    const raw = window.localStorage.getItem(GLYPH_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GLYPH_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GlyphPaneSettings>;
    const figletFont =
      typeof parsed.figletFont === "string" && parsed.figletFont.trim()
        ? parsed.figletFont.trim()
        : DEFAULT_GLYPH_SETTINGS.figletFont;
    const engineRaw = parsed.engine;
    const engine =
      engineRaw === "ascii" || engineRaw === "figlet"
        ? engineRaw
        : engineRaw === "glyph" || engineRaw === "toilet"
          ? engineRaw === "glyph"
            ? "ascii"
            : "figlet"
          : DEFAULT_GLYPH_SETTINGS.engine;
    const zoomPercent =
      typeof parsed.zoomPercent === "number" && parsed.zoomPercent >= 50 && parsed.zoomPercent <= 200
        ? Math.round(parsed.zoomPercent)
        : DEFAULT_GLYPH_SETTINGS.zoomPercent;
    return { engine, figletFont, zoomPercent };
  } catch {
    return DEFAULT_GLYPH_SETTINGS;
  }
}

export function writeGlyphPaneSettings(settings: GlyphPaneSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GLYPH_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function dispatchGlyphPaneMode(mode: GlyphPaneViewMode): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GLYPH_PANE_MODE_UPDATE_EVENT, { detail: { mode } }));
}

export async function buildGlyphContextSnapshot(): Promise<string> {
  const text = await getGlyphChannelText();
  const settings = readGlyphPaneSettings();
  const mode = readGlyphModeActive();
  const preview =
    text.length > 4000 ? `${text.slice(0, 4000)}\n…(${text.length - 4000} more chars)` : text;
  return [
    `Engine: ${settings.engine}`,
    `Figlet font: ${settings.figletFont}`,
    `Glyph mode: ${mode ? "on" : "off"}`,
    `Channel length: ${text.length} chars`,
    "Current content:",
    preview.trim() || "(empty)",
  ].join("\n");
}

export async function renderGlyphOutput(options: {
  engine: GlyphPaneEngine;
  text: string;
  font?: string;
  decorate?: boolean;
}): Promise<string> {
  const res = await fetch("/api/glyph/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      engine: options.engine,
      text: options.text,
      font: options.font,
      decorate: options.decorate,
    }),
  });
  const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
  if (!payload.ok || typeof payload.output !== "string") {
    throw new Error(payload.error || "Glyph render failed");
  }
  return payload.output;
}

export async function getGlyphChannelText(): Promise<string> {
  try {
    const saved = await get<string>(GLYPH_CHANNEL_STORAGE_KEY);
    if (typeof saved === "string") return normalizeGlyphChannelText(saved);
  } catch {
    /* ignore */
  }
  return GLYPH_CHANNEL_DEFAULT_TEXT;
}

export type GlyphChannelUpdateOptions = {
  scrollToBottom?: boolean;
};

export async function setGlyphChannelContent(
  raw: string,
  options?: GlyphChannelUpdateOptions,
): Promise<string> {
  const text = normalizeGlyphChannelText(raw);
  await set(GLYPH_CHANNEL_STORAGE_KEY, text);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GLYPH_CHANNEL_UPDATE_EVENT, {
        detail: { text, scrollToBottom: options?.scrollToBottom ?? false },
      }),
    );
  }
  return text;
}

export function subscribeGlyphChannelContent(
  listener: (text: string, options?: GlyphChannelUpdateOptions) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ text?: string; scrollToBottom?: boolean }>).detail;
    if (typeof detail?.text === "string") {
      listener(detail.text, { scrollToBottom: detail.scrollToBottom });
    }
  };

  window.addEventListener(GLYPH_CHANNEL_UPDATE_EVENT, handler);
  return () => window.removeEventListener(GLYPH_CHANNEL_UPDATE_EVENT, handler);
}
