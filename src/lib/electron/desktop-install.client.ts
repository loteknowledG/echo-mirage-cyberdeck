"use client";

import type {
  DesktopInstallInfo,
  DesktopInstallPlatform,
} from "@/lib/electron/desktop-install-info.server";

export const DESKTOP_INSTALL_DISMISS_KEY = "echo-mirage-desktop-install-dismissed-v1";
export const DESKTOP_CYBERDECK_PROTOCOL = "echomirage";
export const DEFAULT_LOCAL_CYBERDECK_ORIGIN = "http://127.0.0.1:3050";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type LocalDesktopShellProbe = {
  running: boolean;
  shell: boolean;
  origin: string | null;
};

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

export function resolveClientDesktopPlatform(): DesktopInstallPlatform {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "win";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "unsupported";
}

export async function fetchDesktopInstallInfo(): Promise<DesktopInstallInfo | null> {
  try {
    const platform = resolveClientDesktopPlatform();
    const query =
      platform === "unsupported" ? "" : `?platform=${encodeURIComponent(platform)}`;
    const res = await fetch(`/api/desktop-install${query}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DesktopInstallInfo;
  } catch {
    return null;
  }
}

export function openDesktopInstaller(info: DesktopInstallInfo): void {
  const clientPlatform = resolveClientDesktopPlatform();
  const platformMismatch =
    clientPlatform !== "unsupported" &&
    info.platform !== clientPlatform &&
    info.fileName != null;
  const wrongExtension =
    clientPlatform === "mac" && info.fileName?.endsWith(".exe") === true;
  if (platformMismatch || wrongExtension) {
    window.open(info.releasePageUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const target =
    info.installerAvailable && info.downloadUrl
      ? info.downloadUrl
      : info.releasePageUrl;
  window.open(target, "_blank", "noopener,noreferrer");
}

function localProbeOrigins(): string[] {
  if (typeof window === "undefined") return [];
  const origins = new Set<string>();
  const { protocol, hostname, origin, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    origins.add(origin);
  }
  origins.add(DEFAULT_LOCAL_CYBERDECK_ORIGIN);
  if (port && port !== "3050") {
    origins.add(`${protocol}//127.0.0.1:${port}`);
  }
  return [...origins];
}

export async function probeLocalDesktopShell(): Promise<LocalDesktopShellProbe> {
  for (const origin of localProbeOrigins()) {
    try {
      const res = await fetch(`${origin}/api/desktop-shell/status`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as { shell?: boolean };
      return {
        running: true,
        shell: payload.shell === true,
        origin,
      };
    } catch {
      /* try next origin */
    }
  }
  return { running: false, shell: false, origin: null };
}

export function buildDesktopCyberdeckProtocolUrl(path = "/cyberdeck"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${DESKTOP_CYBERDECK_PROTOCOL}://open${normalized}`;
}

/** Launch the installed desktop cyberdeck via custom protocol (or localhost when probed). */
export function openDesktopCyberdeckApp(input?: {
  path?: string;
  localOrigin?: string | null;
}): void {
  const path = input?.path ?? "/cyberdeck";
  const protocolUrl = buildDesktopCyberdeckProtocolUrl(path);

  if (input?.localOrigin) {
    window.open(`${input.localOrigin}${path}`, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = protocolUrl;
}

export function isPwaStandaloneSession(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function subscribePwaInstallPrompt(
  onPrompt: (event: BeforeInstallPromptEvent) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    event.preventDefault();
    onPrompt(event as BeforeInstallPromptEvent);
  };

  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}

export async function promptPwaInstall(event: BeforeInstallPromptEvent): Promise<boolean> {
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === "accepted";
}
