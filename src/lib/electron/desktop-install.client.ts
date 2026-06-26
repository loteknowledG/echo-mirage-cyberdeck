"use client";

import type { DesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";

export const DESKTOP_INSTALL_DISMISS_KEY = "echo-mirage-desktop-install-dismissed-v1";

export function isEchoMirageDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.echoMirageSilentMode ||
      window.echoMirageOpen ||
      window.echoMirageSave,
  );
}

export function isDesktopInstallBannerDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(DESKTOP_INSTALL_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDesktopInstallBanner(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DESKTOP_INSTALL_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function fetchDesktopInstallInfo(): Promise<DesktopInstallInfo | null> {
  try {
    const res = await fetch("/api/desktop-install", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DesktopInstallInfo;
  } catch {
    return null;
  }
}

export function openDesktopInstaller(info: DesktopInstallInfo): void {
  const target = info.downloadUrl ?? info.releasePageUrl;
  window.open(target, "_blank", "noopener,noreferrer");
}
