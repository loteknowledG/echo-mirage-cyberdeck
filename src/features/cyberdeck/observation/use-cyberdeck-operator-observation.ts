"use client";

import { useCallback, useEffect } from "react";
import type { DroppedOperatorAsset } from "@/features/cyberdeck/muthur/coding-verify-format";
import { resolveOperatorAssetSurface } from "@/lib/operator-file-surface";
import { readOperatorPaneSaveText } from "@/lib/operator-workbench";
import { setMuthurScreenSnapshot } from "@/lib/muthur-screen-context";
import { formatInhabitantChannelLabel } from "@/lib/muthur/muthur-inhabitant";
import {
  flushMuthurObservation,
  publishMuthurObservation,
} from "@/lib/muthur/observation/publish-observation";
import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";

export type UseCyberdeckOperatorObservationOptions = {
  deckUiHydrated: boolean;
  operatorSurfaceMode: "workspace" | "browser";
  operatorDroppedAsset: DroppedOperatorAsset | null;
  operatorSurfaceIsDocument: boolean;
  operatorActiveFilePath: string | null;
  operatorDocMode: "edit" | "view";
  operatorBrowserUrl: string;
  messages: MuthurChatMessage[];
  streamText: string;
  chatUserDisplayName: string;
};

export function useCyberdeckOperatorObservation({
  deckUiHydrated,
  operatorSurfaceMode,
  operatorDroppedAsset,
  operatorSurfaceIsDocument,
  operatorActiveFilePath,
  operatorDocMode,
  operatorBrowserUrl,
  messages,
  streamText,
  chatUserDisplayName,
}: UseCyberdeckOperatorObservationOptions) {
  const publishOperatorObservation = useCallback(() => {
    if (!deckUiHydrated) return;
    const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
    const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) ?? null;
    const visibleAsset =
      activeCustomTab?.asset ??
      (operatorSurfaceMode === "workspace" ? operatorDroppedAsset : null);
    void publishMuthurObservation({
      route: "/cyberdeck",
      surface: "cyberdeck",
      activeTab: activeCustomTab?.label ?? server,
      activePane: activeCustomTab?.kind ?? server,
      visibleDocument: visibleAsset?.name ?? null,
      documentExcerpt:
        typeof visibleAsset?.text === "string" ? visibleAsset.text.slice(0, 800) : null,
    });
  }, [deckUiHydrated, operatorDroppedAsset, operatorSurfaceMode]);

  useEffect(() => {
    publishOperatorObservation();
    const unsubscribe = useCyberdeckTabStore.subscribe(() => publishOperatorObservation());
    return () => {
      unsubscribe();
      flushMuthurObservation();
    };
  }, [publishOperatorObservation]);

  useEffect(() => {
    if (!deckUiHydrated) return;

    const syncMuthurScreenSnapshot = () => {
      const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
      const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) ?? null;
      const operatorSurface = operatorDroppedAsset
        ? resolveOperatorAssetSurface(operatorDroppedAsset)
        : null;
      const operatorText =
        operatorSurfaceIsDocument && operatorDroppedAsset
          ? readOperatorPaneSaveText(operatorDroppedAsset.text || "")
          : null;

      setMuthurScreenSnapshot({
        capturedAt: new Date().toISOString(),
        activeServer: server,
        activeCustomTab: activeCustomTab?.label ?? null,
        chat: messages.map((message) => ({
          role:
            message.role === "user" || message.role === "assistant" || message.role === "system"
              ? message.role
              : "error",
          label:
            message.role === "user"
              ? chatUserDisplayName
              : message.role === "assistant"
                ? message.inhabitant
                  ? formatInhabitantChannelLabel(message.inhabitant)
                  : "MUTHUR"
                : message.role === "system"
                  ? "SYS"
                  : "ERR",
          text: message.text,
        })),
        streamingMuthur: streamText || null,
        operator: operatorDroppedAsset
          ? {
              surfaceMode: operatorSurfaceMode,
              fileName: operatorDroppedAsset.name ?? null,
              filePath:
                operatorActiveFilePath?.trim() ||
                operatorDroppedAsset.localFilePath?.trim() ||
                null,
              previewSurface: operatorSurface,
              docMode: operatorDocMode,
              documentText: operatorText,
            }
          : null,
        browserUrl: operatorSurfaceMode === "browser" ? operatorBrowserUrl : null,
      });
    };

    syncMuthurScreenSnapshot();
    const unsubscribe = useCyberdeckTabStore.subscribe(syncMuthurScreenSnapshot);
    return unsubscribe;
  }, [
    chatUserDisplayName,
    deckUiHydrated,
    messages,
    operatorActiveFilePath,
    operatorDocMode,
    operatorBrowserUrl,
    operatorDroppedAsset,
    operatorSurfaceIsDocument,
    operatorSurfaceMode,
    streamText,
  ]);
}
