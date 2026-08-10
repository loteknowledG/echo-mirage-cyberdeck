"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { CyberdeckMenuButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import {
  CUSTOM_TAB_CONTEXT_MENU_ACTIONS,
  isUnassignedCustomTab,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import type { CustomTabContextMenuAction } from "@/features/cyberdeck/workspace/custom-tab-model";
import type { RailTabContextMenuState } from "@/features/cyberdeck/workspace/use-rail-tab-context-menu";
import type { SERVER_IDS } from "@/features/cyberdeck/workspace/custom-tab-model";

export type CyberdeckContextMenusProps = {
  railTabContextMenu: RailTabContextMenuState;
  mirageContextMenu: { x: number; y: number } | null;
  gatewayPaneContextMenu: { x: number; y: number } | null;
  closeRailTabContextMenu: () => void;
  closeMirageContextMenu: () => void;
  closeGatewayPaneContextMenu: () => void;
  applyTabMenuAction: (action: CustomTabContextMenuAction, existingTabId?: string) => void;
  focusFixedServerPanel: (serverId: (typeof SERVER_IDS)[number]) => void;
  deleteCustomTab: (tabId: string) => void;
  copySelection: () => void | Promise<void>;
};

function PaneCopyMenu({
  x,
  y,
  onClose,
  onCopy,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void | Promise<void>;
}) {
  return (
    <div
      role="menu"
      aria-label="Copy selection"
      className="absolute min-w-28 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <CyberdeckMenuButton
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          void onCopy();
        }}
      >
        Copy
      </CyberdeckMenuButton>
    </div>
  );
}

export function CyberdeckContextMenus({
  railTabContextMenu,
  mirageContextMenu,
  gatewayPaneContextMenu,
  closeRailTabContextMenu,
  closeMirageContextMenu,
  closeGatewayPaneContextMenu,
  applyTabMenuAction,
  focusFixedServerPanel,
  deleteCustomTab,
  copySelection,
}: CyberdeckContextMenusProps) {
  useEffect(() => {
    if (!railTabContextMenu && !mirageContextMenu && !gatewayPaneContextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRailTabContextMenu();
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeGatewayPaneContextMenu,
    closeMirageContextMenu,
    closeRailTabContextMenu,
    gatewayPaneContextMenu,
    mirageContextMenu,
    railTabContextMenu,
  ]);

  if (!railTabContextMenu && !mirageContextMenu && !gatewayPaneContextMenu) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90]"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRailTabContextMenu();
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
      }}
      onPointerDown={() => {
        closeRailTabContextMenu();
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
      }}
    >
      {railTabContextMenu ? (
        <div
          role="menu"
          aria-label={
            railTabContextMenu.variant === "fixed"
              ? "Fixed server tab actions"
              : railTabContextMenu.variant === "new"
                ? "Choose new tab type"
                : "Tab actions"
          }
          className="absolute w-fit min-w-[8.75rem] max-h-[70vh] overflow-y-auto rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)] [&_[role=menuitem]]:whitespace-nowrap"
          style={{ left: railTabContextMenu.x, top: railTabContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {railTabContextMenu.variant === "fixed" ? (
            <>
              <CyberdeckMenuButton
                type="button"
                role="menuitem"
                onClick={() => {
                  const id = railTabContextMenu.serverId;
                  closeRailTabContextMenu();
                  focusFixedServerPanel(id);
                }}
              >
                {railTabContextMenu.serverId === "m"
                  ? "Focus operator panel"
                  : railTabContextMenu.serverId === "d"
                    ? "Focus MUTHUR-LOAD panel"
                  : railTabContextMenu.serverId === "s"
                    ? "Focus connection panel"
                    : "Focus settings panel"}
              </CyberdeckMenuButton>
              <CyberdeckMenuButton
                type="button"
                role="menuitem"
                onClick={() => {
                  const id = railTabContextMenu.serverId;
                  closeRailTabContextMenu();
                  void navigator.clipboard
                    .writeText(id)
                    .then(() => toast.success(`Copied server id: ${id}`))
                    .catch(() => toast.error("Could not copy."));
                }}
              >
                Copy server id
              </CyberdeckMenuButton>
            </>
          ) : railTabContextMenu.variant === "new" ? (
            <>
              {CUSTOM_TAB_CONTEXT_MENU_ACTIONS.map((action) => (
                <CyberdeckMenuButton
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={() => applyTabMenuAction(action)}
                >
                  {action.label}
                </CyberdeckMenuButton>
              ))}
            </>
          ) : (
            <>
              {isUnassignedCustomTab(
                useCyberdeckTabStore
                  .getState()
                  .customTabs.find((tab) => tab.id === railTabContextMenu.tabId),
              )
                ? CUSTOM_TAB_CONTEXT_MENU_ACTIONS.map((action) => (
                    <CyberdeckMenuButton
                      key={`convert-${action.label}`}
                      type="button"
                      role="menuitem"
                      onClick={() => applyTabMenuAction(action, railTabContextMenu.tabId)}
                    >
                      {action.label}
                    </CyberdeckMenuButton>
                  ))
                : null}
              <CyberdeckMenuButton
                type="button"
                role="menuitem"
                danger
                onClick={() => {
                  if (railTabContextMenu.variant !== "custom") return;
                  deleteCustomTab(railTabContextMenu.tabId);
                  closeRailTabContextMenu();
                }}
              >
                Close
              </CyberdeckMenuButton>
            </>
          )}
        </div>
      ) : mirageContextMenu ? (
        <PaneCopyMenu
          x={mirageContextMenu.x}
          y={mirageContextMenu.y}
          onClose={closeMirageContextMenu}
          onCopy={copySelection}
        />
      ) : gatewayPaneContextMenu ? (
        <PaneCopyMenu
          x={gatewayPaneContextMenu.x}
          y={gatewayPaneContextMenu.y}
          onClose={closeGatewayPaneContextMenu}
          onCopy={copySelection}
        />
      ) : null}
    </div>
  );
}
