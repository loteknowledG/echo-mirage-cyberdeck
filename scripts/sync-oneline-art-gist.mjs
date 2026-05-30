#!/usr/bin/env node
/** Sync ww9 one-line ASCII/UTF-8 art gist → public/glyph/oneline-art.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseOnelineArtText, ONELINE_ART_MAX_RAW_LINE } from "./oneline-art-parse.mjs";

const GIST_RAW =
  "https://gist.githubusercontent.com/ww9/a26ca38836a62fbf3b8b85a190d5b2f0/raw";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(path.resolve(__dirname, ".."), "public", "glyph", "oneline-art.json");

async function main() {
  const res = await fetch(GIST_RAW);
  if (!res.ok) {
    throw new Error(`Gist fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const lines = parseOnelineArtText(text, ONELINE_ART_MAX_RAW_LINE);
  if (lines.length === 0) {
    throw new Error("No one-line art entries parsed from gist");
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        source: GIST_RAW,
        maxRawLine: ONELINE_ART_MAX_RAW_LINE,
        count: lines.length,
        lines,
      },
      null,
      0,
    )}\n`,
    "utf8",
  );
  console.log(
    `Wrote ${lines.length} one-line art entries (gist lines 1–${ONELINE_ART_MAX_RAW_LINE}, no emojis) → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
