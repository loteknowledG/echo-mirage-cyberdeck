"use client";

import { useCallback, useEffect, useState } from "react";

import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";
import {
  fetchDesktopInstallInfo,
  isEchoMirageDesktopShell,
  openDesktopInstaller,
} from "@/lib/electron/desktop-install.client";

type DesktopInstallCtaProps = {
  compact?: boolean;
};

export function DesktopInstallCta({ compact = false }: DesktopInstallCtaProps) {
  const [info, setInfo] = useState<DesktopInstallInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isEchoMirageDesktopShell()) {
      setLoading(false);
      return;
    }
    void fetchDesktopInstallInfo()
      .then((next) => setInfo(next))
      .finally(() => setLoading(false));
  }, []);

  const handleInstall = useCallback(() => {
    if (!info) return;
    openDesktopInstaller(info);
  }, [info]);

  const installLabel = info?.installerAvailable
    ? "INSTALL DESKTOP CYBERDECK"
    : "OPEN GITHUB RELEASES";

  if (isEchoMirageDesktopShell()) {
    return null;
  }

  if (loading) {
    return (
      <p className="text-[9px] tracking-[0.04em] text-[#5f5f5f]">
        Resolving desktop installer…
      </p>
    );
  }

  if (!info) {
    return (
      <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#6a5a40]">
        Could not resolve the desktop installer. Open{" "}
        <a
          href="https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#9a8a6a] underline-offset-2 hover:underline"
        >
          GitHub Releases
        </a>{" "}
        and download the Windows setup package.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          This PWA session is browser-only. Install the Echo Mirage desktop shell for a fully
          operational cyberdeck — local disk access, tray Silent Mode, and desktop IPC bridges.
        </p>
      ) : null}
      {!compact ? (
        <ul className="space-y-1 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          {info.features.map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CyberdeckActionButton variant="accent" onClick={handleInstall}>
          {info.supported ? installLabel : "VIEW RELEASES"}
        </CyberdeckActionButton>
        {info.fileName ? (
          <span className="text-[9px] tracking-[0.04em] text-[#5f5f5f]">
            v{info.version}
            {info.platform === "win" ? " // Windows" : ` // ${info.platform}`}
          </span>
        ) : null}
      </div>
      {info.statusMessage ? (
        <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#6a5a40]">
          {info.statusMessage}{" "}
          <a
            href="https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/desktop-installer.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#9a8a6a] underline-offset-2 hover:underline"
          >
            Check build status
          </a>
          .
        </p>
      ) : null}
      {!info.supported ? (
        <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#6a5a40]">
          Packaged installers are Windows-first today. Other platforms can build from source with{" "}
          <code className="rounded border border-[#2d2d2d] bg-black px-1 py-0.5 text-[8px] text-[#8a8a8a]">
            pnpm electron:pack
          </code>
          .
        </p>
      ) : null}
    </div>
  );
}
