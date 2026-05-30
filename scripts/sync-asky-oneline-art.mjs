#!/usr/bin/env node
/** Extract one-line ASCII catalog from asky.lol bundle → public/glyph/asky-oneline-art.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ASKY_BUNDLE_URL = "https://asky.lol/javascript/main.bundle.js";
const ASKY_SOURCE = "https://asky.lol/";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(path.resolve(__dirname, ".."), "public", "glyph", "asky-oneline-art.json");

/** @param {string} js */
export function parseAskyEntriesFromBundle(js) {
  /** @type {Array<{ id: number; title: string; content: string }>} */
  const entries = [];
  const re =
    /\{id:(\d+),title:"((?:\\.|[^"\\])*)",content:"((?:\\.|[^"\\])*)",creator:/g;
  let match;
  while ((match = re.exec(js)) !== null) {
    entries.push({
      id: Number(match[1]),
      title: unescapeJsString(match[2]),
      content: unescapeJsString(match[3]),
    });
  }
  return entries;
}

/** @param {string} raw */
function unescapeJsString(raw) {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

async function main() {
  const res = await fetch(ASKY_BUNDLE_URL);
  if (!res.ok) {
    throw new Error(`asky bundle fetch failed: ${res.status}`);
  }
  const js = await res.text();
  const entries = parseAskyEntriesFromBundle(js);
  if (entries.length === 0) {
    throw new Error("No asky entries parsed from main.bundle.js");
  }

  entries.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        source: ASKY_SOURCE,
        bundle: ASKY_BUNDLE_URL,
        count: entries.length,
        entries,
      },
      null,
      0,
    )}\n`,
    "utf8",
  );
  console.log(`Wrote ${entries.length} asky entries → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
