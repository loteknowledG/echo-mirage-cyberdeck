import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const satelliteDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "echo-satellite-electron",
);

function resolveElectronDir() {
  const require = createRequire(path.join(satelliteDir, "package.json"));
  return path.dirname(require.resolve("electron/package.json"));
}

async function installElectronBinary() {
  const electronDir = resolveElectronDir();
  const pathFile = path.join(electronDir, "path.txt");
  const platformPath = process.platform === "win32" ? "electron.exe" : "electron";
  const binaryPath = path.join(electronDir, "dist", platformPath);

  if (fs.existsSync(pathFile) && fs.existsSync(binaryPath)) {
    console.log("Echo Satellite Electron already installed.");
    return;
  }

  const require = createRequire(path.join(electronDir, "package.json"));
  const { downloadArtifact } = require("@electron/get");
  const { version } = require(path.join(electronDir, "package.json"));

  const distDir = path.join(electronDir, "dist");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  console.log(`Downloading Electron ${version} for ${process.platform}/${process.arch}…`);
  const zipPath = await downloadArtifact({
    version,
    artifactName: "electron",
    platform: process.platform,
    arch: process.arch,
  });

  console.log("Extracting…");
  if (process.platform === "win32") {
    execFileSync("tar", ["-xf", zipPath, "-C", distDir], { stdio: "inherit" });
  } else {
    const extract = require("extract-zip");
    await extract(zipPath, { dir: distDir });
  }

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Missing ${binaryPath} after extract.`);
  }

  await fs.promises.writeFile(pathFile, platformPath);
  await fs.promises.writeFile(path.join(distDir, "version"), version);
  console.log("Echo Satellite Electron ready:", platformPath);
}

installElectronBinary().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
