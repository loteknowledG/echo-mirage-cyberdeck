"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UseGatewayPaneStateOptions = {
  isMobileLayout: boolean;
  activeProvider: string;
  modelList: { id: string }[];
};

export function useGatewayPaneState({
  isMobileLayout,
  activeProvider,
  modelList,
}: UseGatewayPaneStateOptions) {
  const [providerKeyboardHighlightId, setProviderKeyboardHighlightId] = useState<string | null>(null);
  const [modelKeyboardHighlightId, setModelKeyboardHighlightId] = useState<string | null>(null);
  const gatewayColumnRef = useRef<HTMLDivElement>(null);
  const gatewayConnectionPanelRef = useRef<HTMLDivElement>(null);

  const focusGatewayConnectionPanel = useCallback(() => {
    const scrollToPanel = (panel: HTMLElement) => {
      const scrollParent = panel.closest(".overflow-y-auto");
      if (scrollParent && scrollParent instanceof HTMLElement) {
        const parentRect = scrollParent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const offset = panelRect.top - parentRect.top + scrollParent.scrollTop - 12;
        scrollParent.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        return;
      }
      panel.scrollIntoView({
        block: isMobileLayout ? "center" : "nearest",
        behavior: "smooth",
      });
    };

    const attempt = (triesLeft: number) => {
      const panel = gatewayConnectionPanelRef.current;
      if (!panel) {
        if (triesLeft > 0) window.requestAnimationFrame(() => attempt(triesLeft - 1));
        return;
      }
      window.requestAnimationFrame(() => scrollToPanel(panel));
    };

    attempt(4);
  }, [isMobileLayout]);

  useEffect(() => {
    const scrollToHighlight = (selector: string) => {
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(selector);
        el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      });
    };

    if (providerKeyboardHighlightId) {
      scrollToHighlight(`[data-provider-row="${providerKeyboardHighlightId}"]`);
      return;
    }
    if (modelKeyboardHighlightId) {
      scrollToHighlight(`[data-model-row="${modelKeyboardHighlightId}"]`);
    }
  }, [modelKeyboardHighlightId, providerKeyboardHighlightId]);

  useEffect(() => {
    setModelKeyboardHighlightId((prev) => {
      if (prev == null) return null;
      if (!modelList.some((m) => m.id === prev)) return null;
      return prev;
    });
  }, [activeProvider, modelList]);

  return {
    providerKeyboardHighlightId,
    setProviderKeyboardHighlightId,
    modelKeyboardHighlightId,
    setModelKeyboardHighlightId,
    gatewayColumnRef,
    gatewayConnectionPanelRef,
    focusGatewayConnectionPanel,
  };
}
