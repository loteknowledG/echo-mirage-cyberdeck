import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DesktopInstallPlatform = "win" | "mac" | "linux" | "unsupported";

export type DesktopInstallInfo = {
  version: string;
  platform: DesktopInstallPlatform;
  supported: boolean;
  /** True when a published GitHub release asset exists for this platform. */
  installerAvailable: boolean;
  downloadUrl: string | null;
  fileName: string | null;
  releasePageUrl: string;
  statusMessage: string | null;
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

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  assets?: GitHubReleaseAsset[];
};

async function resolvePublishedGitHubAssetUrl(
  fileName: string,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "echo-mirage-cyberdeck",
    };
    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      "https://api.github.com/repos/loteknowledG/echo-mirage-cyberdeck/releases/latest",
      {
        headers,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      return null;
    }

    const release = (await res.json()) as GitHubRelease;
    const asset = release.assets?.find((entry) => entry.name === fileName);
    return asset?.browser_download_url ?? null;
  } catch {
    return null;
  }
}

export function resolveDesktopInstallPlatform(userAgent: string): DesktopInstallPlatform {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "win";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "unsupported";
}

export async function getDesktopInstallInfo(
  userAgent: string,
): Promise<DesktopInstallInfo> {
  const version = readPackageVersion();
  const platform = resolveDesktopInstallPlatform(userAgent);
  const supported = platform === "win";
  const fileName = desktopInstallerFileName(version, platform);
  const envUrl = process.env.ECHO_MIRAGE_DESKTOP_INSTALLER_URL?.trim();
  let downloadUrl: string | null = null;
  let installerAvailable = false;
  let statusMessage: string | null = null;

  if (supported && fileName) {
    if (envUrl) {
      downloadUrl = envUrl;
      installerAvailable = true;
    } else {
      const localInstaller = path.join(process.cwd(), "public", "downloads", fileName);
      if (existsSync(localInstaller)) {
        downloadUrl = `/downloads/${fileName}`;
        installerAvailable = true;
      } else {
        const publishedUrl = await resolvePublishedGitHubAssetUrl(fileName);
        if (publishedUrl) {
          downloadUrl = publishedUrl;
          installerAvailable = true;
        } else {
          statusMessage =
            "The Windows installer is not published yet. Open GitHub Releases or wait for the desktop-installer workflow to finish.";
        }
      }
    }
  }

  return {
    version,
    platform,
    supported,
    installerAvailable,
    downloadUrl,
    fileName,
    releasePageUrl: GITHUB_RELEASE_PAGE,
    statusMessage,
    features: [
      "Silent Mode and system tray",
      "Local disk operator folders (F:\\dev, etc.)",
      "In-place file save and binary export",
      "Pi / Synapse desktop embodiment",
      "Full audio gate and desktop IPC bridges",
    ],
  };
}
