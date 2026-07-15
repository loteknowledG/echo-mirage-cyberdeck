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

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/loteknowledG/echo-mirage-cyberdeck/releases?per_page=30";
const DESKTOP_RELEASES_PAGE =
  "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases?q=desktop-v";
const GITHUB_DESKTOP_DOWNLOAD_BASE =
  "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/download";

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

function desktopReleaseTagUrl(version: string): string {
  return `https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/tag/desktop-v${version}`;
}

/** Direct asset URL — used when GitHub Releases API is rate-limited or unavailable. */
function constructedDesktopInstallerUrl(
  version: string,
  platform: DesktopInstallPlatform,
): { fileName: string; downloadUrl: string; releasePageUrl: string } | null {
  const fileName = desktopInstallerFileName(version, platform);
  if (!fileName) return null;
  return {
    fileName,
    downloadUrl: `${GITHUB_DESKTOP_DOWNLOAD_BASE}/desktop-v${version}/${fileName}`,
    releasePageUrl: desktopReleaseTagUrl(version),
  };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "echo-mirage-cyberdeck",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

function versionFromDesktopTag(tag: string): string | null {
  const match = /^desktop-v(.+)$/i.exec(tag.trim());
  return match?.[1]?.trim() || null;
}

function assetNameForPlatform(platform: DesktopInstallPlatform, version: string): string | null {
  return desktopInstallerFileName(version, platform);
}

function findPlatformAsset(
  release: GitHubRelease,
  platform: DesktopInstallPlatform,
): { fileName: string; downloadUrl: string; version: string } | null {
  const tag = release.tag_name?.trim() ?? "";
  const version = versionFromDesktopTag(tag);
  if (!version || !release.assets?.length) return null;

  const expected = assetNameForPlatform(platform, version);
  if (expected) {
    const exact = release.assets.find((asset) => asset.name === expected);
    if (exact) {
      return {
        fileName: exact.name,
        downloadUrl: exact.browser_download_url,
        version,
      };
    }
  }

  // Fallback: any matching installer pattern on a desktop-v* release.
  const pattern =
    platform === "win"
      ? /^Echo-Mirage-Cyberdeck-Setup-.*\.exe$/i
      : platform === "mac"
        ? /^Echo-Mirage-Cyberdeck-.*\.dmg$/i
        : /^Echo-Mirage-Cyberdeck-.*\.AppImage$/i;
  const fuzzy = release.assets.find((asset) => pattern.test(asset.name));
  if (!fuzzy) return null;
  return {
    fileName: fuzzy.name,
    downloadUrl: fuzzy.browser_download_url,
    version,
  };
}

/** Prefer desktop-v* releases — not GitHub "latest" (often Echo Satellite). */
async function resolvePublishedDesktopInstaller(
  platform: DesktopInstallPlatform,
): Promise<{
  fileName: string;
  downloadUrl: string;
  version: string;
  releasePageUrl: string;
} | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const releases = (await res.json()) as GitHubRelease[];
    for (const release of releases) {
      const tag = release.tag_name?.trim() ?? "";
      if (!/^desktop-v/i.test(tag)) continue;
      const asset = findPlatformAsset(release, platform);
      if (!asset) continue;
      return {
        ...asset,
        releasePageUrl: release.html_url?.trim() || DESKTOP_RELEASES_PAGE,
      };
    }
    return null;
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

export function parseDesktopInstallPlatformParam(
  value: string | null | undefined,
): DesktopInstallPlatform | null {
  switch (value?.trim().toLowerCase()) {
    case "win":
    case "windows":
      return "win";
    case "mac":
    case "macos":
      return "mac";
    case "linux":
      return "linux";
    default:
      return null;
  }
}

export async function getDesktopInstallInfo(
  userAgent: string,
  platformOverride?: DesktopInstallPlatform | null,
): Promise<DesktopInstallInfo> {
  const packageVersion = readPackageVersion();
  const platform =
    platformOverride ?? resolveDesktopInstallPlatform(userAgent);
  const supported = platform === "win" || platform === "mac";
  const envUrl = process.env.ECHO_MIRAGE_DESKTOP_INSTALLER_URL?.trim();
  let version = packageVersion;
  let fileName = desktopInstallerFileName(packageVersion, platform);
  let downloadUrl: string | null = null;
  let installerAvailable = false;
  let statusMessage: string | null = null;
  let releasePageUrl = DESKTOP_RELEASES_PAGE;

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
        const published = await resolvePublishedDesktopInstaller(platform);
        if (published) {
          downloadUrl = published.downloadUrl;
          fileName = published.fileName;
          version = published.version;
          releasePageUrl = published.releasePageUrl;
          installerAvailable = true;
        } else {
          // Prefer direct asset URL over the releases search page when the API is unavailable.
          const constructed = constructedDesktopInstallerUrl(packageVersion, platform);
          if (constructed) {
            downloadUrl = constructed.downloadUrl;
            fileName = constructed.fileName;
            releasePageUrl = constructed.releasePageUrl;
            installerAvailable = true;
            statusMessage =
              "Using direct installer URL (GitHub release listing unavailable).";
          } else {
            statusMessage =
              platform === "mac"
                ? "No macOS Mirage desktop build published yet. Open desktop-v releases or run the desktop-installer workflow."
                : "No Windows Mirage desktop build published yet. Open desktop-v releases or run the desktop-installer workflow.";
          }
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
    releasePageUrl,
    statusMessage,
    features: [
      "Local Tailscale Echo screenshot (no Vercel hop)",
      "Silent Mode and system tray",
      "Local disk operator folders",
      "Survey Mirage capture + SOLVE",
    ],
  };
}
