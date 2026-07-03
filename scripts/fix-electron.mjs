import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveElectronDir(packageDir) {
  const require = createRequire(path.join(packageDir, "package.json"));
  return path.dirname(require.resolve("electron/package.json"));
}

async function installElectronBinary(packageDir, label) {
  const electronDir = resolveElectronDir(packageDir);
  const pathFile = path.join(electronDir, "path.txt");
  const platformPath = process.platform === "win32" ? "electron.exe" : "electron";
  const binaryPath = path.join(electronDir, "dist", platformPath);

  if (fs.existsSync(pathFile) && fs.existsSync(binaryPath)) {
    console.log(`${label} Electron already installed.`);
    return;
  }

  const require = createRequire(path.join(electronDir, "package.json"));
  const { downloadArtifact } = require("@electron/get");
  const { version } = require(path.join(electronDir, "package.json"));

  const distDir = path.join(electronDir, "dist");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  console.log(`Downloading ${label} Electron ${version} for ${process.platform}/${process.arch}…`);
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
  console.log(`${label} Electron ready:`, platformPath);
}

const satelliteDir = path.join(root, "apps", "echo-satellite-electron");

await installElectronBinary(satelliteDir, "Echo Satellite");
await installElectronBinary(root, "Cyberdeck");
