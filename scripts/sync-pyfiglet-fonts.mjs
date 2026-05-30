#!/usr/bin/env node
/**
 * Copy .flf fonts from installed pyfiglet into assets/figlet-fonts for figlet.js (no Python at runtime).
 *
 *   pip install -r requirements-glyph.txt
 *   pnpm fonts:sync-pyfiglet
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
const outDir = path.join(repoRoot, "assets", "figlet-fonts");
const python = process.env.GLYPH_PYTHON?.trim() || "python";

const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function bundledFontKeys() {
  const fontPath = figlet.defaults().fontPath;
  const keys = new Set();
  for (const file of fs.readdirSync(fontPath).filter((f) => f.endsWith(".flf"))) {
    const base = file.replace(/\.flf$/i, "");
    keys.add(base.toLowerCase());
    keys.add(norm(base));
  }
  for (const name of fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith(".flf"))
    : []) {
    const base = name.replace(/\.flf$/i, "");
    keys.add(base.toLowerCase());
    keys.add(norm(base));
  }
  return keys;
}

function pyfigletFontsDir() {
  const probe = spawnSync(
    python,
    [
      "-c",
      "import os, pyfiglet; print(os.path.join(os.path.dirname(pyfiglet.__file__), 'fonts'))",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (probe.status !== 0) {
    throw new Error(
      `pyfiglet not found. Install with:\n  pip install -r requirements-glyph.txt\n\n${probe.stderr || probe.stdout}`,
    );
  }
  const dir = probe.stdout.trim();
  if (!fs.existsSync(dir)) {
    throw new Error(`pyfiglet fonts directory missing: ${dir}`);
  }
  return dir;
}

function main() {
  const bundled = bundledFontKeys();
  const sourceDir = pyfigletFontsDir();
  fs.mkdirSync(outDir, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const file of fs.readdirSync(sourceDir).filter((f) => f.endsWith(".flf"))) {
    const fontName = file.replace(/\.flf$/i, "");
    if (bundled.has(fontName.toLowerCase()) || bundled.has(norm(fontName))) {
      skipped += 1;
      continue;
    }
    const dest = path.join(outDir, file);
    fs.copyFileSync(path.join(sourceDir, file), dest);
    copied += 1;
  }

  console.log(`pyfiglet sync: ${copied} new fonts -> assets/figlet-fonts (${skipped} already present)`);
}

main();
