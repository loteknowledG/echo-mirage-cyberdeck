"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { useOperators, type OperatorState } from "@/lib/operators";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";
import { useDeckMode } from "@/lib/deck-mode";
import { LEGACY_OPERATOR_CARD, realmorphismControlClass } from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

type CyberdeckOperatorsPaneBodyProps = {
  orchestration: OrchestrationBundle | null;
};

function statusTone(status: OperatorState) {
  if (status === "ONLINE") return "text-emerald-300 border-emerald-600/50";
  if (status === "THINKING" || status === "REVIEWING") return "text-amber-300 border-amber-600/50";
  if (status === "BLOCKED") return "text-red-300 border-red-600/50";
  return "text-[#a0a0a0] border-[#2a2a2a]";
}

export function CyberdeckOperatorsPaneBody({ orchestration }: CyberdeckOperatorsPaneBodyProps) {
  const deckMode = useDeckMode();
  const { operators, stateCounts } = useOperators();
  const activeTask = orchestration?.activeTask;
  const agentRoles = orchestration?.agentRoles;

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                OPERATORS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>SYNTH CREW // LIVE STATUS FEED</CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="font-mono text-[9px] text-[#9a9a9a]">
              {stateCounts.ONLINE}/{operators.length} ONLINE
            </div>
          }
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2">
          {operators.map((operator) => {
            const status = operator.state;
            const callsignLabel = `${operator.callsign} // ${operator.role}`;
            return (
              <button
                key={operator.id}
                type="button"
                onClick={() =>
                  emitSignal({
                    source: "operators",
                    type: "operator_selected",
                    payload: {
                      id: operator.id,
                      callsign: callsignLabel,
                      state: status,
                    },
                    severity: "info",
                  })
                }
                className={cn(
                  realmorphismControlClass(deckMode, {
                    size: "tile",
                    legacyClassName: LEGACY_OPERATOR_CARD,
                  }),
                  statusTone(status),
                )}
              >
                <div className="flex items-center justify-between text-[#d8d8d8]">
                  <span>{operator.callsign.toUpperCase()} // {operator.role.toUpperCase()}</span>
                  <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] ${statusTone(status)}`}>
                    <span className={`operator-pulse-dot ${status === "ONLINE" ? "bg-emerald-300" : status === "THINKING" || status === "REVIEWING" ? "bg-amber-300" : status === "BLOCKED" ? "bg-red-300" : "bg-[#8a8a8a]"}`} />
                    {status}
                  </span>
                </div>
                <div className="mt-2 border-t border-[#1c1c1c] pt-2 text-[9px] leading-relaxed text-[#a8a8a8]">
                  {operator.activityText}
                </div>
              </button>
            );
          })}
        </div>
        {agentRoles && (
          <div className="border-t border-[#1c1c1c] p-3">
            <div className="mb-2 font-mono text-[9px] tracking-[0.06em] text-[#6a6a6a]">ORCHESTRATION</div>
            <div className="space-y-1 text-[9px] text-[#5a5a5a]">
              <div>HIERARCHY: {agentRoles.hierarchy.top} → {agentRoles.hierarchy.verifier} → {agentRoles.hierarchy.final}</div>
              {activeTask && (
                <>
                  <div>STATUS: {activeTask.status}</div>
                  <div>STEP: {activeTask.current_step}</div>
                  <div>NEXT: {activeTask.next_step}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
