#!/usr/bin/env node
/** Write public/glyph/figlet-fonts.json for client fallback when /api/glyph/fonts fails. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const figlet = require("figlet");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const customDir = path.join(repoRoot, "assets", "figlet-fonts");
const outPath = path.join(repoRoot, "public", "glyph", "figlet-fonts.json");

function merge(bundled, custom) {
  const seen = new Set();
  const merged = [];
  for (const name of [...bundled, ...custom]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function main() {
  const bundled = await new Promise((resolve, reject) => {
    figlet.fonts((err, fonts) => (err ? reject(err) : resolve(fonts ?? [])));
  });
  const custom = fs.existsSync(customDir)
    ? fs
        .readdirSync(customDir)
        .filter((f) => f.endsWith(".flf"))
        .map((f) => f.replace(/\.flf$/i, ""))
    : [];

  const fonts = merge(bundled, custom);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ fonts }, null, 0)}\n`, "utf8");
  console.log(`Wrote ${fonts.length} font names to public/glyph/figlet-fonts.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
