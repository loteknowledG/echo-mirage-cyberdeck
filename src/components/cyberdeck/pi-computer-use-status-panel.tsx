"use client";

import { useEffect, useState } from "react";
import type { PiComputerUseStatus } from "@/lib/pi/pi-computer-use-types";
import {
  detectOperatorPlatform,
  describeHostOperatorMismatch,
} from "@/lib/pi/pi-operator-platform";
import { formatPiPlatformLabel } from "@/lib/pi/pi-platform-resolver";
import { cn } from "@/lib/utils";

type PiComputerUseStatusPanelProps = {
  className?: string;
};

function capabilityMark(enabled: boolean): string {
  return enabled ? "✓" : "—";
}

function formatBackendLabel(backend: PiComputerUseStatus["backend"]): string {
  switch (backend) {
    case "synapse":
      return "synapse";
    case "windows-use":
      return "windows-use";
    case "pi-computer-use":
      return "pi-computer-use";
    default:
      return "none";
  }
}

function formatReadinessLabel(status: PiComputerUseStatus["status"]): string {
  switch (status) {
    case "NOT_INSTALLED":
      return "NOT INSTALLED";
    case "FAILED":
      return "FAILED";
    default:
      return status;
  }
}

function readinessClassName(status: PiComputerUseStatus["status"]): string {
  switch (status) {
    case "READY":
      return "text-emerald-300/90";
    case "NOT_INSTALLED":
    case "FAILED":
      return "text-amber-200/85";
    case "SCAFFOLD":
      return "text-amber-200/85";
    default:
      return "text-[#9a9a9a]";
  }
}

export function PiComputerUseStatusPanel({ className }: PiComputerUseStatusPanelProps) {
  const [status, setStatus] = useState<PiComputerUseStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const operatorPlatform = detectOperatorPlatform();

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/pi-computer-use/status", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Status request failed (${response.status})`);
        }
        const payload = (await response.json()) as PiComputerUseStatus;
        if (!cancelled) {
          setStatus(payload);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load PI status");
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const hostPlatform = status?.hostPlatform ?? status?.platform;
  const hostLabel = hostPlatform ? formatPiPlatformLabel(hostPlatform) : "…";
  const operatorLabel = formatPiPlatformLabel(operatorPlatform);
  const readinessLabel = status ? formatReadinessLabel(status.status) : "…";
  const backendLabel = status ? formatBackendLabel(status.backend) : "…";
  const hostMismatchNote =
    hostPlatform && describeHostOperatorMismatch(hostPlatform, operatorPlatform);

  const collapsedSummary = loadError
    ? loadError
    : `Status: ${readinessLabel} · Host: ${hostLabel} · Backend: ${backendLabel}`;

  return (
    <section
      className={cn(
        "rounded-sm border border-[#1c1c1c] bg-black/80 px-3 py-2 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#8a8a8a]",
        className,
      )}
      aria-label="PI computer use status"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left font-mono text-[10px] text-amber-500/90 hover:text-amber-400"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span className="uppercase tracking-[0.16em]">PI Computer Use</span>
        {!expanded ? (
          <span className="truncate text-[#9a9a9a]"> · {collapsedSummary}</span>
        ) : null}
      </button>

      {expanded ? (
        loadError ? (
          <div className="mt-2 text-amber-200/85">{loadError}</div>
        ) : (
          <div className="mt-2 space-y-0.5">
            <div>
              Host (Node): <span className="text-emerald-300/90">{hostLabel}</span>
            </div>
            <div>
              Operator: <span className="text-[#bdbdbd]">{operatorLabel}</span>
            </div>
            <div>
              Backend: <span className="text-[#bdbdbd]">{backendLabel}</span>
            </div>
            <div>
              Status:{" "}
              <span className={readinessClassName(status?.status ?? "UNAVAILABLE")}>
                {readinessLabel}
              </span>
            </div>

            <div className="pt-0.5">
              Capabilities:
              <div className="pl-2">
                <div>
                  {capabilityMark(status?.capabilities.screenshot ?? false)} Screenshot
                </div>
                <div>
                  {capabilityMark(status?.capabilities.activeWindow ?? false)} Active Window
                </div>
                <div>{capabilityMark(status?.capabilities.mouse ?? false)} Mouse</div>
                <div>{capabilityMark(status?.capabilities.keyboard ?? false)} Keyboard</div>
                <div>{capabilityMark(status?.capabilities.scroll ?? false)} Scroll</div>
              </div>
            </div>

            {hostMismatchNote ? (
              <div className="pt-1 text-amber-200/80">{hostMismatchNote}</div>
            ) : null}

            {status?.lastError ? (
              <div className="pt-1 text-amber-200/80">Error: {status.lastError}</div>
            ) : null}

            {status?.remediation ? (
              <div className="pt-1 text-[#6f6f6f]">
                Remediation:{" "}
                <span className="text-[#bdbdbd]">{status.remediation}</span>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  );
}
