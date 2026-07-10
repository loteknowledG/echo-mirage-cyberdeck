"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { playDeckSystemSound } from "@/features/cyberdeck/runtime/defer-deck-audio";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { CustomTab, ServerRailButton } from "@/features/cyberdeck/workspace/custom-tab-model";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { applyGlyphActions, GLYPH_CHANNEL_FOCUS_EVENT } from "@/lib/glyph-channel-apply.client";
import {
  dispatchGlyphPaneMode,
  getGlyphChannelText,
  GLYPH_MODE_UPDATE_EVENT,
  mergeGlyphChannelContent,
  readGlyphModeActive,
  readGlyphPaneSettings,
  renderGlyphOutput,
  setGlyphChannelContent,
  writeGlyphModeActive,
  writeGlyphPaneSettings,
  type GlyphRenderEngine,
} from "@/lib/glyph-channel";
import type { GlyphCommand } from "@/lib/muthur-glyph-intent";
import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";

export type UseCyberdeckGlyphChannelOptions = {
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
};

export function useCyberdeckGlyphChannel({
  setNavRailContext,
  setMessages,
}: UseCyberdeckGlyphChannelOptions) {
  const [glyphModeActive, setGlyphModeActive] = useState(false);

  const syncGlyphChannelTabGlyphs = useCallback(() => {
    useCyberdeckTabStore.getState().setCustomTabs((prev) =>
      prev.map((tab) =>
        tab.kind === "glyph-channel" ? { ...tab, glyph: "⟁", label: "⟁ GLYPH" } : tab,
      ),
    );
  }, []);

  const focusGlyphChannelTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((tab) => tab.kind === "glyph-channel");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      syncGlyphChannelTabGlyphs();
    } else {
      const id = `tab-${crypto.randomUUID()}`;
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [
        ...prev,
        { id, label: "⟁ GLYPH", glyph: "⟁", kind: "glyph-channel" },
      ]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    }
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, [setNavRailContext, syncGlyphChannelTabGlyphs]);

  const railGlyphForServer = useCallback(
    (btn: ServerRailButton) => {
      if (glyphModeActive && btn.id === "s") return "⟁";
      return btn.glyph;
    },
    [glyphModeActive],
  );

  const railGlyphForCustomTab = useCallback((tab: CustomTab) => {
    if (tab.kind === "glyph-channel") return "⟁";
    return tab.glyph;
  }, []);

  const renderGlyphToChannel = useCallback(
    async (options: {
      engine: GlyphRenderEngine;
      text: string;
      font?: string;
      merge?: "append" | "replace";
      decorate?: boolean;
    }) => {
      const { engine, text, font, merge, decorate } = options;
      const paneSettings = readGlyphPaneSettings();
      const figletFont = font?.trim() || paneSettings.figletFont;
      const usesFigletFont = engine === "figlet";
      if (usesFigletFont && font?.trim()) {
        writeGlyphPaneSettings({ ...paneSettings, figletFont: font.trim() });
      }

      const existing = await getGlyphChannelText();
      const output = await renderGlyphOutput({
        engine,
        text,
        font: usesFigletFont ? figletFont : undefined,
        decorate,
      });
      const mergeMode = merge ?? (existing.trim() ? "append" : "replace");
      const merged = mergeGlyphChannelContent(existing, output, mergeMode);
      await setGlyphChannelContent(merged, {
        scrollToBottom: mergeMode === "append",
      });
      focusGlyphChannelTab();
      return merged;
    },
    [focusGlyphChannelTab],
  );

  const setRawGlyphChannelText = useCallback(
    async (raw: string, merge: "append" | "replace" = "replace") => {
      const existing = await getGlyphChannelText();
      const merged = mergeGlyphChannelContent(existing, raw, merge);
      await setGlyphChannelContent(merged, { scrollToBottom: merge === "append" });
      focusGlyphChannelTab();
      return merged;
    },
    [focusGlyphChannelTab],
  );

  const renderAsciiSkillToChannel = useCallback(
    async (request: AsciiRenderRequest) => {
      const res = await fetch("/api/ascii/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
      if (!payload.ok || typeof payload.output !== "string") {
        throw new Error(payload.error || "ascii.render failed");
      }
      await setRawGlyphChannelText(payload.output, request.merge ?? "append");
      return payload.output;
    },
    [setRawGlyphChannelText],
  );

  const applyGlyphActionsFromMuthur = useCallback(
    async (actions: Parameters<typeof applyGlyphActions>[0]) => {
      await applyGlyphActions(actions);
    },
    [],
  );

  useEffect(() => {
    const handler = () => {
      focusGlyphChannelTab();
    };
    window.addEventListener(GLYPH_CHANNEL_FOCUS_EVENT, handler);
    return () => window.removeEventListener(GLYPH_CHANNEL_FOCUS_EVENT, handler);
  }, [focusGlyphChannelTab]);

  const handleGlyphOperatorCommand = useCallback(
    async (command: GlyphCommand) => {
      switch (command.kind) {
        case "mode-on":
          setGlyphModeActive(true);
          writeGlyphModeActive(true);
          syncGlyphChannelTabGlyphs();
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "⟁ Glyph mode active. Compose in chat or the ⟁ tab — ask MUTHUR to suggest fonts or render figlet/ascii.",
            },
          ]);
          return;
        case "mode-off":
          setGlyphModeActive(false);
          writeGlyphModeActive(false);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "⟁ Glyph mode off. Chat input resumes normal routing.",
            },
          ]);
          return;
        case "clear":
          await setGlyphChannelContent("");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel cleared." },
          ]);
          return;
        case "copy": {
          const text = await getGlyphChannelText();
          await copyTextToClipboard(text);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel copied to clipboard." },
          ]);
          return;
        }
        case "edit-on":
          dispatchGlyphPaneMode("edit");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel edit mode on." },
          ]);
          return;
        case "edit-off":
          dispatchGlyphPaneMode("view");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel view mode." },
          ]);
          return;
        case "set":
          await setRawGlyphChannelText(command.text, command.merge ?? "replace");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Pasted art to Glyph Channel." },
          ]);
          return;
        case "render":
          await renderGlyphToChannel({
            engine: command.engine,
            text: command.text,
            font: command.font,
            merge: command.merge,
            decorate: command.decorate,
          });
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `⟁ Rendered to Glyph Channel (${command.engine}${command.font ? ` // ${command.font}` : ""}).`,
            },
          ]);
          return;
        case "ascii-skill":
          await renderAsciiSkillToChannel(command.request);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `⟁ ASCII skill rendered (${command.request.template} // ${command.request.style ?? "echo_mirage"}).`,
            },
          ]);
          return;
        default: {
          const _exhaustive: never = command;
          return _exhaustive;
        }
      }
    },
    [
      focusGlyphChannelTab,
      renderAsciiSkillToChannel,
      renderGlyphToChannel,
      setMessages,
      setRawGlyphChannelText,
      syncGlyphChannelTabGlyphs,
    ],
  );

  useEffect(() => {
    const active = readGlyphModeActive();
    setGlyphModeActive(active);
    if (active) syncGlyphChannelTabGlyphs();
  }, [syncGlyphChannelTabGlyphs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      if (typeof active === "boolean") {
        setGlyphModeActive(active);
        if (active) syncGlyphChannelTabGlyphs();
      }
    };
    window.addEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
    return () => window.removeEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
  }, [syncGlyphChannelTabGlyphs]);

  return {
    glyphModeActive,
    handleGlyphOperatorCommand,
    applyGlyphActionsFromMuthur,
    railGlyphForServer,
    railGlyphForCustomTab,
  };
}
