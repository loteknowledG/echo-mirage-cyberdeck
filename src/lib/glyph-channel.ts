import { get, set } from "idb-keyval";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";

export const GLYPH_CHANNEL_STORAGE_KEY = "echo-mirage-glyph-channel";
export const GLYPH_MODE_STORAGE_KEY = "echo-mirage-glyph-mode";
export const GLYPH_SETTINGS_STORAGE_KEY = "echo-mirage-glyph-settings";
export const GLYPH_CHANNEL_UPDATE_EVENT = "echo-mirage-glyph-channel-update";
export const GLYPH_MODE_UPDATE_EVENT = "echo-mirage-glyph-mode-update";

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

export async function renderGlyphOutput(options: {
  engine: GlyphPaneEngine;
  text: string;
  font?: string;
}): Promise<string> {
  const res = await fetch("/api/glyph/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      engine: options.engine,
      text: options.text,
      font: options.font,
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

export async function setGlyphChannelContent(raw: string): Promise<string> {
  const text = normalizeGlyphChannelText(raw);
  await set(GLYPH_CHANNEL_STORAGE_KEY, text);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GLYPH_CHANNEL_UPDATE_EVENT, { detail: { text } }),
    );
  }
  return text;
}

export function subscribeGlyphChannelContent(
  listener: (text: string) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ text?: string }>).detail;
    if (typeof detail?.text === "string") listener(detail.text);
  };

  window.addEventListener(GLYPH_CHANNEL_UPDATE_EVENT, handler);
  return () => window.removeEventListener(GLYPH_CHANNEL_UPDATE_EVENT, handler);
}
