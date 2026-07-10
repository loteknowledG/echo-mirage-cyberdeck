"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { registerCyberdeckRailTab } from "@/components/cyberdeck/cyberdeck-rail-tab";
import { CADRE_MUTHUR_ARCHIVE_EVENT } from "@/lib/cadre/cadre-event-bus";
import {
  appendMuthurDiagnosticEntry,
  type MuthurDiagnosticsState,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { notifyDeckModeChange, saveDeckMode, type DeckMode } from "@/lib/deck-mode";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";

export type UseCyberdeckAppBootstrapOptions = {
  deckMode: DeckMode;
  setMessagesRaw: Dispatch<SetStateAction<ChatMessage[]>>;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
};

export function useCyberdeckAppBootstrap({
  deckMode,
  setMessagesRaw,
  setMuthurDiagnostics,
}: UseCyberdeckAppBootstrapOptions) {
  useEffect(() => {
    registerCyberdeckRailTab();
  }, []);

  useEffect(() => {
    const onCadreArchive = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      if (!text) return;
      setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, text));
      setMessagesRaw((prev) => [...prev, { role: "assistant", text }]);
    };

    window.addEventListener(CADRE_MUTHUR_ARCHIVE_EVENT, onCadreArchive);
    return () => window.removeEventListener(CADRE_MUTHUR_ARCHIVE_EVENT, onCadreArchive);
  }, [setMessagesRaw, setMuthurDiagnostics]);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    let dispose: (() => void) | undefined;
    void import("@/lib/cyberdeck/operator-orchestrator").then(({ startOperatorOrchestrator }) => {
      dispose = startOperatorOrchestrator();
    });
    return () => {
      dispose?.();
    };
  }, []);

  useEffect(() => {
    saveDeckMode(deckMode);
    notifyDeckModeChange(deckMode);
  }, [deckMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void import("@/features/cyberdeck/pane-chunks").then((mod) => {
      for (const kind of mod.PREFETCH_PANE_KINDS) {
        mod.prefetchCyberdeckPane(kind);
      }
    });
  }, []);
}
