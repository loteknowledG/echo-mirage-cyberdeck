"use client";

import type { DragEvent as ReactDragEvent, SetStateAction } from "react";
import { useCallback } from "react";
import { OPERATOR_BROWSER_HOME_URL, normalizeOperatorBrowserUrl } from "@/lib/browser-intents";
import { buildOperatorIngestFromFile } from "@/lib/operator-file-surface";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { CustomTab } from "@/features/cyberdeck/workspace/custom-tab-model";
import type { DroppedOperatorAsset } from "@/features/cyberdeck/muthur/coding-verify-format";

export type UseCustomTabBrowserOptions = {
  updateCustomTab: (tabId: string, updater: (tab: CustomTab) => CustomTab) => void;
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
};

export function useCustomTabBrowser({
  updateCustomTab,
  setNavRailContext,
  setMessages,
}: UseCustomTabBrowserOptions) {
  const customTabBrowserNavigate = useCallback(
    (tabId: string, nextUrl: string) => {
      const normalizedUrl = normalizeOperatorBrowserUrl(nextUrl);
      updateCustomTab(tabId, (tab) => ({
        ...tab,
        kind: "web",
        browserUrl: normalizedUrl,
        asset: undefined,
      }));
    },
    [updateCustomTab],
  );

  const loadCustomTabAssetFromFile = useCallback(
    async (tabId: string, file: File) => {
      const ingested = await buildOperatorIngestFromFile(file);
      let nextAsset: DroppedOperatorAsset = {
        kind: ingested.kind,
        name: ingested.name,
        mimeType: ingested.mimeType,
        size: ingested.size,
        surface: ingested.surface,
        ...(ingested.text !== undefined ? { text: ingested.text } : {}),
        ...(ingested.imageSrc ? { imageSrc: ingested.imageSrc } : {}),
        ...(ingested.pdfSrc ? { pdfSrc: ingested.pdfSrc } : {}),
        ...(ingested.docxSrc ? { docxSrc: ingested.docxSrc } : {}),
      };
      if (ingested.surface !== "markdown" && ingested.surface !== "text") {
        const { text: _text, ...withoutText } = nextAsset;
        nextAsset = withoutText;
      }

      updateCustomTab(tabId, (tab) => ({
        ...tab,
        kind: "document",
        asset: nextAsset,
        browserUrl: undefined,
      }));
      useCyberdeckTabStore.getState().setActiveCustomTabId(tabId);
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `TAB_WORKSPACE // ${file.name} // DOCUMENT` },
      ]);
    },
    [setMessages, setNavRailContext, updateCustomTab],
  );

  const handleCustomTabDrop = useCallback(
    async (e: ReactDragEvent<HTMLDivElement>, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await loadCustomTabAssetFromFile(tabId, file);
    },
    [loadCustomTabAssetFromFile],
  );

  return {
    customTabBrowserNavigate,
    loadCustomTabAssetFromFile,
    handleCustomTabDrop,
  };
}
