import {
  parseGlyphResponseActions,
  type GlyphApplyAction,
} from "@/lib/muthur-glyph-intent";
import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
import {
  defaultGlyphChannelMerge,
  dispatchGlyphPaneMode,
  getGlyphChannelText,
  mergeGlyphChannelContent,
  readGlyphPaneSettings,
  renderGlyphOutput,
  setGlyphChannelContent,
  writeGlyphPaneSettings,
  type GlyphRenderEngine,
} from "@/lib/glyph-channel";

export const GLYPH_CHANNEL_FOCUS_EVENT = "echo-mirage-glyph-channel-focus";

export function dispatchGlyphChannelFocus(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GLYPH_CHANNEL_FOCUS_EVENT));
}

async function renderAsciiSkillToChannel(request: AsciiRenderRequest): Promise<string> {
  const res = await fetch("/api/ascii/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
  if (!payload.ok || typeof payload.output !== "string") {
    throw new Error(payload.error || "ascii.render failed");
  }
  const existing = await getGlyphChannelText();
  const merged = mergeGlyphChannelContent(existing, payload.output, request.merge ?? "append");
  await setGlyphChannelContent(merged, { scrollToBottom: request.merge !== "replace" });
  return merged;
}

async function renderGlyphToChannel(options: {
  engine: GlyphRenderEngine;
  text: string;
  font?: string;
  merge?: "append" | "replace";
  decorate?: boolean;
}): Promise<string> {
  const paneSettings = readGlyphPaneSettings();
  const font = options.font?.trim();
  if (font && options.engine === "figlet") {
    writeGlyphPaneSettings({ ...paneSettings, figletFont: font });
  }

  const existing = await getGlyphChannelText();
  const mergeMode =
    options.merge ?? defaultGlyphChannelMerge(Boolean(existing.trim()));
  const output = await renderGlyphOutput({
    engine: options.engine,
    text: options.text,
    font: options.font,
    decorate: options.decorate,
  });
  const merged = mergeGlyphChannelContent(existing, output, mergeMode);
  await setGlyphChannelContent(merged, { scrollToBottom: mergeMode === "append" });
  return merged;
}

async function setRawGlyphChannelText(
  raw: string,
  merge: "append" | "replace" = "replace",
): Promise<string> {
  const existing = await getGlyphChannelText();
  const merged = mergeGlyphChannelContent(existing, raw, merge);
  await setGlyphChannelContent(merged, { scrollToBottom: merge === "append" });
  return merged;
}

/** Apply parsed glyph directives to the live ⟁ Glyph Channel (switches pane to edit mode). */
export async function applyGlyphActions(actions: GlyphApplyAction[]): Promise<void> {
  if (actions.length === 0) return;

  dispatchGlyphPaneMode("edit");
  dispatchGlyphChannelFocus();

  for (const action of actions) {
    if (action.kind === "set") {
      await setRawGlyphChannelText(action.text, action.merge ?? "replace");
      continue;
    }
    if (action.kind === "ascii-skill") {
      await renderAsciiSkillToChannel(action.request);
      continue;
    }
    await renderGlyphToChannel({
      engine: action.engine,
      text: action.text,
      font: action.font,
      merge: action.merge,
      decorate: action.decorate,
    });
  }
}

export async function applyGlyphResponseFromAgent(responseText: string): Promise<{
  applied: boolean;
  displayText: string;
}> {
  const { actions, displayText } = parseGlyphResponseActions(responseText);
  if (actions.length > 0) {
    await applyGlyphActions(actions);
  }
  return { applied: actions.length > 0, displayText };
}
