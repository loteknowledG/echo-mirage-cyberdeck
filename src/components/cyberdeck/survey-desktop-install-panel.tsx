"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";
import type { ProbeInstallInfo } from "@/lib/electron/probe-install-info.server";
import type { SatelliteInstallInfo } from "@/lib/electron/satellite-install-info.server";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MODE_TITLE,
  SURVEY_POWERFIST_LABEL,
  type SurveySubPane,
} from "@/lib/cyberdeck/survey-mode";
import {
  fetchDesktopInstallInfo,
  fetchProbeInstallInfo,
  fetchSatelliteInstallInfo,
  isEchoMirageDesktopShell,
  isPwaStandaloneSession,
  openDesktopCyberdeckApp,
  openDesktopInstaller,
  openProbeInstaller,
  openSatelliteInstaller,
  PROBE_GITHUB_RELEASES_URL,
  probeLocalDesktopShell,
  SATELLITE_GITHUB_RELEASES_URL,
  promptPwaInstall,
  subscribePwaInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/electron/desktop-install.client";

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function spyInstallHint(activeSubPane: SurveySubPane): string {
  switch (activeSubPane) {
    case "echo":
      return `${SURVEY_ECHO_DISPLAY} is the lightweight local Echo agent for capture, browser bridging, background presence, and machine control. Install Echo Probe (Tauri, smaller) or Echo Satellite (Electron, full features). Hosted Mirage does not require the full desktop Cyberdeck.`;
    case "mirage":
      return `${SURVEY_MIRAGE_DISPLAY} runs fully as the hosted browser application. The bundled desktop Cyberdeck is optional for offline, self-hosted, development, or local-disk workflows.`;
    case "powerfist":
      return isMobileUserAgent()
        ? `${SURVEY_POWERFIST_LABEL} runs on your phone — install the PWA for quick access, or use the mobile browser.`
        : `${SURVEY_POWERFIST_LABEL} pairs from any device. Desktop-level capture and control require a paired ${SURVEY_ECHO_DISPLAY} Satellite; the full Cyberdeck remains optional.`;
    default: {
      const exhaustive: never = activeSubPane;
      return exhaustive;
    }
  }
}

type SurveyDesktopInstallPanelProps = {
  activeSubPane: SurveySubPane;
};

/** Canonical lifecycle surface for Echo Satellite plus the optional full desktop distribution. */
export function SurveyDesktopInstallPanel({ activeSubPane }: SurveyDesktopInstallPanelProps) {
  const echoPane = activeSubPane === "echo";
  const [desktopInfo, setDesktopInfo] = useState<DesktopInstallInfo | null>(null);
  const [satelliteInfo, setSatelliteInfo] = useState<SatelliteInstallInfo | null>(null);
  const [probeInfo, setProbeInfo] = useState<ProbeInstallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [localShell, setLocalShell] = useState<Awaited<ReturnType<typeof probeLocalDesktopShell>> | null>(
    null,
  );
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const mobilePowerfist = activeSubPane === "powerfist" && isMobileUserAgent();
  const showDesktopActions = !mobilePowerfist;

  useEffect(() => {
    if (isEchoMirageDesktopShell()) {
      setLoading(false);
      return;
    }

    void (async () => {
      const probe = await probeLocalDesktopShell();
      setLocalShell(probe);
      if (echoPane) {
        const [satellite, probe] = await Promise.all([
          fetchSatelliteInstallInfo(),
          fetchProbeInstallInfo(),
        ]);
        setSatelliteInfo(satellite);
        setProbeInfo(probe);
      } else {
        setDesktopInfo(await fetchDesktopInstallInfo());
      }
    })().finally(() => setLoading(false));
  }, [echoPane]);

  useEffect(() => {
    if (isEchoMirageDesktopShell()) return;
    return subscribePwaInstallPrompt((event) => setPwaPrompt(event));
  }, []);

  const handleInstallProbe = useCallback(() => {
    if (!probeInfo) {
      window.open(PROBE_GITHUB_RELEASES_URL, "_blank", "noopener,noreferrer");
      return;
    }
    openProbeInstaller(probeInfo);
  }, [probeInfo]);

  const handleInstallSatellite = useCallback(() => {
    if (!satelliteInfo) {
      window.open(SATELLITE_GITHUB_RELEASES_URL, "_blank", "noopener,noreferrer");
      return;
    }
    openSatelliteInstaller(satelliteInfo);
  }, [satelliteInfo]);

  const handleInstallDesktop = useCallback(() => {
    if (!desktopInfo) {
      window.open(
        "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/latest",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    openDesktopInstaller(desktopInfo);
  }, [desktopInfo]);

  const handleOpenDesktop = useCallback(() => {
    openDesktopCyberdeckApp({
      path: "/cyberdeck",
      localOrigin: localShell?.shell ? localShell.origin : null,
    });
    setStatus(
      localShell?.shell
        ? "Opening desktop cyberdeck…"
        : "Launching desktop cyberdeck… If nothing happens, install it first.",
    );
  }, [localShell]);

  const handleInstallPwa = useCallback(async () => {
    if (!pwaPrompt) return;
    const accepted = await promptPwaInstall(pwaPrompt);
    if (accepted) {
      setPwaPrompt(null);
      setStatus("PWA installed — open Echo Mirage from your home screen or app launcher.");
    }
  }, [pwaPrompt]);

  if (isEchoMirageDesktopShell()) {
    return null;
  }

  if (loading) {
    return (
      <div className="border-b border-[#1c1c1c] px-4 py-3">
        <p className="font-mono text-[9px] tracking-[0.04em] text-[#5f5f5f]">
          {echoPane ? "Checking Echo Probe / Satellite…" : "Checking desktop cyberdeck…"}
        </p>
      </div>
    );
  }

  const installInfo = echoPane ? satelliteInfo : desktopInfo;
  const installLabel = installInfo?.installerAvailable
    ? echoPane
      ? "Install or update Echo Satellite"
      : "Install optional desktop cyberdeck"
    : echoPane
      ? "Download Echo Satellite"
      : "Download desktop installer";
  const platformLabel =
    installInfo?.platform === "mac" ? "macOS" : installInfo?.platform === "win" ? "Windows" : "desktop";
  const accentClass =
    activeSubPane === "echo"
      ? "border-cyan-950/50 bg-cyan-950/10"
      : activeSubPane === "mirage"
        ? "border-fuchsia-950/40 bg-fuchsia-950/10"
        : "border-amber-950/40 bg-amber-950/10";

  return (
    <div className={`border-b border-[#1c1c1c] px-4 py-3 font-mono ${accentClass}`}>
      <p className="mb-1 text-[9px] tracking-[0.08em] text-[#9a9a9a]">
        {SURVEY_MODE_TITLE} // {echoPane ? "echo setup" : "optional distribution"}
      </p>
      <p className="mb-3 text-[8px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
        {spyInstallHint(activeSubPane)}
        {isPwaStandaloneSession() ? " You are in the installed PWA shell." : null}
      </p>

      {echoPane ? (
        <p className="mb-2 text-[8px] leading-relaxed text-[#5a5a5a]">
          Double-click the downloaded installer — Echo Probe (.dmg) or Echo Satellite (.pkg/.exe). Updates
          in place. Grant Screen Recording (macOS), pair via Mirage Echo QR on port{" "}
          <strong className="text-[#7a7a7a]">3050</strong>.
        </p>
      ) : null}

      {showDesktopActions && !echoPane && localShell?.shell ? (
        <p className="mb-2 text-[9px] text-emerald-300/80">Desktop cyberdeck detected on this machine.</p>
      ) : null}
      {showDesktopActions && !echoPane && localShell?.running && !localShell.shell ? (
        <p className="mb-2 text-[9px] text-[#8a8a8a]">
          Local server running — open the desktop app for full Spy features.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showDesktopActions ? (
          <>
            {echoPane ? (
              <>
                <CyberdeckActionButton variant="accent" onClick={handleInstallProbe}>
                  {probeInfo?.supported ? "Install Echo Probe (Tauri)" : "View probe releases"}
                </CyberdeckActionButton>
                <CyberdeckActionButton onClick={handleInstallSatellite}>
                  {satelliteInfo?.supported ? "Install Echo Satellite (Electron)" : "View satellite releases"}
                </CyberdeckActionButton>
              </>
            ) : (
              <>
                <CyberdeckActionButton variant="accent" onClick={handleOpenDesktop}>
                  Open desktop cyberdeck
                </CyberdeckActionButton>
                <CyberdeckActionButton onClick={handleInstallDesktop}>
                  {desktopInfo?.supported ? installLabel : "View releases"}
                </CyberdeckActionButton>
              </>
            )}
          </>
        ) : null}
        {pwaPrompt ? (
          <CyberdeckActionButton variant={showDesktopActions ? undefined : "accent"} onClick={() => void handleInstallPwa()}>
            Install PWA
          </CyberdeckActionButton>
        ) : null}
      </div>

      {showDesktopActions && echoPane && (probeInfo?.fileName || satelliteInfo?.fileName) ? (
        <p className="mt-2 text-[8px] tracking-[0.04em] text-[#5f5f5f]">
          Latest {platformLabel} builds · Probe v{probeInfo?.version ?? "—"} · Satellite v
          {satelliteInfo?.version ?? "—"}
        </p>
      ) : null}
      {showDesktopActions && !echoPane && installInfo?.fileName ? (
        <p className="mt-2 text-[8px] tracking-[0.04em] text-[#5f5f5f]">
          Latest {platformLabel} build · v{installInfo.version}
        </p>
      ) : null}
      {showDesktopActions && echoPane && (probeInfo?.statusMessage || satelliteInfo?.statusMessage) ? (
        <p className="mt-2 text-[8px] leading-relaxed text-[#6a5a40]">
          {probeInfo?.statusMessage ?? satelliteInfo?.statusMessage}
        </p>
      ) : null}
      {showDesktopActions && !echoPane && installInfo?.statusMessage ? (
        <p className="mt-2 text-[8px] leading-relaxed text-[#6a5a40]">{installInfo.statusMessage}</p>
      ) : null}
      {status ? <p className="mt-2 text-[9px] text-emerald-300/80">{status}</p> : null}
    </div>
  );
}
