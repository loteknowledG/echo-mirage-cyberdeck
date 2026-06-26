"use client";

import { useEffect, useState } from "react";

import { DesktopInstallCta } from "@/components/cyberdeck/desktop-install-cta";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  dismissDesktopInstallBanner,
  isDesktopInstallBannerDismissed,
  isEchoMirageDesktopShell,
} from "@/lib/electron/desktop-install.client";

/** PWA-only strip prompting operators to install the desktop cyberdeck shell. */
export function DesktopShellInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isEchoMirageDesktopShell() || isDesktopInstallBannerDismissed()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-[#1c3a24] bg-[#071108] px-3 py-2 font-mono text-[10px] tracking-[0.04em] text-[#8fd88f]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[9px] tracking-[0.06em] text-[#8fd88f]">
          DESKTOP SHELL REQUIRED FOR FULL CYBERDECK
        </div>
        <CyberdeckActionButton
          onClick={() => {
            dismissDesktopInstallBanner();
            setVisible(false);
          }}
        >
          DISMISS
        </CyberdeckActionButton>
      </div>
      <DesktopInstallCta compact />
    </div>
  );
}
