"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CallCenterPanel } from "@/extensions/property-management/departments/call-center/call-center-panel";

type CyberdeckCallCenterPaneBodyProps = {
  activeProvider?: string;
  modelId?: string;
  apiKey?: string;
};

/** Property Management call center pane — companion to Apps when PM deck app is active. */
export function CyberdeckCallCenterPaneBody({
  activeProvider = "opencode",
  modelId = "big-pickle",
  apiKey = "",
}: CyberdeckCallCenterPaneBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <div className="shrink-0 border-b border-[#1c1c1c] p-3">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
                CALL CENTER
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                TRAINING SIM // TEXT ONLY (VOICE + PHONE LATER)
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={<CyberdeckPaneHeaderValue>PM</CyberdeckPaneHeaderValue>}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <CallCenterPanel
          activeProvider={activeProvider}
          modelId={modelId}
          apiKey={apiKey}
        />
      </div>
    </div>
  );
}
