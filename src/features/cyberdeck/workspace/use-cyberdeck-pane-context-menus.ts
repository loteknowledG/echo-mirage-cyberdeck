"use client";

import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { contextMenuTargetIsTextField } from "@/features/cyberdeck/muthur/coding-verify-format";

function contextMenuTargetIsPowerfistDeck(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '.powerfist-preview-layout, [data-testid="preview-matrix"], [data-powerfist-deck], [data-preview-card]',
    ),
  );
}

function readSelectedText(): string {
  if (typeof window === "undefined") return "";
  return window.getSelection()?.toString().trim() ?? "";
}

export type UseCyberdeckPaneContextMenusOptions = {
  closeRailTabContextMenu: () => void;
};

export function useCyberdeckPaneContextMenus({
  closeRailTabContextMenu,
}: UseCyberdeckPaneContextMenusOptions) {
  const [mirageContextMenu, setMirageContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [gatewayPaneContextMenu, setGatewayPaneContextMenu] = useState<{ x: number; y: number } | null>(
    null,
  );

  const closeMirageContextMenu = useCallback(() => {
    setMirageContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "mirage_menu" }, severity: "info" });
  }, []);

  const closeGatewayPaneContextMenu = useCallback(() => {
    setGatewayPaneContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "gateway_menu" }, severity: "info" });
  }, []);

  const openMirageContextMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return;
      closeRailTabContextMenu();
      closeGatewayPaneContextMenu();
      const menuWidth = 112;
      const menuHeight = 44;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));
      setMirageContextMenu({ x, y });
    },
    [closeGatewayPaneContextMenu, closeRailTabContextMenu],
  );

  const openGatewayPaneContextMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return;
      closeRailTabContextMenu();
      closeMirageContextMenu();
      const menuWidth = 112;
      const menuHeight = 44;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));
      setGatewayPaneContextMenu({ x, y });
    },
    [closeMirageContextMenu, closeRailTabContextMenu],
  );

  const copySelection = useCallback(async () => {
    const text = readSelectedText();
    if (!text) {
      toast.error("Nothing selected to copy.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success("Copied selection.");
    } catch {
      toast.error("Could not copy.");
    }
  }, []);

  const handleMiragePaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      if (contextMenuTargetIsPowerfistDeck(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!readSelectedText()) return;
      event.preventDefault();
      event.stopPropagation();
      openMirageContextMenu(event.clientX, event.clientY);
    },
    [openMirageContextMenu],
  );

  const handleGatewayPaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      if (contextMenuTargetIsPowerfistDeck(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!readSelectedText()) return;
      event.preventDefault();
      event.stopPropagation();
      openGatewayPaneContextMenu(event.clientX, event.clientY);
    },
    [openGatewayPaneContextMenu],
  );

  return {
    mirageContextMenu,
    gatewayPaneContextMenu,
    closeMirageContextMenu,
    closeGatewayPaneContextMenu,
    handleMiragePaneContextMenu,
    handleGatewayPaneContextMenu,
    copySelection,
  };
}
