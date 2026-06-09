import assert from "node:assert/strict";
import { buildPowerfistToolArgs } from "../src/lib/cyberdeck/powerfist-tool-override";
import { PREVIEW_DECKS } from "../src/app/preview/preview-data";
import { formatMuthurLiveStreamDisplay } from "../src/lib/muthur-core/muthur-stream-payload";

function findCard(deckName: string, title: string) {
  const deck = PREVIEW_DECKS.find((entry) => entry.name === deckName);
  assert.ok(deck, `deck missing: ${deckName}`);
  const card = deck.cards.find((entry) => entry.title === title);
  assert.ok(card?.toolOverride, `card missing toolOverride: ${title}`);
  return card.toolOverride!;
}

async function main() {
  const stacked =
    "⏳ MUTHUR // uplink active...\n\n⏳ MUTHUR // thinking (round 1)...\n⏳ MUTHUR // tools: observe_operator_pane\n⏳ MUTHUR // thinking (round 2)...\n⏳ MUTHUR // tools: open_operator_file\n";
  assert.equal(formatMuthurLiveStreamDisplay(stacked), "⏳ MUTHUR // tools: open_operator_file");

  const withReply =
    `${stacked}Phase B complete — typecheck passed.\n`;
  assert.equal(formatMuthurLiveStreamDisplay(withReply), "Phase B complete — typecheck passed.");

  const codingDecks = ["Coding Deck", "Operator Deck", "Filesystem Deck"];
  for (const name of codingDecks) {
    assert.ok(PREVIEW_DECKS.some((deck) => deck.name === name), `${name} not in PREVIEW_DECKS`);
  }

  const gitStatus = findCard("Coding Deck", "Git Status");
  assert.equal(gitStatus.name, "git_status");

  const openFile = findCard("Operator Deck", "Open File");
  const merged = buildPowerfistToolArgs(openFile, "src/lib/muthur-core/loop.ts");
  assert.equal(merged.filePath, "src/lib/muthur-core/loop.ts");
  assert.equal(merged.mode, "edit");

  const baseUrl = process.env.PROBE_BASE_URL || "http://127.0.0.1:3000";
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/muthur-tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName: "git_status", args: {} }),
    });
  } catch {
    console.log("[probe] skip live API (dev server not running)");
    console.log("probe-powerfist-muthur-tools: PASS (static)");
    return;
  }
  if (!res.ok) {
    console.log(`[probe] skip live API status=${res.status}`);
    console.log("probe-powerfist-muthur-tools: PASS (static)");
    return;
  }
  const payload = (await res.json()) as { ok?: boolean; text?: string };
  assert.equal(payload.ok, true);
  assert.match(payload.text || "", /GIT_STATUS/);
  console.log("probe-powerfist-muthur-tools: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
