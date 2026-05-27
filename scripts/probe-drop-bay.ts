/**
 * Local smoke probe for Drop Bay (D-1).
 * Usage: pnpm exec tsx scripts/probe-drop-bay.ts [baseUrl]
 */
import { JsonlDropStore } from "../src/lib/dropbay/dropbay-jsonl-store";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3050";

async function main() {
  const store = new JsonlDropStore();
  const created = await store.createDrop({
    text: "probe drop",
    url: "https://example.com/probe",
    source: "probe-script",
  });
  console.log("store.createDrop:", created.id);

  const listed = await store.listDrops({ limit: 5 });
  console.log("store.listDrops:", listed.length, "entries");

  try {
    const res = await fetch(`${baseUrl}/api/drop?text=hello&source=probe-get`);
    const body = await res.json();
    console.log("GET /api/drop:", res.status, body.ok ? body.drop?.id : body.error);
  } catch (error) {
    console.log("GET /api/drop: skipped (server not running)", error instanceof Error ? error.message : error);
  }
}

void main();
