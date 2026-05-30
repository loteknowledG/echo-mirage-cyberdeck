#!/usr/bin/env node
/** Sync 1lineart.kulaone.com catalog → public/glyph/kulaone-oneline-art.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const KULAONE_ART_URL = "https://1lineart.kulaone.com/mock/art.json";
const KULAONE_SOURCE = "https://1lineart.kulaone.com/";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(path.resolve(__dirname, ".."), "public", "glyph", "kulaone-oneline-art.json");

/** @param {unknown} raw */
export function parseKulaoneEntries(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("kulaone art.json must be an array");
  }

  /** @type {Array<{ nid: string; title: string; art: string; category: string }>} */
  const entries = [];
  const seenArt = new Set();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (item);
    const art = typeof row.art === "string" ? row.art.trim() : "";
    if (!art) continue;
    if (seenArt.has(art)) continue;
    seenArt.add(art);

    entries.push({
      nid: String(row.nid ?? entries.length + 1),
      title: typeof row.title === "string" ? row.title.trim() : "Untitled",
      art,
      category: typeof row.category === "string" ? row.category.trim() : "",
    });
  }

  entries.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );

  return entries;
}

async function main() {
  const res = await fetch(KULAONE_ART_URL);
  if (!res.ok) {
    throw new Error(`kulaone art.json fetch failed: ${res.status}`);
  }
  const raw = await res.json();
  const entries = parseKulaoneEntries(raw);
  if (entries.length === 0) {
    throw new Error("No kulaone entries parsed");
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        source: KULAONE_SOURCE,
        data: KULAONE_ART_URL,
        count: entries.length,
        entries,
      },
      null,
      0,
    )}\n`,
    "utf8",
  );
  console.log(`Wrote ${entries.length} kulaone entries → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
