#!/usr/bin/env node
/**
 * Copy figlet npm .flf fonts into assets/figlet-fonts so Vercel/serverless
 * can render without node_modules/figlet/fonts at runtime.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const figlet = require("figlet");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "assets", "figlet-fonts");
const npmFontDir = figlet.defaults().fontPath;

function existingKeys(dir) {
  const keys = new Set();
  if (!fs.existsSync(dir)) return keys;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".flf"))) {
    keys.add(file.replace(/\.flf$/i, "").toLowerCase());
  }
  return keys;
}

function main() {
  if (!fs.existsSync(npmFontDir)) {
    console.warn(`[copy-figlet-npm-fonts] skip — missing ${npmFontDir}`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const have = existingKeys(outDir);
  let copied = 0;
  let skipped = 0;

  for (const file of fs.readdirSync(npmFontDir).filter((f) => f.endsWith(".flf"))) {
    const base = file.replace(/\.flf$/i, "");
    if (have.has(base.toLowerCase())) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(path.join(npmFontDir, file), path.join(outDir, file));
    have.add(base.toLowerCase());
    copied += 1;
  }

  console.log(
    `[copy-figlet-npm-fonts] copied ${copied}, skipped ${skipped} (already in assets/figlet-fonts)`,
  );
}

main();
