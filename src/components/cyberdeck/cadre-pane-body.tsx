"use client";

import { useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckControl } from "@/components/cyberdeck/cyberdeck-control-button";
import { formatCadreUptime, formatCadreReadinessLabel, readinessTone, type CadreRuntime } from "@/lib/cadre/runtime-registry";
import { useCadreHost } from "@/lib/cadre/use-cadre-host";
import { cn } from "@/lib/utils";

function statusClass(status: CadreRuntime["status"]): string {
  if (status === "running") return "text-emerald-400";
  if (status === "starting") return "text-amber-400";
  return "text-[#666]";
}

function statusLabel(status: CadreRuntime["status"]): string {
  return status.toUpperCase();
}

function readinessClass(readiness: CadreRuntime["readiness"]): string {
  const tone = readinessTone(readiness);
  if (tone === "good") return "text-emerald-400";
  if (tone === "warn") return "text-amber-400";
  if (tone === "bad") return "text-red-400";
  return "text-[#777]";
}

function RuntimeRow({
  runtime,
  selected,
  onSelect,
}: {
  runtime: CadreRuntime;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] transition-colors",
        selected
          ? "border-emerald-500/50 bg-emerald-950/20"
          : "border-[#1a1a1a] bg-black hover:border-[#2a2a2a]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#ddd]">{runtime.name}</span>
        <span className={statusClass(runtime.status)}>{statusLabel(runtime.status)}</span>
      </div>
      <div className="mt-1 text-[8px] text-[#555]">
        {runtime.pid ? `PID ${runtime.pid}` : "NO PROCESS"} // UPTIME {formatCadreUptime(runtime.startedAt)}
      </div>
      <div className={cn("mt-1 text-[8px] tracking-[0.08em]", readinessClass(runtime.readiness))}>
        READINESS: {formatCadreReadinessLabel(runtime.readiness)}
      </div>
    </button>
  );
}

export function CyberdeckCadrePaneBody() {
  const {
    runtimes,
    outputById,
    readyMessage,
    loading,
    connected,
    error,
    busyId,
    startRuntime,
    stopRuntime,
    restartRuntime,
  } = useCadreHost();
  const [selectedId, setSelectedId] = useState<string>("codex");

  const selectedRuntime = useMemo(
    () => runtimes.find((entry) => entry.id === selectedId) ?? runtimes[0],
    [runtimes, selectedId],
  );
  const selectedOutput = outputById[selectedRuntime?.id ?? "codex"] ?? { stdout: "", stderr: "" };
  const terminalText = `${selectedOutput.stdout}${selectedOutput.stderr ? `\n${selectedOutput.stderr}` : ""}`.trim();

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                CADRE
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                TERMINAL HOST // OBSERVE ONLY
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  "font-mono text-[9px] tracking-[0.08em]",
                  connected ? "text-emerald-400" : "text-[#666]",
                )}
              >
                {connected ? "STREAM LIVE" : "STREAM OFFLINE"}
              </span>
              {readyMessage ? (
                <span className="font-mono text-[8px] tracking-[0.08em] text-emerald-300/80">
                  {readyMessage}
                </span>
              ) : null}
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="font-mono text-[9px] tracking-[0.1em] text-[#666]">[ MUTHUR ]</div>
            <div className="rounded-sm border border-[#1c1c1c] bg-[#050505] px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-emerald-300/90">
              MUTHUR
              <div className="mt-1 text-[8px] text-[#666]">ORCHESTRATOR // ALWAYS ONLINE</div>
            </div>

            <div className="font-mono text-[9px] tracking-[0.1em] text-[#666]">[ CADRE RUNTIMES ]</div>
            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {loading ? (
                <div className="font-mono text-[10px] text-[#666]">LOADING RUNTIMES…</div>
              ) : (
                runtimes.map((runtime) => (
                  <RuntimeRow
                    key={runtime.id}
                    runtime={runtime}
                    selected={selectedRuntime?.id === runtime.id}
                    onSelect={() => setSelectedId(runtime.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            {error ? (
              <div className="rounded-sm border border-red-900/50 bg-red-950/20 px-3 py-2 font-mono text-[10px] text-red-300">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <CyberdeckControl
                control={{ size: "wide", signal: true }}
                disabled={!selectedRuntime || busyId === selectedRuntime.id || selectedRuntime.status === "running"}
                onClick={() => selectedRuntime && void startRuntime(selectedRuntime.id)}
              >
                START
              </CyberdeckControl>
              <CyberdeckControl
                control={{ size: "wide", danger: true }}
                disabled={!selectedRuntime || busyId === selectedRuntime.id || selectedRuntime.status === "stopped"}
                onClick={() => selectedRuntime && void stopRuntime(selectedRuntime.id)}
              >
                STOP
              </CyberdeckControl>
              <CyberdeckControl
                control={{ size: "wide", amber: true }}
                disabled={!selectedRuntime || busyId === selectedRuntime.id}
                onClick={() => selectedRuntime && void restartRuntime(selectedRuntime.id)}
              >
                RESTART
              </CyberdeckControl>
              {selectedRuntime ? (
                <div className="ml-auto flex flex-col items-end gap-0.5 font-mono text-[9px] tracking-[0.08em] text-[#777]">
                  <span>
                    {selectedRuntime.name} // {statusLabel(selectedRuntime.status)} // UPTIME{" "}
                    {formatCadreUptime(selectedRuntime.startedAt)}
                  </span>
                  <span className={readinessClass(selectedRuntime.readiness)}>
                    READINESS: {formatCadreReadinessLabel(selectedRuntime.readiness)}
                  </span>
                  {selectedRuntime.readinessReason ? (
                    <span className="max-w-[280px] text-right text-[8px] text-[#666]">
                      REASON: {selectedRuntime.readinessReason}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#1c1c1c] bg-[#030303]">
              <div className="border-b border-[#141414] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#666]">
                TERMINAL OUTPUT // {selectedRuntime?.name ?? "—"}
              </div>
              <pre className="custom-scrollbar min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[10px] leading-snug text-[#cfcfcf]">
                {terminalText || "NO OUTPUT YET. START A RUNTIME TO OBSERVE TERMINAL ACTIVITY."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CyberdeckCadrePaneBody;
