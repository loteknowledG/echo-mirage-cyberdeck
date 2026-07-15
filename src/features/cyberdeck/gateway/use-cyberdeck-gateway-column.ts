"use client";

import { useCallback, useEffect, useState, type DragEvent as ReactDragEvent, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import {
  cyberdeckProviderDisplayName,
  hasAnyProviderClientKey,
} from "@/features/cyberdeck/gateway/use-provider-connection";
import { useCyberdeckTabStore, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { isEditableOperatorFile } from "@/features/cyberdeck/muthur/coding-verify-format";
import { safeServerId, SERVER_IDS } from "@/features/cyberdeck/workspace/custom-tab-model";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";

export type UseCyberdeckGatewayColumnOptions = {
  serverRef: MutableRefObject<CyberdeckServerId>;
  gatewayColumnRef: RefObject<HTMLDivElement | null>;
  gatewayBlankSettingsRef: RefObject<HTMLDivElement | null>;
  startupRailResolvedRef: MutableRefObject<boolean>;
  offlineAutoOpenedRef: MutableRefObject<boolean>;
  prevConnectionStateRef: MutableRefObject<"offline" | "connecting" | "connected">;
  activeProvider: string;
  modelID: string;
  providerKeys: Record<string, string>;
  defaultKeyAvailableByProvider: Record<string, boolean>;
  didHydrateProviderState: boolean;
  providerConfigHydrated: boolean;
  connectionState: "offline" | "connecting" | "connected";
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setServerKeyboardHighlightId: (id: (typeof SERVER_IDS)[number] | null) => void;
  setProviderKeyboardHighlightId: (id: string | null) => void;
  setModelKeyboardHighlightId: (id: string | null) => void;
  setOperatorSurfaceMode: (mode: "workspace" | "browser") => void;
  setOperatorDocMode: (mode: "edit" | "view") => void;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  focusGatewayConnectionPanel: () => void;
  openOperatorFile: (path: string, loader: () => Promise<void>) => Promise<void>;
  loadOperatorAssetFromFile: (file: File) => Promise<void>;
};

export function useCyberdeckGatewayColumn({
  serverRef,
  gatewayColumnRef,
  gatewayBlankSettingsRef,
  startupRailResolvedRef,
  offlineAutoOpenedRef,
  prevConnectionStateRef,
  activeProvider,
  modelID,
  providerKeys,
  defaultKeyAvailableByProvider,
  didHydrateProviderState,
  providerConfigHydrated,
  connectionState,
  setNavRailContext,
  setServerKeyboardHighlightId,
  setProviderKeyboardHighlightId,
  setModelKeyboardHighlightId,
  setOperatorSurfaceMode,
  setOperatorDocMode,
  setMessages,
  focusGatewayConnectionPanel,
  openOperatorFile,
  loadOperatorAssetFromFile,
}: UseCyberdeckGatewayColumnOptions) {
  const [droppedMarkdown, setDroppedMarkdown] = useState<string | null>(null);
  const [droppedMarkdownName, setDroppedMarkdownName] = useState<string>("");
  const [isMarkdownDragOver, setIsMarkdownDragOver] = useState(false);

  const handleModelLabelClick = useCallback(
    (targetServer: "s" | "ct" | "b" = "s") => {
      const safe = safeServerId(targetServer);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      useCyberdeckTabStore.getState().setServer(safe as (typeof SERVER_IDS)[number]);
      setNavRailContext("gateway");
      setServerKeyboardHighlightId(null);
      setProviderKeyboardHighlightId(activeProvider);
      setModelKeyboardHighlightId(modelID || null);
      gatewayColumnRef.current?.focus({ preventScroll: true });
      if (safe === "s") {
        focusGatewayConnectionPanel();
      } else {
        gatewayBlankSettingsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    },
    [
      activeProvider,
      focusGatewayConnectionPanel,
      gatewayBlankSettingsRef,
      gatewayColumnRef,
      modelID,
      setModelKeyboardHighlightId,
      setNavRailContext,
      setProviderKeyboardHighlightId,
      setServerKeyboardHighlightId,
    ],
  );

  const focusFixedServerPanel = useCallback(
    (serverId: (typeof SERVER_IDS)[number]) => {
      if (serverId === "s") {
        handleModelLabelClick("s");
        return;
      }
      if (serverId === "ct") {
        handleModelLabelClick("ct");
        return;
      }
      if (serverId === "b") {
        handleModelLabelClick("b");
        return;
      }
      gatewayColumnRef.current?.focus({ preventScroll: true });
    },
    [gatewayColumnRef, handleModelLabelClick],
  );

  const openOperatorPaneOnStartup = useCallback(() => {
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    useCyberdeckTabStore.getState().setServer("m");
    setNavRailContext("tabs");
    setServerKeyboardHighlightId("m");
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("edit");
    startupRailResolvedRef.current = true;
  }, [
    setNavRailContext,
    setOperatorDocMode,
    setOperatorSurfaceMode,
    setServerKeyboardHighlightId,
    startupRailResolvedRef,
  ]);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    if (!didHydrateProviderState || !providerConfigHydrated || startupRailResolvedRef.current) return;

    if (hasAnyProviderClientKey(providerKeys, defaultKeyAvailableByProvider)) {
      openOperatorPaneOnStartup();
      return;
    }

    if (connectionState === "offline") {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      startupRailResolvedRef.current = true;
    }
  }, [
    connectionState,
    defaultKeyAvailableByProvider,
    didHydrateProviderState,
    handleModelLabelClick,
    offlineAutoOpenedRef,
    openOperatorPaneOnStartup,
    providerConfigHydrated,
    providerKeys,
    startupRailResolvedRef,
  ]);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    const prevState = prevConnectionStateRef.current;
    prevConnectionStateRef.current = connectionState;

    if (connectionState === "connected" && prevState !== "connected") {
      const activeModel = modelID || "UNSET_MODEL";
      const line = `MODEL_CONNECTED // ${cyberdeckProviderDisplayName(activeProvider)} / ${activeModel}`;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "system" && last.text === line) return prev;
        return [...prev, { role: "system", text: line }];
      });
    }

    if (
      didHydrateProviderState &&
      providerConfigHydrated &&
      connectionState === "offline" &&
      !offlineAutoOpenedRef.current &&
      !hasAnyProviderClientKey(providerKeys, defaultKeyAvailableByProvider)
    ) {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      return;
    }
    if (connectionState !== "offline") {
      offlineAutoOpenedRef.current = false;
    }
  }, [
    activeProvider,
    connectionState,
    didHydrateProviderState,
    defaultKeyAvailableByProvider,
    handleModelLabelClick,
    modelID,
    offlineAutoOpenedRef,
    prevConnectionStateRef,
    providerConfigHydrated,
    providerKeys,
    setMessages,
  ]);

  const handleThirdColumnDragOver = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (serverRef.current !== "m" && serverRef.current !== "s") return;
      e.preventDefault();
      setIsMarkdownDragOver(true);
    },
    [serverRef],
  );

  const handleThirdColumnDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsMarkdownDragOver(false);
  }, []);

  const handleThirdColumnDrop = useCallback(
    async (e: ReactDragEvent<HTMLDivElement>) => {
      const activeServer = serverRef.current;
      if (activeServer !== "m" && activeServer !== "s") return;

      e.preventDefault();
      setIsMarkdownDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (activeServer === "s") {
        const looksText = isEditableOperatorFile(file) || file.type === "text/markdown";
        if (!looksText) return;
        try {
          const text = await file.text();
          setDroppedMarkdown(text);
          setDroppedMarkdownName(file.name);
        } catch {
          // ignore failed file read
        }
        return;
      }

      if (activeServer === "m") {
        const dropPath = `drop://${file.name}#${file.lastModified}`;
        await openOperatorFile(dropPath, async () => {
          await loadOperatorAssetFromFile(file);
        });
      }
    },
    [loadOperatorAssetFromFile, openOperatorFile, serverRef],
  );

  return {
    droppedMarkdown,
    droppedMarkdownName,
    setDroppedMarkdown,
    setDroppedMarkdownName,
    isMarkdownDragOver,
    handleModelLabelClick,
    focusFixedServerPanel,
    handleThirdColumnDragOver,
    handleThirdColumnDragLeave,
    handleThirdColumnDrop,
  };
}
