#!/usr/bin/env node
/**
 * Sync figlet .flf fonts from xero/figlet-fonts that are not already in figlet npm.
 * Source: https://github.com/xero/figlet-fonts
 *
 * Auto-clones into tmp/figlet-fonts-xero when missing. Use --skip-xero to skip.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const figlet = require("figlet");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const xeroPath = path.join(repoRoot, "tmp", "figlet-fonts-xero");
const outDir = path.join(repoRoot, "assets", "figlet-fonts");
const manifestPath = path.join(outDir, "manifest.json");
const XERO_REPO = "https://github.com/xero/figlet-fonts.git";

const skipXero = process.argv.includes("--skip-xero");

const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function bundledFontKeys() {
  const fontPath = figlet.defaults().fontPath;
  const keys = new Set();
  for (const file of fs.readdirSync(fontPath).filter((file) => file.endsWith(".flf"))) {
    const base = file.replace(/\.flf$/i, "");
    keys.add(base.toLowerCase());
    keys.add(norm(base));
  }
  if (fs.existsSync(outDir)) {
    for (const file of fs.readdirSync(outDir).filter((entry) => entry.endsWith(".flf"))) {
      const base = file.replace(/\.flf$/i, "");
      keys.add(base.toLowerCase());
      keys.add(norm(base));
    }
  }
  return keys;
}

function ensureXeroRepo() {
  if (fs.existsSync(xeroPath)) return true;
  if (skipXero) {
    console.log("Skipping xero figlet-fonts (--skip-xero).");
    return false;
  }

  console.log(`Cloning xero/figlet-fonts into tmp/figlet-fonts-xero …`);
  fs.mkdirSync(path.dirname(xeroPath), { recursive: true });
  const result = spawnSync(
    "git",
    ["clone", "--depth", "1", XERO_REPO, xeroPath],
    { cwd: repoRoot, stdio: "inherit", windowsHide: true },
  );

  if (result.status !== 0 || !fs.existsSync(xeroPath)) {
    console.warn(
      "Could not clone xero/figlet-fonts — skipping xero sync. Use pnpm fonts:sync-pyfiglet for pyfiglet fonts.",
    );
    return false;
  }
  return true;
}

function discoverNewFonts() {
  if (!ensureXeroRepo()) return [];

  const bundled = bundledFontKeys();
  const discovered = [];

  for (const file of fs.readdirSync(xeroPath).filter((entry) => entry.endsWith(".flf"))) {
    const data = fs.readFileSync(path.join(xeroPath, file), "utf8");
    const probe = `__probe__${file}`;
    try {
      figlet.parseFont(probe, data);
      const fontName = figlet.figFonts[probe]?.options?.font || file.replace(/\.flf$/i, "");
      delete figlet.figFonts[probe];
      if (bundled.has(fontName.toLowerCase()) || bundled.has(norm(fontName))) continue;
      if (discovered.some((entry) => entry.fontName.toLowerCase() === fontName.toLowerCase())) {
        continue;
      }
      discovered.push({ file, fontName, data });
    } catch {
      /* skip invalid font files */
    }
  }

  return discovered.sort((a, b) => a.fontName.localeCompare(b.fontName, undefined, { sensitivity: "base" }));
}

function main() {
  const fonts = discoverNewFonts();
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = fonts.map(({ file, fontName, data }) => {
    const destName = `${fontName}.flf`;
    fs.writeFileSync(path.join(outDir, destName), data);
    return { file, fontName, destName };
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Synced ${manifest.length} xero figlet fonts to assets/figlet-fonts`);
  for (const entry of manifest) {
    console.log(`  ${entry.file} -> ${entry.destName}`);
  }
}

main();
