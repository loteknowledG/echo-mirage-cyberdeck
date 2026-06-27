"use client";

import { useCallback, useEffect, useState } from "react";

import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  checkForAppUpdate,
  fetchAppReleaseVersion,
  isDesktopAutoUpdateShell,
  promptForAppUpdate,
  restartAppForUpdate,
  syncRunningReleaseVersion,
  type AppUpdateCheckResult,
} from "@/lib/app-update-client";

function formatBuildLabel(version: string | null): string {
  if (!version) return "Unknown";
  if (version === "dev") return "Local development";
  return version;
}

function resultMessage(result: AppUpdateCheckResult): string {
  switch (result.status) {
    case "up-to-date":
      return "You're on the latest build.";
    case "update-available":
      return isDesktopAutoUpdateShell()
        ? "Update downloaded. Restart to install the new desktop build."
        : "A newer build is ready. Restart to load it.";
    case "unavailable":
      return "Could not reach the update server. Try again in a moment.";
    case "local-dev":
      return result.message;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export function SettingsAppUpdateSection() {
  const [runningVersion, setRunningVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<AppUpdateCheckResult | null>(null);

  useEffect(() => {
    const stored = syncRunningReleaseVersion();
    if (stored) {
      setRunningVersion(stored);
      return;
    }
    void fetchAppReleaseVersion().then((version) => {
      if (version) setRunningVersion(version);
    });
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    setChecking(true);
    setResult(null);
    try {
      const next = await checkForAppUpdate({ manual: true });
      setResult(next);
      if (next.status === "up-to-date" || next.status === "update-available") {
        setRunningVersion(next.running);
      }
      if (next.status === "update-available") {
        promptForAppUpdate(next.latest, { force: true });
      }
    } finally {
      setChecking(false);
    }
  }, []);

  const handleRestart = useCallback(() => {
    void restartAppForUpdate();
  }, []);

  const latestVersion =
    result?.status === "up-to-date" || result?.status === "update-available" ? result.latest : null;

  return (
    <section className="flex flex-col gap-2">
      <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">APP UPDATES</div>
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          {isDesktopAutoUpdateShell()
            ? "The desktop shell checks GitHub Releases for new installers, downloads them in the background, and installs on restart."
            : "Echo Mirage checks for new builds in the background. Use this if you want to check right now after a deploy."}
        </p>

        <div className="space-y-2 border-t border-[#1c1c1c] pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] text-[#5f5f5f]">RUNNING BUILD</span>
            <span className="truncate text-[9px] text-[#9a9a9a]">{formatBuildLabel(runningVersion)}</span>
          </div>
          {latestVersion ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] text-[#5f5f5f]">LATEST BUILD</span>
              <span className="truncate text-[9px] text-[#9a9a9a]">{formatBuildLabel(latestVersion)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1c1c1c] pt-3">
          <CyberdeckActionButton disabled={checking} onClick={() => void handleCheckForUpdates()}>
            {checking ? "CHECKING…" : "CHECK FOR UPDATES"}
          </CyberdeckActionButton>
          {result?.status === "update-available" ? (
            <CyberdeckActionButton variant="accent" onClick={handleRestart}>
              RESTART NOW
            </CyberdeckActionButton>
          ) : null}
        </div>

        {result ? (
          <p
            className={
              result.status === "update-available"
                ? "mt-3 text-[9px] tracking-[0.04em] text-[#8fd88f]"
                : "mt-3 text-[9px] tracking-[0.04em] text-[#5f5f5f]"
            }
          >
            {resultMessage(result)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
