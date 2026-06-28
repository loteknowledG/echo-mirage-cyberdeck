import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  parseDesktopInstallPlatformParam,
  resolveDesktopInstallPlatform,
  type DesktopInstallPlatform,
} from "@/lib/electron/desktop-install-info.server";

export type SatelliteInstallInfo = {
  product: "satellite";
  version: string;
  platform: DesktopInstallPlatform;
  supported: boolean;
  installerAvailable: boolean;
  downloadUrl: string | null;
  fileName: string | null;
  releasePageUrl: string;
  statusMessage: string | null;
  features: string[];
};

const GITHUB_RELEASES =
  "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases";

function readSatelliteVersion(): string {
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "apps/echo-satellite/package.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version?.trim() || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function satelliteInstallerFileName(
  version: string,
  platform: DesktopInstallPlatform,
): string | null {
  switch (platform) {
    case "win":
      return `Echo-Satellite-${version}-setup.exe`;
    case "mac":
      return `Echo-Satellite-${version}.dmg`;
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

async function resolveSatelliteAssetUrl(
  version: string,
  fileName: string,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "echo-mirage-cyberdeck",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const tag = `satellite-v${version}`;
  const tagUrl = `https://api.github.com/repos/loteknowledG/echo-mirage-cyberdeck/releases/tags/${tag}`;

  try {
    const tagRes = await fetch(tagUrl, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (tagRes.ok) {
      const release = (await tagRes.json()) as GitHubRelease;
      const asset = release.assets?.find((entry) => entry.name === fileName);
      if (asset?.browser_download_url) return asset.browser_download_url;
    }
  } catch {
    /* fall through */
  }

  try {
    const listRes = await fetch(
      "https://api.github.com/repos/loteknowledG/echo-mirage-cyberdeck/releases?per_page=30",
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!listRes.ok) return null;
    const releases = (await listRes.json()) as GitHubRelease[];
    for (const release of releases) {
      const asset = release.assets?.find((entry) => entry.name === fileName);
      if (asset?.browser_download_url) return asset.browser_download_url;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getSatelliteInstallInfo(
  userAgent: string,
  platformOverride?: DesktopInstallPlatform | null,
): Promise<SatelliteInstallInfo> {
  const version = readSatelliteVersion();
  const platform =
    platformOverride ?? resolveDesktopInstallPlatform(userAgent);
  const supported = platform === "win" || platform === "mac";
  const fileName = satelliteInstallerFileName(version, platform);
  const releasePageUrl = `${GITHUB_RELEASES}/tag/satellite-v${version}`;

  let downloadUrl: string | null = null;
  let installerAvailable = false;
  let statusMessage: string | null = null;

  if (supported && fileName) {
    const localInstaller = path.join(
      process.cwd(),
      "public",
      "downloads",
      fileName,
    );
    if (existsSync(localInstaller)) {
      downloadUrl = `/downloads/${fileName}`;
      installerAvailable = true;
    } else {
      const publishedUrl = await resolveSatelliteAssetUrl(version, fileName);
      if (publishedUrl) {
        downloadUrl = publishedUrl;
        installerAvailable = true;
      } else {
        statusMessage =
          "Echo Satellite installer is not published yet. Wait for the satellite-installer workflow or build locally with pnpm satellite:build.";
      }
    }
  }

  return {
    product: "satellite",
    version,
    platform,
    supported,
    installerAvailable,
    downloadUrl,
    fileName,
    releasePageUrl,
    statusMessage,
    features: [
      "Tray-only capture drone (~MB, not full cyberdeck)",
      "Screenshot only when PowerFist signals",
      "Pairs on port 3050 with Mirage Echo QR",
      "Silent missions — no UI during capture",
    ],
  };
}

export { parseDesktopInstallPlatformParam };
