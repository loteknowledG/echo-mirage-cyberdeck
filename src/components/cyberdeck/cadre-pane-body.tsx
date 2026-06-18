"use client";

import { useCadreHost } from "@/lib/cadre/use-cadre-host";
import { isCadreEvent } from "@/lib/cadre/cadre-events";
import { ingestCadreEvent } from "@/lib/cadre/cadre-event-bus";

import { CadreActivityStream } from "@/components/cyberdeck/cadre-activity-stream";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckControl } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  formatCadreReadinessLabel,
  formatCadreUptime,
  readinessTone,
  type CadreRuntime,
} from "@/lib/cadre/runtime-registry";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

function statusClass(status: CadreRuntime["status"]): string {
  if (status === "running") return "text-emerald-400";
  if (status === "starting") return "text-amber-400";
  return "text-[#666]";
}

function workforceStatus(runtime: CadreRuntime): string {
  if (runtime.status === "starting") return "Starting";
  if (runtime.status === "stopped") return "Idle";
  if (runtime.readiness === "ready") return "Ready";
  if (runtime.readiness === "blocked_auth" || runtime.readiness === "blocked_update_prompt") {
    return "Blocked";
  }
  if (runtime.readiness === "errored") return "Error";
  return formatCadreReadinessLabel(runtime.readiness);
}

function WorkforceRow({
  runtime,
  selected,
  onSelect,
}: {
  runtime: CadreRuntime;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = readinessTone(runtime.readiness);
  const assignment =
    runtime.status === "running"
      ? runtime.readinessReason || "Observing terminal host"
      : "Awaiting assignment";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border px-3 py-2 text-left font-mono text-[10px] tracking-[0.06em] transition-colors",
        selected
          ? "border-emerald-500/50 bg-emerald-950/20"
          : "border-[#1a1a1a] bg-black hover:border-[#2a2a2a]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#ddd]">{runtime.name}</span>
        <span className={statusClass(runtime.status)}>{workforceStatus(runtime)}</span>
      </div>
      <div className="mt-1 text-[8px] leading-relaxed text-[#777]">{assignment}</div>
      {runtime.status === "running" ? (
        <div
          className={cn(
            "mt-1 text-[8px] tracking-[0.06em]",
            tone === "good"
              ? "text-emerald-400/80"
              : tone === "warn"
                ? "text-amber-400/80"
                : tone === "bad"
                  ? "text-red-400/80"
                  : "text-[#666]",
          )}
        >
          VERIFY: {formatCadreReadinessLabel(runtime.readiness)}
        </div>
      ) : null}
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
                WORKFORCE VISIBILITY // ACTIVITY STREAM
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
              <div className="mt-1 text-[8px] text-[#666]">ORCHESTRATOR // COMMAND SURFACE</div>
            </div>

            <div className="font-mono text-[9px] tracking-[0.1em] text-[#666]">[ CADRE WORKFORCE ]</div>
            <div className="custom-scrollbar flex min-h-0 max-h-56 flex-col gap-2 overflow-y-auto lg:max-h-none lg:flex-1">
              {loading ? (
                <div className="font-mono text-[10px] text-[#666]">LOADING WORKFORCE…</div>
              ) : (
                runtimes.map((runtime) => (
                  <WorkforceRow
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

            <CadreActivityStream />

            <div className="rounded-sm border border-[#1c1c1c] bg-[#050505]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[9px] tracking-[0.08em] text-[#888] hover:text-[#bbb]"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((value) => !value)}
              >
                <span>ADVANCED DIAGNOSTICS</span>
                <span>{advancedOpen ? "▼" : "▶"}</span>
              </button>

              {advancedOpen ? (
                <div className="space-y-2 border-t border-[#141414] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CyberdeckControl
                      control={{ size: "wide", signal: true }}
                      disabled={
                        !selectedRuntime ||
                        busyId === selectedRuntime.id ||
                        selectedRuntime.status === "running"
                      }
                      onClick={() => selectedRuntime && void startRuntime(selectedRuntime.id)}
                    >
                      START
                    </CyberdeckControl>
                    <CyberdeckControl
                      control={{ size: "wide", danger: true }}
                      disabled={
                        !selectedRuntime ||
                        busyId === selectedRuntime.id ||
                        selectedRuntime.status === "stopped"
                      }
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
                          {selectedRuntime.name} // {selectedRuntime.status.toUpperCase()} // UPTIME{" "}
                          {formatCadreUptime(selectedRuntime.startedAt)}
                        </span>
                        {selectedRuntime.pid ? (
                          <span className="text-[8px] text-[#555]">PID {selectedRuntime.pid}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-h-[160px] flex-col rounded-sm border border-[#1c1c1c] bg-[#030303]">
                    <div className="border-b border-[#141414] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#666]">
                      TERMINAL OUTPUT // {selectedRuntime?.name ?? "—"}
                    </div>
                    <pre className="custom-scrollbar min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[10px] leading-snug text-[#9a9a9a]">
                      {terminalText || "No terminal output for the selected agent."}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CyberdeckCadrePaneBody;
