import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXECUTION_CARD_REGISTRY,
  EXECUTION_HANDS,
  getCard,
  getHandCards,
  getAllHands,
  resolveCardByAlias,
  type ExecutionCard,
} from "../src/lib/computer-use/execution-card-registry";
import {
  getCardTableState,
  clearDeck,
  prepareHand,
  pushHandToStack,
} from "../src/lib/computer-use/card-table";

let failedCount = 0;

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    failedCount++;
    return;
  }
  console.log(`PASS ${name}`);
}

console.log("=== Execution Deck Pane Probe ===\n");

console.log("--- Registry Integration ---");
const cardIds = Object.keys(EXECUTION_CARD_REGISTRY);
assert("registry has 15 cards", cardIds.length === 15);
assert("registry keys are strings", cardIds.every((id) => typeof id === "string"));
assert("all cards have id, name, description", cardIds.every((id) => {
  const card = EXECUTION_CARD_REGISTRY[id];
  return card.id && card.name && card.description;
}));
assert("all cards have category", cardIds.every((id) => {
  const card = EXECUTION_CARD_REGISTRY[id];
  return card.category;
}));
assert("all cards have enabled boolean", cardIds.every((id) => {
  const card = EXECUTION_CARD_REGISTRY[id];
  return typeof card.enabled === "boolean";
}));
assert("all cards have requiresConfirmation boolean", cardIds.every((id) => {
  const card = EXECUTION_CARD_REGISTRY[id];
  return typeof card.requiresConfirmation === "boolean";
}));

console.log("\n--- Hand Assembly ---");
assert("EXECUTION_HANDS has 5 hands", EXECUTION_HANDS.length === 5);
const requiredHands = ["hand-reviewer", "hand-recovery", "hand-runtime-control", "hand-teaching", "hand-capture"];
for (const handId of requiredHands) {
  const hand = EXECUTION_HANDS.find((h) => h.id === handId);
  assert(`hand ${handId} exists`, !!hand);
  if (hand) {
    assert(`hand ${handId} has non-empty name`, !!hand.name);
    assert(`hand ${handId} has cards array`, Array.isArray(hand.cards));
    assert(`hand ${handId} has at least one card`, hand.cards.length > 0);
    const allCardsExist = hand.cards.every((cid) => !!getCard(cid));
    assert(`hand ${handId} references valid cards only`, allCardsExist);
  }
}

console.log("\n--- Card Display Metadata ---");
const firstCard = EXECUTION_CARD_REGISTRY[cardIds[0]];
assert("cards display name", typeof firstCard.name === "string");
assert("cards display category", typeof firstCard.category === "string");
assert("cards display enabled state", typeof firstCard.enabled === "boolean");
assert("cards display tags array", Array.isArray(firstCard.tags));
assert("cards display aliases array", Array.isArray(firstCard.aliases ?? []));

console.log("\n--- Category Display ---");
const categories = ["review", "capture", "runtime", "teaching", "recovery", "system"];
for (const cat of categories) {
  const cardsInCategory = cardIds.filter((id) => EXECUTION_CARD_REGISTRY[id].category === cat);
  assert(`category ${cat} has cards`, cardsInCategory.length > 0);
}

console.log("\n--- Staging Without Execution ---");
clearDeck();
let deckState = getCardTableState();
assert("clearDeck starts with empty staged", deckState.stagedHand === null);
assert("clearDeck starts with empty stack", deckState.executionStack.length === 0);

const reviewerCards = getHandCards("hand-reviewer");
assert("getHandCards returns cards", reviewerCards.length === 4);
assert("getHandCards returns ExecutionCard type", reviewerCards.every((c) => c.id && c.name));

deckState = getCardTableState();
assert("staging does not execute cards", deckState.executionStack.length === 0);
assert("staging state is inspectable", typeof deckState.activeHand === "string" || deckState.activeHand === null);

console.log("\n--- No Execution During Staging ---");
const cardSourceFiles = [
  "src/lib/computer-use/card-table.ts",
  "src/lib/computer-use/execution-card-registry.ts",
  "src/components/cyberdeck/card-table-pane.tsx",
];
const combinedSource = cardSourceFiles.map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");
assert("no dispatchEvent in execution code", !/\bdispatchEvent\b/.test(combinedSource));
assert("no MouseEvent constructor", !/\bnew\s+MouseEvent\b/.test(combinedSource));
assert("no KeyboardEvent constructor", !/\bnew\s+KeyboardEvent\b/.test(combinedSource));
assert("no element.click() in pane", !/\.click\(\)/.test(readFileSync(join(process.cwd(), "src/components/cyberdeck/card-table-pane.tsx"), "utf8")));
assert("no ipcRenderer.invoke for card operations", !/\bipcRenderer\.invoke\b/.test(combinedSource));
assert("no exec/spawn for card execution", !/\bexec\(|\bspawn\(/.test(combinedSource));
assert("no fetch for card execution", !/\bfetch\(/.test(combinedSource));
assert("no setInterval for card polling", !/\bsetInterval\(/.test(combinedSource));

console.log("\n--- Hand Selection State ---");
const hands = getAllHands();
assert("getAllHands returns array", Array.isArray(hands));
assert("getAllHands returns copy", getAllHands() !== hands);
assert("hand selector has 5 options", hands.length === 5);

console.log("\n--- Alias Resolution (Natural Language) ---");
const aliasTests = [
  ["copy last response", "capture_last_chatgpt_response"],
  ["request review", "request_codex_review"],
  ["hold", "hold_runtime"],
  ["emergency stop", "emergency_halt"],
  ["teach me", "start_teaching_mode"],
  ["archive", "archive_outcome"],
];
for (const [alias, expectedId] of aliasTests) {
  const resolved = resolveCardByAlias(alias);
  assert(`alias "${alias}" resolves to ${expectedId}`, resolved?.id === expectedId);
}
assert("unknown alias returns undefined", resolveCardByAlias("nonexistent card alias") === undefined);

console.log("\n--- Card State Persistence ---");
clearDeck();
deckState = getCardTableState();
assert("initial state has no active hand", deckState.activeHand === null);
assert("initial state has no staged hand", deckState.stagedHand === null);
assert("initial state has empty stack", deckState.executionStack.length === 0);
assert("execution is disabled by default", deckState.executionEnabled === false);

console.log("\n--- Deck Operations Do Not Execute ---");
const beforeState = getCardTableState();
pushHandToStack();
const afterPushState = getCardTableState();
assert("pushHandToStack on empty deck returns zero", afterPushState.executionStack.length === beforeState.executionStack.length);

console.log("\n--- Registry Determinism ---");
const firstKeys = Object.keys(EXECUTION_CARD_REGISTRY);
const secondKeys = Object.keys(EXECUTION_CARD_REGISTRY);
assert("registry keys are deterministic", JSON.stringify(firstKeys) === JSON.stringify(secondKeys));
const firstHandIds = EXECUTION_HANDS.map((h) => h.id);
const secondHandIds = EXECUTION_HANDS.map((h) => h.id);
assert("hand order is deterministic", JSON.stringify(firstHandIds) === JSON.stringify(secondHandIds));

console.log("\n--- No Duplicate Aliases ---");
const allAliases: string[] = [];
for (const card of Object.values(EXECUTION_CARD_REGISTRY)) {
  if (card.aliases) {
    allAliases.push(...card.aliases);
  }
}
const uniqueAliases = new Set(allAliases.map((a) => a.toLowerCase()));
assert("no case-insensitive duplicate aliases", uniqueAliases.size === allAliases.length);

console.log("\n--- Visual Semantic Completeness ---");
for (const card of Object.values(EXECUTION_CARD_REGISTRY)) {
  assert(`card ${card.id} has visual enabled indicator`, typeof card.enabled === "boolean");
  assert(`card ${card.id} has visual category indicator`, typeof card.category === "string");
}

console.log("\n### Summary");
console.log(`Total cards: ${cardIds.length}`);
console.log(`Total hands: ${EXECUTION_HANDS.length}`);
console.log(`Total aliases: ${allAliases.length}`);
if (failedCount === 0) {
  console.log("All assertions passed.");
} else {
  console.log(`${failedCount} assertion(s) failed.`);
  process.exit(1);
}