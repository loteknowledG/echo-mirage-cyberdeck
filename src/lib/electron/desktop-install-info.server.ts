import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DesktopInstallPlatform = "win" | "mac" | "linux" | "unsupported";

export type DesktopInstallInfo = {
  version: string;
  platform: DesktopInstallPlatform;
  supported: boolean;
  downloadUrl: string | null;
  fileName: string | null;
  releasePageUrl: string;
  features: string[];
};

const GITHUB_RELEASE_PAGE =
  "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/latest";

function readPackageVersion(): string {
  try {
    const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version?.trim() || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function desktopInstallerFileName(version: string, platform: DesktopInstallPlatform): string | null {
  switch (platform) {
    case "win":
      return `Echo-Mirage-Cyberdeck-Setup-${version}.exe`;
    case "mac":
      return `Echo-Mirage-Cyberdeck-${version}.dmg`;
    case "linux":
      return `Echo-Mirage-Cyberdeck-${version}.AppImage`;
    default:
      return null;
  }
}

function defaultDownloadUrl(version: string, platform: DesktopInstallPlatform): string | null {
  const fileName = desktopInstallerFileName(version, platform);
  if (!fileName) return null;
  return `${GITHUB_RELEASE_PAGE}/download/${fileName}`;
}

export function resolveDesktopInstallPlatform(userAgent: string): DesktopInstallPlatform {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "win";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "unsupported";
}

export function getDesktopInstallInfo(userAgent: string): DesktopInstallInfo {
  const version = readPackageVersion();
  const platform = resolveDesktopInstallPlatform(userAgent);
  const supported = platform === "win";
  const fileName = desktopInstallerFileName(version, platform);
  const envUrl = process.env.ECHO_MIRAGE_DESKTOP_INSTALLER_URL?.trim();
  let downloadUrl: string | null = null;
  if (supported && fileName) {
    if (envUrl) {
      downloadUrl = envUrl;
    } else {
      const localInstaller = path.join(process.cwd(), "public", "downloads", fileName);
      downloadUrl = existsSync(localInstaller)
        ? `/downloads/${fileName}`
        : defaultDownloadUrl(version, platform);
    }
  }

  return {
    version,
    platform,
    supported,
    downloadUrl,
    fileName,
    releasePageUrl: GITHUB_RELEASE_PAGE,
    features: [
      "Silent Mode and system tray",
      "Local disk operator folders (F:\\dev, etc.)",
      "In-place file save and binary export",
      "Pi / Synapse desktop embodiment",
      "Full audio gate and desktop IPC bridges",
    ],
  };
}
