import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { app, shell } from "electron";

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/loteknowledG/echo-mirage-cyberdeck/releases?per_page=40";

/** @param {string} value */
function parseSemver(value) {
  const match = String(value).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** @param {string} latest @param {string} current */
function isVersionNewer(latest, current) {
  const next = parseSemver(latest);
  const installed = parseSemver(current);
  if (!next || !installed) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] > installed[index]) return true;
    if (next[index] < installed[index]) return false;
  }
  return false;
}

/** @param {string} version */
function installerCandidates(version) {
  if (process.platform === "darwin") {
    return [`Echo-Satellite_${version}_aarch64.pkg`, `Echo-Satellite_${version}_aarch64.dmg`];
  }
  if (process.platform === "win32") {
    return [`Echo-Satellite_${version}_x64-setup.exe`, `Echo-Satellite-${version}-setup.exe`];
  }
  return [];
}

async function fetchLatestSatelliteRelease() {
  const response = await fetch(GITHUB_RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "echo-satellite-updater",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub releases unavailable (${response.status}).`);
  }

  const releases = /** @type {Array<{ tag_name?: string, html_url?: string, assets?: Array<{ name?: string, browser_download_url?: string }> }>} */ (
    await response.json()
  );

  for (const release of releases) {
    const tag = release.tag_name ?? "";
    if (!tag.startsWith("satellite-v")) continue;
    return {
      version: tag.slice("satellite-v".length),
      releaseUrl: release.html_url ?? "https://github.com/loteknowledG/echo-mirage-cyberdeck/releases",
      assets: release.assets ?? [],
    };
  }

  throw new Error("No Echo Satellite release found on GitHub.");
}

/** @param {Array<{ name?: string, browser_download_url?: string }>} assets @param {string} version */
function resolveAsset(assets, version) {
  for (const fileName of installerCandidates(version)) {
    const asset = assets.find((entry) => entry.name === fileName);
    if (asset?.browser_download_url) {
      return { fileName, downloadUrl: asset.browser_download_url };
    }
  }
  return null;
}

/** @param {string} currentVersion */
export async function checkForSatelliteUpdate(currentVersion) {
  try {
    const release = await fetchLatestSatelliteRelease();
    const asset = resolveAsset(release.assets, release.version);
    const updateAvailable = isVersionNewer(release.version, currentVersion);

    return {
      ok: true,
      currentVersion,
      latestVersion: release.version,
      updateAvailable,
      releaseUrl: release.releaseUrl,
      downloadUrl: asset?.downloadUrl ?? null,
      fileName: asset?.fileName ?? null,
      reason:
        updateAvailable && !asset
          ? "Update found but no installer is published for this platform yet."
          : null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Update check failed.",
    };
  }
}

/** @param {{ downloadUrl: string, fileName: string }} input */
export async function downloadAndInstallSatelliteUpdate(input) {
  const destination = path.join(app.getPath("temp"), input.fileName);
  const response = await fetch(input.downloadUrl, {
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, buffer);

  if (process.platform === "win32") {
    spawn(destination, ["/S"], { detached: true, stdio: "ignore" }).unref();
    return {
      ok: true,
      message: "Updating in place — Echo Satellite will close and reopen automatically.",
      quitApp: true,
    };
  }

  if (process.platform === "darwin") {
    const openError = await shell.openPath(destination);
    if (openError) {
      throw new Error(openError);
    }
    return {
      ok: true,
      message: "Installer opened — click Continue to update in place, then reopen Echo Satellite.",
      quitApp: true,
    };
  }

  await shell.openPath(destination);
  return {
    ok: true,
    message: "Installer opened.",
    quitApp: false,
  };
}
