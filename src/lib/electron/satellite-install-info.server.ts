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

const GITHUB_REPO = "loteknowledG/echo-mirage-cyberdeck";
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases`;
const SATELLITE_TAG_PREFIX = "satellite-v";

/** Filtered GitHub releases index — not the cyberdeck desktop `releases/latest` page. */
export const SATELLITE_GITHUB_RELEASES_URL = `${GITHUB_RELEASES}?q=${SATELLITE_TAG_PREFIX}`;

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

function readSatelliteVersion(): string {
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "apps/echo-satellite-electron/package.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version?.trim() || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function parseSatelliteVersionFromTag(tag: string | undefined): string | null {
  if (!tag?.startsWith(SATELLITE_TAG_PREFIX)) return null;
  const version = tag.slice(SATELLITE_TAG_PREFIX.length).trim();
  return version || null;
}

function satelliteInstallerFileName(
  version: string,
  platform: DesktopInstallPlatform,
): string | null {
  switch (platform) {
    case "win":
      return `Echo-Satellite_${version}_x64-setup.exe`;
    case "mac":
      return `Echo-Satellite_${version}_aarch64.pkg`;
    default:
      return null;
  }
}

/** Tauri default bundle names vary slightly — try these when resolving GitHub assets. */
function satelliteInstallerFileCandidates(
  version: string,
  platform: DesktopInstallPlatform,
): string[] {
  const primary = satelliteInstallerFileName(version, platform);
  if (!primary) return [];
  switch (platform) {
    case "win":
      return [primary, `Echo-Satellite-${version}-setup.exe`];
    case "mac":
      return [
        primary,
        `Echo-Satellite_${version}_aarch64.dmg`,
        `Echo-Satellite-${version}.dmg`,
        `Echo Satellite_${version}_aarch64.dmg`,
      ];
    default:
      return [primary];
  }
}

function githubRequestHeaders(): Record<string, string> {
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

async function fetchGitHubReleases(): Promise<GitHubRelease[]> {
  const listRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=40`,
    { headers: githubRequestHeaders(), signal: AbortSignal.timeout(10_000) },
  );
  if (!listRes.ok) {
    return [];
  }
  return (await listRes.json()) as GitHubRelease[];
}

async function fetchLatestSatelliteRelease(): Promise<GitHubRelease | null> {
  try {
    const releases = await fetchGitHubReleases();
    return releases.find((release) => release.tag_name?.startsWith(SATELLITE_TAG_PREFIX)) ?? null;
  } catch {
    return null;
  }
}

function resolveAssetFromRelease(
  release: GitHubRelease,
  version: string,
  platform: DesktopInstallPlatform,
): string | null {
  const candidates = new Set(satelliteInstallerFileCandidates(version, platform));
  for (const name of candidates) {
    const asset = release.assets?.find((entry) => entry.name === name);
    if (asset?.browser_download_url) return asset.browser_download_url;
  }
  return null;
}

async function resolveSatelliteAssetUrl(
  version: string,
  platform: DesktopInstallPlatform,
  latestRelease: GitHubRelease | null,
): Promise<string | null> {
  const fileName = satelliteInstallerFileName(version, platform);
  if (!fileName) return null;

  if (latestRelease) {
    const latestVersion = parseSatelliteVersionFromTag(latestRelease.tag_name);
    if (latestVersion === version) {
      const hit = resolveAssetFromRelease(latestRelease, version, platform);
      if (hit) return hit;
    }
  }

  const tag = `${SATELLITE_TAG_PREFIX}${version}`;
  try {
    const tagRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`,
      { headers: githubRequestHeaders(), signal: AbortSignal.timeout(10_000) },
    );
    if (tagRes.ok) {
      const release = (await tagRes.json()) as GitHubRelease;
      const hit = resolveAssetFromRelease(release, version, platform);
      if (hit) return hit;
    }
  } catch {
    /* fall through */
  }

  try {
    const releases = await fetchGitHubReleases();
    for (const release of releases) {
      if (!release.tag_name?.startsWith(SATELLITE_TAG_PREFIX)) continue;
      const hit = resolveAssetFromRelease(release, version, platform);
      if (hit) return hit;
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
  const repoVersion = readSatelliteVersion();
  const latestRelease = await fetchLatestSatelliteRelease();
  const version =
    parseSatelliteVersionFromTag(latestRelease?.tag_name) ?? repoVersion;
  const platform =
    platformOverride ?? resolveDesktopInstallPlatform(userAgent);
  const supported = platform === "win" || platform === "mac";
  const fileName = satelliteInstallerFileName(version, platform);
  const releasePageUrl =
    latestRelease?.html_url ??
    `${GITHUB_RELEASES}/tag/${SATELLITE_TAG_PREFIX}${version}`;

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
      const publishedUrl = await resolveSatelliteAssetUrl(
        version,
        platform,
        latestRelease,
      );
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
