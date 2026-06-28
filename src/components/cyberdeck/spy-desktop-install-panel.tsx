"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
  type SpySubPane,
} from "@/lib/cyberdeck/espionage-mode";
import {
  fetchDesktopInstallInfo,
  isEchoMirageDesktopShell,
  isPwaStandaloneSession,
  openDesktopCyberdeckApp,
  openDesktopInstaller,
  probeLocalDesktopShell,
  promptPwaInstall,
  subscribePwaInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/electron/desktop-install.client";

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function spyInstallHint(activeSubPane: SpySubPane): string {
  switch (activeSubPane) {
    case "echo":
      return `${ESPIONAGE_ECHO_DISPLAY} capture, pairing codes, and the silent relay require the desktop cyberdeck — not a hosted PWA or browser tab.`;
    case "mirage":
      return `${ESPIONAGE_MIRAGE_DISPLAY} can pair from PWA, but the desktop cyberdeck is recommended on the solver laptop for MUTHUR, hub QRs, and local disk.`;
    case "powerfist":
      return isMobileUserAgent()
        ? `${ESPIONAGE_POWERFIST_LABEL} runs on your phone — install the PWA for quick access, or use the mobile browser.`
        : `${ESPIONAGE_POWERFIST_LABEL} pairs from any device. Install the desktop cyberdeck if this machine is ${ESPIONAGE_ECHO_DISPLAY} or ${ESPIONAGE_MIRAGE_DISPLAY}.`;
    default: {
      const exhaustive: never = activeSubPane;
      return exhaustive;
    }
  }
}

type SpyDesktopInstallPanelProps = {
  activeSubPane: SpySubPane;
};

/** Spy tab — install/open desktop cyberdeck (and PWA when offered) outside the desktop shell. */
export function SpyDesktopInstallPanel({ activeSubPane }: SpyDesktopInstallPanelProps) {
  const [info, setInfo] = useState<DesktopInstallInfo | null>(null);
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

    void Promise.all([fetchDesktopInstallInfo(), probeLocalDesktopShell()])
      .then(([installInfo, probe]) => {
        setInfo(installInfo);
        setLocalShell(probe);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isEchoMirageDesktopShell()) return;
    return subscribePwaInstallPrompt((event) => setPwaPrompt(event));
  }, []);

  const handleInstallDesktop = useCallback(() => {
    if (!info) {
      window.open(
        "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/latest",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    openDesktopInstaller(info);
  }, [info]);

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
        <p className="font-mono text-[9px] tracking-[0.04em] text-[#5f5f5f]">Checking desktop cyberdeck…</p>
      </div>
    );
  }

  const installLabel = info?.installerAvailable
    ? "Install desktop cyberdeck"
    : "Download desktop installer";
  const platformLabel =
    info?.platform === "mac" ? "macOS" : info?.platform === "win" ? "Windows" : "desktop";
  const accentClass =
    activeSubPane === "echo"
      ? "border-cyan-950/50 bg-cyan-950/10"
      : activeSubPane === "mirage"
        ? "border-fuchsia-950/40 bg-fuchsia-950/10"
        : "border-amber-950/40 bg-amber-950/10";

  return (
    <div className={`border-b border-[#1c1c1c] px-4 py-3 font-mono ${accentClass}`}>
      <p className="mb-1 text-[9px] tracking-[0.08em] text-[#9a9a9a]">
        {ESPIONAGE_MODE_TITLE} // setup
      </p>
      <p className="mb-3 text-[8px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
        {spyInstallHint(activeSubPane)}
        {isPwaStandaloneSession() ? " You are in the installed PWA shell." : null}
      </p>

      {showDesktopActions && localShell?.shell ? (
        <p className="mb-2 text-[9px] text-emerald-300/80">Desktop cyberdeck detected on this machine.</p>
      ) : null}
      {showDesktopActions && localShell?.running && !localShell.shell ? (
        <p className="mb-2 text-[9px] text-[#8a8a8a]">
          Local server running — open the desktop app for full Spy features.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showDesktopActions ? (
          <>
            <CyberdeckActionButton variant="accent" onClick={handleOpenDesktop}>
              Open desktop cyberdeck
            </CyberdeckActionButton>
            <CyberdeckActionButton onClick={handleInstallDesktop}>
              {info?.supported ? installLabel : "View releases"}
            </CyberdeckActionButton>
          </>
        ) : null}
        {pwaPrompt ? (
          <CyberdeckActionButton variant={showDesktopActions ? undefined : "accent"} onClick={() => void handleInstallPwa()}>
            Install PWA
          </CyberdeckActionButton>
        ) : null}
      </div>

      {showDesktopActions && info?.fileName ? (
        <p className="mt-2 text-[8px] tracking-[0.04em] text-[#5f5f5f]">
          Latest {platformLabel} build · v{info.version}
        </p>
      ) : null}
      {showDesktopActions && info?.statusMessage ? (
        <p className="mt-2 text-[8px] leading-relaxed text-[#6a5a40]">{info.statusMessage}</p>
      ) : null}
      {status ? <p className="mt-2 text-[9px] text-emerald-300/80">{status}</p> : null}
    </div>
  );
}
