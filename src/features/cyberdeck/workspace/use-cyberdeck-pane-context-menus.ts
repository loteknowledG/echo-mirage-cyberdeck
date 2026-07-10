"use client";

import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { contextMenuTargetIsTextField } from "@/features/cyberdeck/muthur/coding-verify-format";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";

export type UseCyberdeckPaneContextMenusOptions = {
  messages: ChatMessage[];
  streamText: string;
  closeRailTabContextMenu: () => void;
};

export function useCyberdeckPaneContextMenus({
  messages,
  streamText,
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
      const menuWidth = 176;
      const menuHeight = 236;
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
      const menuWidth = 176;
      const menuHeight = 200;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));
      setGatewayPaneContextMenu({ x, y });
    },
    [closeMirageContextMenu, closeRailTabContextMenu],
  );

  const handleMiragePaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openMirageContextMenu(event.clientX, event.clientY);
    },
    [openMirageContextMenu],
  );

  const handleGatewayPaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openGatewayPaneContextMenu(event.clientX, event.clientY);
    },
    [openGatewayPaneContextMenu],
  );

  const copyMirageLastAssistant = useCallback(async () => {
    let text = streamText.trim();
    if (!text) {
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      text = typeof last?.text === "string" ? last.text.trim() : "";
    }
    if (!text) {
      toast.error("No assistant message to copy.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success("Copied last assistant message.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [messages, streamText]);

  const copyMirageSelectionOrLastMessage = useCallback(async () => {
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    let text = sel;
    if (!text) {
      const last = messages[messages.length - 1];
      text = typeof last?.text === "string" ? last.text.trim() : "";
      if (!text) text = streamText.trim();
    }
    if (!text) {
      toast.error("Nothing to copy.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success(sel ? "Copied selected text." : "Copied last message.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [messages, streamText]);

  return {
    mirageContextMenu,
    gatewayPaneContextMenu,
    closeMirageContextMenu,
    closeGatewayPaneContextMenu,
    handleMiragePaneContextMenu,
    handleGatewayPaneContextMenu,
    copyMirageLastAssistant,
    copyMirageSelectionOrLastMessage,
  };
}
