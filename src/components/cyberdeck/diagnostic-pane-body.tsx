'use client';

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckInfoBlockHeader } from "@/components/cyberdeck/info-block-header";
import { CyberdeckSquareCardGrid } from "@/components/cyberdeck/square-card-grid";
import { CyberdeckSquareCard } from "@/components/cyberdeck/square-card";

type DiagnosticPaneBodyProps = {
  server: string;
  connectionState: "offline" | "connecting" | "connected";
  activeProvider: string;
  modelID: string;
  providerModelFetchStatus: "idle" | "retrieving" | "invalid-key" | "error" | "ready";
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  muthurMemoryTurnCount: number;
  muthurMemoryUpdatedAt: number;
  memoryContext: string;
  heapCount: number;
  chatCount: number;
};

export function CyberdeckDiagnosticPaneBody({
  server,
  connectionState,
  activeProvider,
  modelID,
  providerModelFetchStatus,
  voiceEnabled,
  voiceHealth,
  muthurMemoryTurnCount,
  muthurMemoryUpdatedAt,
  memoryContext,
  heapCount,
  chatCount,
}: DiagnosticPaneBodyProps) {
  const connectionTone =
    connectionState === "connected"
      ? "text-emerald-200"
      : connectionState === "connecting"
        ? "text-amber-300"
        : "text-[#8a8a8a]";

  const voiceTone =
    voiceHealth === "backend"
      ? "text-emerald-200"
      : voiceHealth === "fallback"
        ? "text-amber-300"
        : voiceHealth === "off"
          ? "text-gray-500"
          : "text-[#8a8a8a]";

  const traceTone = memoryContext.trim() ? "text-emerald-200" : "text-[#8a8a8a]";

  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <>
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                DIAGNOSTIC
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>SYSTEM HEALTH // MEMORY // UPLINK</CyberdeckPaneHeaderSubtitle>
            </>
          }
          right={<CyberdeckPaneHeaderValue>{server.toUpperCase()}</CyberdeckPaneHeaderValue>}
        />

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-3">
          <CyberdeckSquareCardGrid>
            <CyberdeckSquareCard>
              <CyberdeckInfoBlockHeader
                title="CONNECTION"
                subtitle={`ACTIVE PROVIDER // ${activeProvider.toUpperCase()}`}
                status={connectionState.toUpperCase()}
                statusClassName={`font-mono text-[9px] tracking-[0.08em] ${connectionTone}`}
              />
              <div className="mt-3 flex-1 font-mono text-[9px] leading-5 text-[#a3a3a3]">
                <div>MODEL // {modelID || "NO_MODEL"}</div>
                <div>FETCH // {providerModelFetchStatus.toUpperCase()}</div>
              </div>
            </CyberdeckSquareCard>

            <CyberdeckSquareCard>
              <CyberdeckInfoBlockHeader
                title="VOICE"
                subtitle="MUTHUR OUTPUT CHAIN"
                status={voiceEnabled ? "ON" : "OFF"}
                statusClassName={`font-mono text-[9px] tracking-[0.08em] ${voiceTone}`}
              />
              <div className="mt-3 flex-1 font-mono text-[9px] leading-5 text-[#a3a3a3]">
                <div>HEALTH // {voiceHealth.toUpperCase()}</div>
                <div>MUTHUR MEMORY // {muthurMemoryTurnCount} TURNS</div>
              </div>
            </CyberdeckSquareCard>

            <CyberdeckSquareCard>
              <CyberdeckInfoBlockHeader
                title="TRACE"
                subtitle="SYSTEM PROMPT // MEMORY INJECT"
                status={memoryContext.trim() ? "ARMED" : "EMPTY"}
                statusClassName={`font-mono text-[9px] tracking-[0.08em] ${traceTone}`}
              />
              <div className="mt-3 flex flex-1 flex-col overflow-hidden font-mono text-[9px] leading-5 text-[#a3a3a3]">
                <div className="mb-2 text-[#6f6f6f]">SOURCE // MUTHUR MEMORY + CURRENT QUERY</div>
                <div className="custom-scrollbar flex-1 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
                  {memoryContext.trim() || "NO MEMORY CONTEXT"}
                </div>
                <div className="mt-2 text-[#6f6f6f]">HEAP // {heapCount} // CHAT // {chatCount}</div>
                <div className="mt-1 text-[#6f6f6f]">
                  LAST UPDATE //{" "}
                  {muthurMemoryUpdatedAt ? new Date(muthurMemoryUpdatedAt).toLocaleString() : "—"}
                </div>
              </div>
            </CyberdeckSquareCard>

            <CyberdeckSquareCard>
              <CyberdeckInfoBlockHeader
                title="STATE"
                subtitle="TAB SLOT REUSED FROM HEAP"
                status="LIVE"
                statusClassName="font-mono text-[9px] tracking-[0.08em] text-emerald-200"
              />
              <div className="mt-3 flex-1 font-mono text-[9px] leading-5 text-[#a3a3a3]">
                <div>SERVER // {server.toUpperCase()}</div>
                <div>READY // YES</div>
                <div>DIAGNOSTIC // ENABLED</div>
              </div>
            </CyberdeckSquareCard>
          </CyberdeckSquareCardGrid>
        </div>
      </div>
    </div>
  );
}
