"use client";

import type { ReactNode } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MORPHISM_ZONE_REALMORPHISM } from "@/lib/cyberdeck/morphism-zones";

export type CyberdeckLayoutShellProps = {
  isMobileLayout: boolean;
  onContentSplitSizesChange: (sizes: number[]) => void;
  chatColumn: ReactNode;
  gatewayColumn: ReactNode;
};

export function CyberdeckLayoutShell({
  isMobileLayout,
  onContentSplitSizesChange,
  chatColumn,
  gatewayColumn,
}: CyberdeckLayoutShellProps) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-morphism={MORPHISM_ZONE_REALMORPHISM}
    >
      <ResizablePanelGroup
        key={isMobileLayout ? "mobile-vertical" : "desktop-horizontal"}
        orientation={isMobileLayout ? "vertical" : "horizontal"}
        memoryKey="cyberdeck-content-split-v3"
        className="h-full min-h-0 min-w-0 flex-1"
        onSizesChange={onContentSplitSizesChange}
      >
        <ResizablePanel
          defaultSize={isMobileLayout ? 42 : 45}
          minSize={0}
          className="h-full min-h-0 overflow-hidden"
        >
          {gatewayColumn}
        </ResizablePanel>

        <ResizableHandle
          withHandle
          snapControls
          stacked={isMobileLayout}
          data-cyberdeck-resizer="content-split"
          aria-label="Resize gateway and MUTHUR panes"
          className={
            isMobileLayout
              ? "cyberdeck-chat-resizer !h-2 !min-h-2 !border-x-0 !border-y !border-[#141414] !bg-black hover:!border-red-500/70"
              : "cyberdeck-chat-resizer !w-2 !min-w-2 !border-x-0 !border-r !border-[#141414] !bg-black hover:!border-red-500/70 before:absolute before:-inset-x-3 before:inset-y-0 before:content-['']"
          }
        />

        <ResizablePanel
          defaultSize={isMobileLayout ? 58 : 55}
          minSize={0}
          className="h-full min-h-0 overflow-hidden"
        >
          {chatColumn}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
