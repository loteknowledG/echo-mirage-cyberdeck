"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SURVEY_MIRAGE_DISPLAY } from "@/lib/cyberdeck/survey-mode";
import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";
import {
  fetchDesktopInstallInfo,
  isEchoMirageDesktopShell,
  openDesktopCyberdeckApp,
  openDesktopInstaller,
  probeLocalDesktopShell,
} from "@/lib/electron/desktop-install.client";

/**
 * Always-visible Mirage strip: download packaged Electron (.exe/.dmg) or open desktop.
 * Shown even inside the desktop shell so operators can grab / update the installer.
 */
export function SurveyMirageDesktopLink() {
  const [info, setInfo] = useState<DesktopInstallInfo | null>(null);
  const [localShell, setLocalShell] = useState(false);
  const [inDesktopShell, setInDesktopShell] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setInDesktopShell(isEchoMirageDesktopShell());
    void (async () => {
      const [desktop, probe] = await Promise.all([
        fetchDesktopInstallInfo(),
        probeLocalDesktopShell(),
      ]);
      setInfo(desktop);
      setLocalShell(probe.shell);
    })();
  }, []);

  const handleDownload = useCallback(() => {
    if (!info) {
      window.open(
        "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/download/desktop-v0.1.4/Echo-Mirage-Cyberdeck-Setup-0.1.4.exe",
        "_blank",
        "noopener,noreferrer",
      );
      setStatus("Opening Mirage desktop installer…");
      return;
    }
    openDesktopInstaller(info);
    setStatus(
      info.installerAvailable
        ? `Downloading ${info.fileName ?? "Mirage desktop"}…`
        : "Opening desktop releases…",
    );
  }, [info]);

  const handleOpen = useCallback(() => {
    openDesktopCyberdeckApp({ path: "/cyberdeck" });
    setStatus(
      localShell || inDesktopShell
        ? "Desktop Mirage is this window (or opening another)…"
        : "Launching desktop Mirage… Install the .exe first if nothing opens.",
    );
  }, [inDesktopShell, localShell]);

  const downloadButtonLabel =
    info?.installerAvailable && info.platform === "mac"
      ? "Download Mirage desktop (.dmg)"
      : info?.installerAvailable
        ? "Download Mirage desktop (.exe)"
        : "Download Mirage desktop (.exe)";

  return (
    <section
      className="space-y-2 rounded border border-fuchsia-950/40 bg-fuchsia-950/10 p-3"
      aria-label="Mirage desktop installer"
      data-testid="survey-mirage-desktop-link"
    >
      <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">
        {SURVEY_MIRAGE_DISPLAY} // DESKTOP MVP
      </p>
      <p className="text-[8px] leading-relaxed text-[#6a6a6a]">
        {inDesktopShell
          ? "You are in the desktop shell. Download the published installer to install or update on another machine (or reinstall)."
          : "Packaged Electron Mirage talks Tailscale Echo without Vercel and without compiling this repo."}
      </p>
      <div className="flex flex-wrap gap-2">
        <CyberdeckActionButton
          variant="accent"
          onClick={handleDownload}
          data-testid="survey-mirage-download-desktop"
        >
          {downloadButtonLabel}
        </CyberdeckActionButton>
        {!inDesktopShell ? (
          <CyberdeckActionButton
            onClick={handleOpen}
            data-testid="survey-mirage-open-desktop"
          >
            Open desktop Mirage
          </CyberdeckActionButton>
        ) : null}
      </div>
      {info?.installerAvailable && info.fileName ? (
        <p className="text-[8px] text-[#5f5f5f]">
          Latest published · v{info.version} ·{" "}
          <a
            href={info.downloadUrl ?? info.releasePageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fuchsia-300/90 underline decoration-fuchsia-800/80 underline-offset-2"
          >
            {info.fileName}
          </a>
        </p>
      ) : (
        <p className="text-[8px] text-[#5f5f5f]">
          Direct:{" "}
          <a
            href="https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/download/desktop-v0.1.4/Echo-Mirage-Cyberdeck-Setup-0.1.4.exe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fuchsia-300/90 underline decoration-fuchsia-800/80 underline-offset-2"
          >
            Echo-Mirage-Cyberdeck-Setup-0.1.4.exe
          </a>
        </p>
      )}
      {info?.statusMessage ? (
        <p className="text-[8px] leading-relaxed text-[#6a5a40]">{info.statusMessage}</p>
      ) : null}
      {localShell || inDesktopShell ? (
        <p className="text-[8px] text-emerald-300/80">Desktop shell detected on this machine.</p>
      ) : null}
      {status ? <p className="text-[8px] text-cyan-200/80">{status}</p> : null}
    </section>
  );
}
