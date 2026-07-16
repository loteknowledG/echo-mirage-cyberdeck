"use client";

import { useEffect, useState } from "react";
import {
  fetchAppReleaseVersion,
  syncRunningReleaseVersion,
} from "@/lib/app-update-client";
import {
  resolveSurveyCyberdeckShell,
  type SurveyCyberdeckShellInfo,
} from "@/lib/electron/desktop-install.client";

function resolveEnvironmentLabel(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "Local";
  }
  if (host === "vercel.app" || host.endsWith(".vercel.app")) {
    return "Vercel";
  }
  return "Hosted";
}

function formatVersionLabel(version: string | null): string {
  if (!version) return "Unknown";
  if (version === "dev") return "dev (local)";
  return version.startsWith("v") ? version : `v${version}`;
}

export function SettingsVersionSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [shell, setShell] = useState<SurveyCyberdeckShellInfo | null>(null);
  const [environment, setEnvironment] = useState("Local");

  useEffect(() => {
    setShell(resolveSurveyCyberdeckShell());
    setEnvironment(resolveEnvironmentLabel(window.location.hostname));

    const embedded = syncRunningReleaseVersion();
    if (embedded) {
      setVersion(embedded);
      return;
    }

    void fetchAppReleaseVersion().then((next) => {
      if (next) setVersion(next);
    });
  }, []);

  const runtimeLabel = shell?.kind === "desktop" ? "Electron" : shell?.label ?? "Browser";

  return (
    <section className="flex flex-col gap-2" data-testid="settings-version-section">
      <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">VERSION</div>
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-[#5f5f5f]">RUNNING</span>
            <span className="truncate text-[9px] font-semibold tracking-[0.08em] text-emerald-300/90">
              {formatVersionLabel(version)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-[#5f5f5f]">SHELL</span>
            <span className="truncate text-[9px] text-[#9a9a9a]">{runtimeLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-[#5f5f5f]">HOST</span>
            <span className="truncate text-[9px] text-[#9a9a9a]">{environment}</span>
          </div>
        </div>
        <p className="mt-3 border-t border-[#1c1c1c] pt-3 text-[8px] leading-relaxed text-[#5f5f5f]">
          Window title uses the same runtime label. Check APP UPDATES below for the latest published
          installer.
        </p>
      </div>
    </section>
  );
}
