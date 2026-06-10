"use client";

import { useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { CyberdeckFilterButton } from "@/components/cyberdeck/cyberdeck-control-button";
import type { MuthurAction, MuthurActionStatus } from "@/lib/muthur/execution/execution-types";
import { useMuthurExecutionRuntime } from "@/lib/muthur/execution/use-muthur-execution-runtime";
import { useMuthurPersistentRuntime } from "@/lib/muthur/runtime/use-muthur-persistent-runtime";
import { cn } from "@/lib/utils";

function screenshotPreviewUrl(filePath: string | undefined): string | null {
  if (!filePath) return null;
  const name = filePath.split(/[/\\]/).pop();
  if (!name) return null;
  return `/api/muthur/screenshot?name=${encodeURIComponent(name)}`;
}

function statusBadgeClass(status: MuthurActionStatus | string): string {
  switch (status) {
    case "verified":
      return "border-emerald-500/50 bg-emerald-950/30 text-emerald-200";
    case "verification_failed":
    case "failed":
      return "border-red-500/50 bg-red-950/30 text-red-200";
    case "completed":
      return "border-emerald-700/40 bg-emerald-950/20 text-emerald-300";
    case "running":
    case "awaiting_verification":
      return "border-amber-500/50 bg-amber-950/25 text-amber-200";
    case "unsupported":
    case "blocked":
    case "cancelled":
      return "border-[#333] bg-[#111] text-[#888]";
    default:
      return "border-[#2a2a2a] bg-[#0d0d0d] text-[#aaa]";
  }
}

function statusLabel(status: MuthurActionStatus | string): string {
  if (status === "verified") return "[ VERIFIED ]";
  if (status === "verification_failed") return "[ VERIFICATION FAILED ]";
  return `[ ${String(status).replace(/_/g, " ").toUpperCase()} ]`;
}

function consoleErrorCount(action: MuthurAction | null | undefined): number {
  const meta = action?.result?.metadata;
  if (!meta || typeof meta !== "object") return 0;
  const count = (meta as { console_error_count?: number }).console_error_count;
  if (typeof count === "number") return count;
  const entries = (meta as { entries?: unknown[] }).entries;
  if (Array.isArray(entries)) {
    return entries.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      return (entry as { severity?: string }).severity === "error";
    }).length;
  }
  return 0;
}

function ActionRow({
  action,
  selected,
  onSelect,
}: {
  action: MuthurAction;
  selected: boolean;
  onSelect: () => void;
}) {
  const consoleErrors = consoleErrorCount(action);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border px-2 py-1.5 text-left font-mono text-[9px] tracking-wide transition-colors",
        selected
          ? "border-emerald-500/50 bg-emerald-950/20"
          : "border-[#1a1a1a] bg-black hover:border-[#2a2a2a]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-sm border px-1 py-0.5", statusBadgeClass(action.status))}>
          {statusLabel(action.status)}
        </span>
        <span className="text-emerald-300/90">{action.type}</span>
        {consoleErrors > 0 ? (
          <span className="text-red-300">console {consoleErrors}</span>
        ) : (
          <span className="text-[#666]">console 0</span>
        )}
      </div>
      <div className="mt-1 truncate text-[#777]">
        {action.error ||
          action.result?.verification_notes ||
          action.result?.stderr ||
          action.receipt_path ||
          action.id}
      </div>
    </button>
  );
}

function runtimePostureBadgeClass(posture: string | undefined): string {
  switch (posture) {
    case "watch":
      return "border-emerald-500/50 bg-emerald-950/30 text-emerald-200";
    case "patrol":
      return "border-amber-500/50 bg-amber-950/25 text-amber-200";
    case "stopped":
      return "border-red-500/50 bg-red-950/30 text-red-200";
    default:
      return "border-[#333] bg-[#111] text-[#888]";
  }
}

export function MuthurExecutionPaneBody() {
  const {
    state,
    error,
    busy,
    setMode,
    stop,
    clearQueue,
    resetSession,
    verifyRoute,
  } = useMuthurExecutionRuntime();
  const {
    state: runtimeState,
    error: runtimeError,
    busy: runtimeBusy,
    startWatch,
    stopWatch,
    patrolNow,
  } = useMuthurPersistentRuntime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const recentActions = useMemo(() => {
    const list = [...(state?.completed_actions ?? [])];
    if (state?.active_action) list.push(state.active_action);
    return list.slice(-16).reverse();
  }, [state?.active_action, state?.completed_actions]);

  const selectedAction =
    recentActions.find((action) => action.id === selectedId) ?? recentActions[0] ?? null;

  const lastVerification = state?.last_verification;
  const verificationBadge = lastVerification
    ? lastVerification.passed
      ? "verified"
      : "verification_failed"
    : null;

  const previewUrl = screenshotPreviewUrl(
    selectedAction?.result?.screenshot_path ??
      (selectedAction?.verification?.evidence_paths?.[0] as string | undefined),
  );

  const loopLabel = state?.loop_status?.toUpperCase() ?? "UNKNOWN";
  const modeLabel = state?.execution_mode?.toUpperCase() ?? "OBSERVE";
  const queueLength = state?.queue_length ?? 0;

  const runVerify = async (route: string) => {
    await verifyRoute(route, `ui-verify-${route.replace(/\W+/g, "_")}`);
  };

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle>MUTHUR EXECUTION</CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                PERSISTENT RUNTIME // BROWSER PROOF
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="flex flex-wrap items-center justify-end gap-1">
              {verificationBadge ? (
                <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[9px]", statusBadgeClass(verificationBadge))}>
                  {statusLabel(verificationBadge)}
                </span>
              ) : (
                <span className="font-mono text-[9px] text-[#666]">[ NO PROOF YET ]</span>
              )}
            </div>
          }
        />

        <div className="space-y-3 border-b border-[#141414] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wide text-[#777]">Runtime</span>
            <span
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[9px]",
                runtimePostureBadgeClass(runtimeState?.posture),
              )}
            >
              [ {(runtimeState?.posture ?? "standby").toUpperCase()} ]
            </span>
            {runtimeState?.watch_enabled ? (
              <span className="font-mono text-[9px] text-emerald-300">WATCH ON</span>
            ) : (
              <span className="font-mono text-[9px] text-[#666]">WATCH OFF</span>
            )}
            {runtimeState?.patrol_in_flight ? (
              <span className="font-mono text-[9px] text-amber-300">PATROL RUNNING</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1">
            {runtimeState?.watch_enabled ? (
              <CyberdeckActionButton disabled={runtimeBusy} onClick={() => void stopWatch()}>
                STOP WATCH
              </CyberdeckActionButton>
            ) : (
              <CyberdeckActionButton variant="accent" disabled={runtimeBusy} onClick={() => void startWatch()}>
                START WATCH
              </CyberdeckActionButton>
            )}
            <CyberdeckActionButton disabled={runtimeBusy || busy} onClick={() => void patrolNow()}>
              PATROL NOW
            </CyberdeckActionButton>
          </div>

          {runtimeState?.last_patrol ? (
            <div className="space-y-1 font-mono text-[9px]">
              <div className={runtimeState.last_patrol.passed ? "text-emerald-300" : "text-red-300"}>
                LAST PATROL // {runtimeState.last_patrol.passed ? "PASS" : "FAIL"} //{" "}
                {runtimeState.last_patrol.checks.map((check) => check.check).join(" + ")}
              </div>
              {runtimeState.last_patrol.receipt_path ? (
                <div className="truncate text-[#777]">RECEIPT // {runtimeState.last_patrol.receipt_path}</div>
              ) : null}
            </div>
          ) : (
            <div className="font-mono text-[9px] text-[#666]">
              No patrol yet. START WATCH or PATROL NOW to run tsc + /cyberdeck verify outside chat.
            </div>
          )}

          <div className="flex flex-wrap gap-2 font-mono text-[9px] tracking-wide text-[#8a8a8a]">
            <span>LOOP // {loopLabel}</span>
            <span>MODE // {modeLabel}</span>
            <span>QUEUE // {queueLength}</span>
            {state?.current_task ? <span>TASK // {state.current_task}</span> : null}
            {runtimeState ? <span>PATROLS // {runtimeState.patrol_count}</span> : null}
          </div>

          {runtimeError ? <div className="font-mono text-[9px] text-red-300">{runtimeError}</div> : null}
          {error ? <div className="font-mono text-[9px] text-red-300">{error}</div> : null}
          {state?.last_error ? (
            <div className="font-mono text-[9px] text-red-300/90">LAST ERROR // {state.last_error}</div>
          ) : null}

          <div className="flex flex-wrap gap-1">
            <CyberdeckActionButton variant="accent" disabled={busy} onClick={() => void runVerify("/cyberdeck")}>
              VERIFY /cyberdeck
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={busy} onClick={() => void runVerify("/preview")}>
              VERIFY /preview
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={busy} onClick={() => void stop()}>
              STOP
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={busy} onClick={() => void resetSession()}>
              RESET
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={busy} onClick={() => void clearQueue()}>
              CLEAR Q
            </CyberdeckActionButton>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[9px] text-[#666]">MODE</span>
            {(["observe", "suggest", "execute"] as const).map((mode) => (
              <CyberdeckFilterButton
                key={mode}
                active={state?.execution_mode === mode}
                tone={mode === "execute" ? "amber" : "signal"}
                disabled={busy}
                onClick={() => void setMode(mode)}
              >
                {mode.toUpperCase()}
              </CyberdeckFilterButton>
            ))}
          </div>
        </div>

        {lastVerification ? (
          <div className="border-b border-[#141414] px-3 py-2">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-[#777]">
              Last verification checks
            </div>
            <div className="space-y-1">
              {lastVerification.checks.map((check) => (
                <div
                  key={`${check.check}-${check.message}`}
                  className={cn(
                    "font-mono text-[9px]",
                    check.passed ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {check.passed ? "PASS" : "FAIL"} // {check.check} // {check.message}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-[#777]">Action log</div>
            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {recentActions.length === 0 ? (
                <div className="font-mono text-[9px] text-[#666]">
                  No actions yet. Run VERIFY /cyberdeck to capture proof.
                </div>
              ) : (
                recentActions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    selected={selectedAction?.id === action.id}
                    onSelect={() => setSelectedId(action.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-[#777]">Screenshot</div>
              <CyberdeckFilterButton active={previewOpen} tone="signal" onClick={() => setPreviewOpen((v) => !v)}>
                {previewOpen ? "HIDE" : "SHOW"}
              </CyberdeckFilterButton>
            </div>
            {previewOpen && previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-sm border border-[#1f1f1f] bg-[#050505]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="MUTHUR verification screenshot" className="max-h-[40vh] w-full object-contain" />
              </a>
            ) : (
              <div className="flex min-h-[8rem] flex-1 items-center justify-center rounded-sm border border-dashed border-[#222] font-mono text-[9px] text-[#666]">
                {selectedAction ? "No screenshot for this action." : "Select an action."}
              </div>
            )}
            {selectedAction?.receipt_path ? (
              <div className="truncate font-mono text-[9px] text-[#777]">
                RECEIPT // {selectedAction.receipt_path}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
