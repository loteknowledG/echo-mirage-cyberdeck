"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { DesktopInstallCta } from "@/components/cyberdeck/desktop-install-cta";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";

/** INSTALL rail tab — desktop cyberdeck shell download and setup. */
export function InstallPaneBody() {
  const desktopShell = isEchoMirageDesktopShell();

  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                INSTALL
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                DESKTOP SHELL // FULL CYBERDECK EMBODIMENT
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          {desktopShell ? (
            <section className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
              <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#8fd88f]">
                Desktop shell active. Silent Mode, tray, and local disk bridges are available in
                Settings.
              </p>
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">
                  WHY INSTALL
                </div>
                <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
                  <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
                    This browser session is PWA-only. The desktop cyberdeck unlocks Silent Mode,
                    system tray residency, local operator folders, in-place file save, Pi / Synapse
                    embodiment, and full audio gate + IPC bridges.
                  </p>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">
                  WINDOWS INSTALLER
                </div>
                <div className="rounded-sm border border-[#1c3a24] bg-[#071108]/80 p-3">
                  <DesktopInstallCta />
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">
                  DIRECTIONS
                </div>
                <ol className="list-decimal space-y-2 rounded-sm border border-[#1c1c1c] bg-black/75 p-3 pl-6 font-mono text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
                  <li>Use the button above to download the Windows setup package (.exe).</li>
                  <li>Run the installer and choose your install directory when prompted.</li>
                  <li>Launch Echo Mirage Cyberdeck from the Start menu or desktop shortcut.</li>
                  <li>
                    Future updates download automatically — use Settings → App Updates → Restart when
                    prompted.
                  </li>
                  <li>Open Settings (§) for Silent Mode, tray behavior, and desktop-only controls.</li>
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
