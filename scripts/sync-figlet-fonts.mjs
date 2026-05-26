#!/usr/bin/env node
/**
 * Sync figlet .flf fonts from xero/figlet-fonts that are not already in figlet npm.
 * Source: https://github.com/xero/figlet-fonts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const figlet = require("figlet");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const xeroPath = path.join(repoRoot, "tmp", "figlet-fonts-xero");
const outDir = path.join(repoRoot, "assets", "figlet-fonts");
const manifestPath = path.join(outDir, "manifest.json");

const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function bundledFontKeys() {
  const fontPath = figlet.defaults().fontPath;
  const files = fs.readdirSync(fontPath).filter((file) => file.endsWith(".flf"));
  const keys = new Set();
  for (const file of files) {
    const base = file.replace(/\.flf$/i, "");
    keys.add(base.toLowerCase());
    keys.add(norm(base));
  }
  return keys;
}

function discoverNewFonts() {
  if (!fs.existsSync(xeroPath)) {
    throw new Error(
      `Missing ${xeroPath}. Clone first:\n  git clone --depth 1 https://github.com/xero/figlet-fonts.git tmp/figlet-fonts-xero`,
    );
  }

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

  const manifest = fonts.map(({ file, fontName }) => {
    const destName = `${fontName}.flf`;
    fs.writeFileSync(path.join(outDir, destName), fonts.find((entry) => entry.fontName === fontName).data);
    return { file, fontName, destName };
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Synced ${manifest.length} custom figlet fonts to assets/figlet-fonts`);
  for (const entry of manifest) {
    console.log(`  ${entry.file} -> ${entry.destName}`);
  }
}

main();
