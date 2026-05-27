'use client';

import { useEffect, useRef, useState } from "react";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { useMuthurExecutionRuntime } from "@/lib/muthur/execution/use-muthur-execution-runtime";
import type { MuthurAction, MuthurExecutionMode } from "@/lib/muthur/execution/execution-types";
import { MUTHUR_EXECUTION_MODES } from "@/lib/muthur/execution/execution-types";
import { useDeckMode, type DeckMode } from "@/lib/deck-mode";
import {
  realmorphismActionClass,
  realmorphismControlClass,
  realmorphismFilterClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

function formatElapsed(startedAt: string | null, heartbeatAt: string): string {
  if (!startedAt) return "—";
  const ms = new Date(heartbeatAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function statusTone(status: string, deckMode: DeckMode): string {
  if (deckMode === "realmorphism") {
    if (status === "completed" || status === "verified") return "realmorphism-glyph-latched";
    if (status === "running" || status === "awaiting_verification") return "realmorphism-ink-caution";
    if (status === "failed" || status === "unsupported" || status === "verification_failed") return "text-red-400";
    if (status === "blocked") return "realmorphism-ink-caution";
    if (status === "cancelled") return "realmorphism-ink-host-muted";
    return "realmorphism-ink-host";
  }
  if (status === "completed" || status === "verified") return "text-green-400";
  if (status === "running" || status === "awaiting_verification") return "text-yellow-300";
  if (status === "failed" || status === "unsupported" || status === "verification_failed") return "text-red-400";
  if (status === "blocked") return "text-orange-300";
  if (status === "cancelled") return "text-zinc-400";
  return "text-zinc-300";
}

function actionRowClass(deckMode: DeckMode): string {
  if (deckMode === "realmorphism") {
    return cn(
      "block w-full rounded-[var(--realmorphism-radius)] border px-3 py-2 font-mono text-[11px]",
      "border-[color:var(--realmorphism-face-border)] bg-[color:var(--realmorphism-face)]",
      "text-[color:var(--realmorphism-ink-on-face)] shadow-[var(--realmorphism-shadow-rest)]",
    );
  }
  return "border border-[#1f1f1f] bg-[#050505] px-3 py-2 font-mono text-[11px]";
}

function mutedInkClass(deckMode: DeckMode): string {
  return deckMode === "realmorphism" ? "realmorphism-ink-host-muted" : "text-zinc-500";
}

function bodyInkClass(deckMode: DeckMode): string {
  return deckMode === "realmorphism" ? "realmorphism-ink-host" : "text-zinc-400";
}

function accentInkClass(deckMode: DeckMode): string {
  return deckMode === "realmorphism" ? "realmorphism-glyph-latched" : "text-green-300";
}

function consoleErrorCount(action: MuthurAction): number | null {
  const verifyCheck = action.verification?.checks.find((check) => check.check === "no_console_errors");
  if (typeof verifyCheck?.metadata?.count === "number") return verifyCheck.metadata.count;
  if (typeof action.result?.metadata?.console_error_count === "number") {
    return action.result.metadata.console_error_count;
  }
  if (Array.isArray(action.result?.metadata?.errors)) {
    return action.result.metadata.errors.length;
  }
  return null;
}

function verificationBadge(action: MuthurAction): string | null {
  if (action.status === "verified") return "VERIFIED";
  if (action.status === "verification_failed") return "VERIFICATION FAILED";
  if (action.status === "awaiting_verification") return "AWAITING VERIFICATION";
  return null;
}

function screenshotFileName(action: MuthurAction): string | null {
  const pathValue =
    action.result?.screenshot_path ??
    action.verification?.evidence_paths?.[0] ??
    (typeof action.result?.metadata?.screenshot === "object" &&
    action.result.metadata.screenshot &&
    "screenshot_path" in action.result.metadata.screenshot
      ? String((action.result.metadata.screenshot as { screenshot_path?: string }).screenshot_path)
      : null);
  if (!pathValue) return null;
  const parts = pathValue.split(/[/\\]/);
  return parts[parts.length - 1] || null;
}

function ScreenshotPreview({ fileName, deckMode }: { fileName: string; deckMode: DeckMode }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = `/api/muthur/execution?screenshot=${encodeURIComponent(fileName)}`;
  return (
    <div className="mt-2">
      <button
        type="button"
        className={realmorphismControlClass(deckMode, {
          size: "compact",
          signal: true,
          legacyClassName: "text-cyan-300 underline hover:text-cyan-200",
        })}
        onClick={() => setOpen((value) => !value)}
      >
        Screenshot: {fileName}
      </button>
      {open ? (
        <div
          className={cn(
            "mt-2 border p-2",
            deckMode === "realmorphism"
              ? "rounded-[var(--realmorphism-radius-sm)] border-[color:var(--realmorphism-face-border)] bg-[color:var(--realmorphism-host)]"
              : "border-[#1f1f1f] bg-black",
          )}
        >
          {!loaded ? <div className={mutedInkClass(deckMode)}>Loading preview…</div> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Verification screenshot ${fileName}`}
            className="max-h-64 max-w-full"
            onLoad={() => setLoaded(true)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ActionRow({
  action,
  deckMode,
  onApprove,
  onDeny,
}: {
  action: MuthurAction;
  deckMode: DeckMode;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}) {
  const badge = verificationBadge(action);
  const consoleCount = consoleErrorCount(action);
  const screenshotName = screenshotFileName(action);
  const failedTextChecks = action.verification?.checks.filter(
    (check) => !check.passed && check.check === "text_exists",
  );

  return (
    <div className={actionRowClass(deckMode)}>
      <div className="flex items-center justify-between gap-2">
        <span className={accentInkClass(deckMode)}>{action.type}</span>
        <span className={statusTone(action.status, deckMode)}>{action.status.toUpperCase()}</span>
      </div>
      {badge ? (
        <div className={`mt-1 ${action.status === "verified" ? statusTone("verified", deckMode) : "text-red-400"}`}>
          [ {badge} ]
        </div>
      ) : null}
      {consoleCount !== null ? (
        <div className={cn("mt-1", bodyInkClass(deckMode))}>Console: {consoleCount} errors</div>
      ) : null}
      {failedTextChecks && failedTextChecks.length > 0 ? (
        <div className="mt-1 text-red-300">
          {failedTextChecks.map((check) => (
            <div key={`${action.id}-${check.message}`}>Missing text: {check.message}</div>
          ))}
        </div>
      ) : null}
      {screenshotName ? <ScreenshotPreview fileName={screenshotName} deckMode={deckMode} /> : null}
      <div className={cn("mt-1", mutedInkClass(deckMode))}>{action.id.slice(0, 8)} · {action.source}</div>
      <pre className={cn("mt-2 max-h-24 overflow-auto whitespace-pre-wrap", bodyInkClass(deckMode))}>
        {JSON.stringify(action.payload, null, 2)}
      </pre>
      {action.result ? (
        <div className={cn("mt-2", bodyInkClass(deckMode))}>
          {action.result.success ? "PASS" : "FAIL"} · {action.result.duration_ms}ms
          {action.result.stdout ? `\n${action.result.stdout.slice(0, 400)}` : ""}
          {action.result.stderr ? `\n${action.result.stderr.slice(0, 200)}` : ""}
        </div>
      ) : null}
      {action.verification ? (
        <div className={cn("mt-2", bodyInkClass(deckMode))}>
          VERIFY {action.verification.passed ? "PASS" : "FAIL"}
          {action.verification.checks.map((check) => (
            <div key={`${action.id}-${check.check}`}>
              {check.passed ? "PASS" : "FAIL"} {check.check}: {check.message}
            </div>
          ))}
        </div>
      ) : null}
      {action.receipt_path ? (
        <div className={cn("mt-1", mutedInkClass(deckMode))}>Receipt: {action.receipt_path}</div>
      ) : null}
      {action.error ? <div className="mt-1 text-red-400">{action.error}</div> : null}
      {action.status === "blocked" && onApprove && onDeny ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={realmorphismActionClass(deckMode, "accent")}
            onClick={() => onApprove(action.id)}
          >
            APPROVE
          </button>
          <button
            type="button"
            className={realmorphismActionClass(deckMode, "danger")}
            onClick={() => onDeny(action.id)}
          >
            DENY
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CyberdeckMuthurExecutionPaneBody() {
  const deckMode = useDeckMode();
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [paneVisible, setPaneVisible] = useState(true);
  const { state, stop, pause, resume, clearQueue, approve, deny, setMode } = useMuthurExecutionRuntime(800, paneVisible);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setPaneVisible(Boolean(entry?.isIntersecting && entry.intersectionRect.height > 0 && entry.intersectionRect.width > 0));
    });

    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  const loopStatus = state?.loop_status ?? "idle";
  const mode = state?.execution_mode ?? "observe";
  const queue = state?.queue ?? [];
  const active = state?.active_action;
  const completed = [...(state?.completed_actions ?? [])].reverse().slice(0, 12);

  return (
    <div
      ref={paneRef}
      className={cn(
        "custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3",
        deckMode === "realmorphism" ? "bg-[color:var(--realmorphism-host)]" : "bg-black text-green-200",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-colors",
          deckMode === "realmorphism"
            ? "rounded-[var(--realmorphism-radius)] border border-[color:var(--realmorphism-face-border)] bg-[color:var(--realmorphism-host-raised)]"
            : "bg-black",
        )}
      >
        <CyberdeckPaneHeader
          left={<CyberdeckPaneHeaderTitle>MUTHUR EXECUTION</CyberdeckPaneHeaderTitle>}
        />

        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2",
            deckMode === "realmorphism" ? "border-[color:var(--realmorphism-face-border)]" : "border-[#141414]",
          )}
        >
          <span className={cn("font-mono text-[11px]", mutedInkClass(deckMode))}>MODE</span>
          {MUTHUR_EXECUTION_MODES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void setMode(item as MuthurExecutionMode)}
              className={realmorphismFilterClass(deckMode, mode === item, "signal")}
              aria-pressed={mode === item}
            >
              {item.toUpperCase()}
            </button>
          ))}
          <span className={cn("ml-auto font-mono text-[11px]", mutedInkClass(deckMode))}>
            LOOP {loopStatus.toUpperCase()} · ELAPSED {formatElapsed(state?.started_at ?? null, state?.heartbeat_at ?? new Date().toISOString())}
          </span>
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-wrap gap-2 border-b px-3 py-2",
            deckMode === "realmorphism" ? "border-[color:var(--realmorphism-face-border)]" : "border-[#141414]",
          )}
        >
          <button
            type="button"
            className={realmorphismActionClass(deckMode, "danger")}
            onClick={() => void stop()}
          >
            STOP
          </button>
          <button
            type="button"
            className={realmorphismControlClass(deckMode, {
              size: "action",
              amber: true,
              legacyClassName:
                "rounded border border-yellow-700 px-3 py-1 font-mono text-[11px] text-yellow-200",
            })}
            onClick={() => void pause()}
          >
            PAUSE
          </button>
          <button
            type="button"
            className={realmorphismActionClass(deckMode, "accent")}
            onClick={() => void resume()}
          >
            RESUME
          </button>
          <button
            type="button"
            className={realmorphismActionClass(deckMode, "neutral")}
            onClick={() => void clearQueue()}
          >
            CLEAR QUEUE
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <section className="mb-4">
            <h3 className={cn("mb-2 font-mono text-[11px] uppercase tracking-wide", mutedInkClass(deckMode))}>Active</h3>
            {active ? (
              <ActionRow action={active} deckMode={deckMode} />
            ) : (
              <div className={cn("font-mono text-[11px]", mutedInkClass(deckMode))}>No action running.</div>
            )}
          </section>

          <section className="mb-4">
            <h3 className={cn("mb-2 font-mono text-[11px] uppercase tracking-wide", mutedInkClass(deckMode))}>
              Queue ({queue.length})
            </h3>
            {queue.length === 0 ? (
              <div className={cn("font-mono text-[11px]", mutedInkClass(deckMode))}>Queue empty.</div>
            ) : (
              <div className="space-y-2">
                {queue.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    deckMode={deckMode}
                    onApprove={(id) => void approve(id)}
                    onDeny={(id) => void deny(id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className={cn("mb-2 font-mono text-[11px] uppercase tracking-wide", mutedInkClass(deckMode))}>Recent results</h3>
            {state?.last_verification ? (
              <div className={cn("mb-2 font-mono text-[11px]", bodyInkClass(deckMode))}>
                LAST VERIFY: {state.last_verification.passed ? "PASS" : "FAIL"} (
                {state.last_verification.checks.filter((check) => check.passed).length}/
                {state.last_verification.checks.length})
              </div>
            ) : null}
            {state?.last_error ? (
              <div className="mb-2 font-mono text-[11px] text-red-400">LAST ERROR: {state.last_error}</div>
            ) : null}
            {completed.length === 0 ? (
              <div className={cn("font-mono text-[11px]", mutedInkClass(deckMode))}>No completed actions yet.</div>
            ) : (
              <div className="space-y-2">
                {completed.map((action) => (
                  <ActionRow key={`${action.id}-${action.completed_at ?? action.created_at}`} action={action} deckMode={deckMode} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CyberdeckMuthurExecutionPaneBody;
