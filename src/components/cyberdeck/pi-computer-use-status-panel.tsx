"use client";

import { useEffect, useState } from "react";
import type { PiComputerUseStatus } from "@/lib/pi/pi-computer-use-types";
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
    case "windows-use":
      return "windows-use";
    case "pi-computer-use":
      return "pi-computer-use";
    default:
      return "none";
  }
}

export function PiComputerUseStatusPanel({ className }: PiComputerUseStatusPanelProps) {
  const [status, setStatus] = useState<PiComputerUseStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const platformLabel = status ? formatPiPlatformLabel(status.platform) : "…";
  const computerUseLabel = status?.computerUse ?? "…";
  const backendLabel = status ? formatBackendLabel(status.backend) : "…";

  return (
    <section
      className={cn(
        "rounded-sm border border-[#1c1c1c] bg-black/80 px-3 py-2 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#8a8a8a]",
        className,
      )}
      aria-label="PI computer use status"
    >
      <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-emerald-300/75">
        PI STATUS
      </div>

      {loadError ? (
        <div className="text-amber-200/85">{loadError}</div>
      ) : (
        <div className="space-y-0.5">
          <div>
            Platform: <span className="text-emerald-300/90">{platformLabel}</span>
          </div>
          <div>
            Computer Use:{" "}
            <span
              className={
                computerUseLabel === "READY"
                  ? "text-emerald-300/90"
                  : computerUseLabel === "SCAFFOLD"
                    ? "text-amber-200/85"
                    : "text-[#9a9a9a]"
              }
            >
              {computerUseLabel}
            </span>
          </div>
          <div className="pt-0.5">
            Capabilities:
            <div className="pl-2">
              <div>
                {capabilityMark(status?.capabilities.screenshot ?? false)} Screenshot
              </div>
              <div>{capabilityMark(status?.capabilities.mouse ?? false)} Mouse</div>
              <div>{capabilityMark(status?.capabilities.keyboard ?? false)} Keyboard</div>
              <div>{capabilityMark(status?.capabilities.scroll ?? false)} Scroll</div>
            </div>
          </div>
          <div className="pt-0.5 text-[#6f6f6f]">
            Backend: <span className="text-[#bdbdbd]">{backendLabel}</span>
          </div>
        </div>
      )}
    </section>
  );
}
