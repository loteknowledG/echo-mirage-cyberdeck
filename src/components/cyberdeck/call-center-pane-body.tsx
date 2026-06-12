"use client";

import { useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { FloatingPhoneDialer } from "@/components/property-manager/FloatingPhoneDialer";
import { CaseViewerBoard } from "@/components/property-manager/CaseViewerBoard";
import type { SelectedCaseDialerContext } from "@/lib/property-manager/call-sessions";
import { CallCenterPanel } from "@/extensions/property-management/departments/call-center/call-center-panel";
import { cn } from "@/lib/utils";

type CyberdeckCallCenterPaneBodyProps = {
  activeProvider?: string;
  modelId?: string;
  apiKey?: string;
};

type CallCenterMode = "sim" | "cases";

/** Property Management call center — training sim + persisted case operations board. */
export function CyberdeckCallCenterPaneBody({
  activeProvider = "opencode",
  modelId = "big-pickle",
  apiKey = "",
}: CyberdeckCallCenterPaneBodyProps) {
  const [mode, setMode] = useState<CallCenterMode>("sim");
  const [selectedCase, setSelectedCase] = useState<SelectedCaseDialerContext | null>(null);
  const [caseRefreshSignal, setCaseRefreshSignal] = useState(0);
  const [boundaryElement, setBoundaryElement] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setBoundaryElement} className="relative flex min-h-0 flex-1 flex-col overflow-visible bg-black">
      <div className="relative z-0 shrink-0 border-b border-[#1c1c1c] p-3">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
                CALL CENTER
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                {mode === "sim"
                  ? "TRAINING SIM // DRAG PHONE ANYWHERE IN PANE"
                  : "CASE BOARD // DRAG PHONE ANYWHERE IN PANE"}
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              <div className="flex rounded-sm border border-[#2d2d2d] p-0.5">
                {(
                  [
                    { id: "sim" as const, label: "SIM" },
                    { id: "cases" as const, label: "CASES" },
                  ] as const
                ).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setMode(entry.id)}
                    className={cn(
                      "rounded-sm px-2 py-1 font-mono text-[8px] tracking-[0.1em]",
                      mode === entry.id
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "text-[#8a8a8a] hover:text-[#c0c0c0]",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <CyberdeckPaneHeaderValue>PM</CyberdeckPaneHeaderValue>
            </div>
          }
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {mode === "sim" ? (
          <CallCenterPanel activeProvider={activeProvider} modelId={modelId} apiKey={apiKey} />
        ) : (
          <CaseViewerBoard
            onSelectedCaseChange={setSelectedCase}
            refreshSignal={caseRefreshSignal}
          />
        )}
      </div>
      <FloatingPhoneDialer
        boundaryElement={boundaryElement}
        selectedCase={selectedCase}
        onCallEnded={() => setCaseRefreshSignal((value) => value + 1)}
      />
    </div>
  );
}
