"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";
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
import { ESPIONAGE_ECHO_DISPLAY } from "@/lib/cyberdeck/espionage-mode";

/** Echo Spy tab — install/open desktop cyberdeck when running in PWA or browser. */
export function EchoDesktopInstallPanel() {
  const [info, setInfo] = useState<DesktopInstallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [localShell, setLocalShell] = useState<Awaited<ReturnType<typeof probeLocalDesktopShell>> | null>(
    null,
  );
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
        ? "Opening desktop cyberdeck in your browser…"
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
      <div className="rounded border border-[#1c1c1c] bg-black/50 p-3">
        <p className="text-[9px] tracking-[0.04em] text-[#5f5f5f]">Checking desktop cyberdeck…</p>
      </div>
    );
  }

  const installLabel = info?.installerAvailable
    ? "Install desktop cyberdeck"
    : "Download desktop installer";
  const platformLabel =
    info?.platform === "mac" ? "macOS" : info?.platform === "win" ? "Windows" : "desktop";

  return (
    <div className="rounded border border-cyan-950/50 bg-cyan-950/10 p-3">
      <p className="mb-2 text-[9px] tracking-[0.08em] text-cyan-300/90">
        {ESPIONAGE_ECHO_DISPLAY} requires the desktop cyberdeck
      </p>
      <p className="mb-3 text-[8px] leading-relaxed text-[#5f5f5f]">
        Silent capture, pairing codes, and the capture relay only run in the installed desktop app —
        not in a hosted PWA or browser tab.
        {isPwaStandaloneSession() ? " You are in the installed PWA shell." : null}
      </p>

      {localShell?.shell ? (
        <p className="mb-3 text-[9px] text-emerald-300/80">
          Desktop cyberdeck detected on this machine.
        </p>
      ) : localShell?.running ? (
        <p className="mb-3 text-[9px] text-[#8a8a8a]">
          Local server running — open the desktop app for capture and tray relay.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <CyberdeckActionButton variant="accent" onClick={handleOpenDesktop}>
          Open desktop cyberdeck
        </CyberdeckActionButton>
        <CyberdeckActionButton onClick={handleInstallDesktop}>
          {info?.supported ? installLabel : "View releases"}
        </CyberdeckActionButton>
        {pwaPrompt ? (
          <CyberdeckActionButton onClick={() => void handleInstallPwa()}>
            Install PWA
          </CyberdeckActionButton>
        ) : null}
      </div>

      {info?.fileName ? (
        <p className="mt-2 text-[8px] tracking-[0.04em] text-[#5f5f5f]">
          Latest {platformLabel} build · v{info.version}
        </p>
      ) : null}
      {info?.statusMessage ? (
        <p className="mt-2 text-[8px] leading-relaxed text-[#6a5a40]">{info.statusMessage}</p>
      ) : null}
      {status ? <p className="mt-2 text-[9px] text-emerald-300/80">{status}</p> : null}
    </div>
  );
}
