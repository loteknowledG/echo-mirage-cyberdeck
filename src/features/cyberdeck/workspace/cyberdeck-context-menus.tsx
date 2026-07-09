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
  deleteActiveTab: () => void;
  openOrFocusCallCenterTab: () => void;
  replayFullLastAssistant: () => void;
  copyMirageLastAssistant: () => void | Promise<void>;
  copyMirageSelectionOrLastMessage: () => void | Promise<void>;
  handleModelLabelClick: (targetServer?: "s" | "ct" | "b") => void;
  openOrFocusDiagnosticsTab: () => void;
};

export function CyberdeckContextMenus({
  railTabContextMenu,
  mirageContextMenu,
  gatewayPaneContextMenu,
  closeRailTabContextMenu,
  closeMirageContextMenu,
  closeGatewayPaneContextMenu,
  applyTabMenuAction,
  focusFixedServerPanel,
  deleteActiveTab,
  openOrFocusCallCenterTab,
  replayFullLastAssistant,
  copyMirageLastAssistant,
  copyMirageSelectionOrLastMessage,
  handleModelLabelClick,
  openOrFocusDiagnosticsTab,
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
                  : railTabContextMenu.serverId === "s"
                    ? "Focus connection panel"
                    : railTabContextMenu.serverId === "ct"
                      ? "Focus card table"
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
                  deleteActiveTab();
                  closeRailTabContextMenu();
                }}
              >
                Close
              </CyberdeckMenuButton>
            </>
          )}
        </div>
      ) : mirageContextMenu ? (
        <div
          role="menu"
          aria-label="Mirage chat actions"
          className="absolute min-w-44 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
          style={{ left: mirageContextMenu.x, top: mirageContextMenu.y }}
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
              closeMirageContextMenu();
              openOrFocusCallCenterTab();
            }}
          >
            Open Call Center
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeMirageContextMenu();
              replayFullLastAssistant();
            }}
          >
            Speak last message
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeMirageContextMenu();
              void copyMirageLastAssistant();
            }}
          >
            Copy last assistant message
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeMirageContextMenu();
              void copyMirageSelectionOrLastMessage();
            }}
          >
            Copy selection or last message
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeMirageContextMenu();
              handleModelLabelClick("b");
            }}
          >
            Open Settings
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeMirageContextMenu();
              handleModelLabelClick("s");
            }}
          >
            Open connection panel
          </CyberdeckMenuButton>
        </div>
      ) : gatewayPaneContextMenu ? (
        <div
          role="menu"
          aria-label="Gateway pane actions"
          className="absolute min-w-44 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
          style={{ left: gatewayPaneContextMenu.x, top: gatewayPaneContextMenu.y }}
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
              closeGatewayPaneContextMenu();
              void copyMirageSelectionOrLastMessage();
            }}
          >
            Copy selection or last message
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeGatewayPaneContextMenu();
              handleModelLabelClick("b");
            }}
          >
            Open Settings
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeGatewayPaneContextMenu();
              handleModelLabelClick("s");
            }}
          >
            Open connection panel
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            type="button"
            role="menuitem"
            onClick={() => {
              closeGatewayPaneContextMenu();
              openOrFocusDiagnosticsTab();
            }}
          >
            Open Diagnostics tab
          </CyberdeckMenuButton>
        </div>
      ) : null}
    </div>
  );
}
