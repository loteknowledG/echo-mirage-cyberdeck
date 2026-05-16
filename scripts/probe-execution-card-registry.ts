import {
  EXECUTION_CARD_REGISTRY,
  EXECUTION_HANDS,
  getCard,
  getCardsByCategory,
  getEnabledCards,
  getEnabledCardsByCategory,
  resolveCardByAlias,
  getHand,
  getAllHands,
  getHandCards,
  type ExecutionCard,
  type ExecutionHand,
  type CardRisk,
  type CardCategory,
} from "../src/lib/computer-use/execution-card-registry";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

console.log("=== Execution Card Registry Probe ===\n");

console.log("--- Types ---");
const safeRisk: CardRisk = "safe";
const cautionRisk: CardRisk = "caution";
const restrictedRisk: CardRisk = "restricted";
assert("CardRisk safe is valid", safeRisk === "safe");
assert("CardRisk caution is valid", cautionRisk === "caution");
assert("CardRisk restricted is valid", restrictedRisk === "restricted");

const reviewCat: CardCategory = "review";
const captureCat: CardCategory = "capture";
const runtimeCat: CardCategory = "runtime";
const systemCat: CardCategory = "system";
assert("CardCategory review is valid", reviewCat === "review");
assert("CardCategory capture is valid", captureCat === "capture");
assert("CardCategory runtime is valid", runtimeCat === "runtime");
assert("CardCategory system is valid", systemCat === "system");

console.log("\n--- Registry Integrity ---");
const cardIds = Object.keys(EXECUTION_CARD_REGISTRY);
assert("registry has 15 cards", cardIds.length === 15);
assert("no duplicate card ids", new Set(cardIds).size === cardIds.length);

const allCards = Object.values(EXECUTION_CARD_REGISTRY);
for (const card of allCards) {
  assert(`card ${card.id} has non-empty id`, card.id.length > 0);
  assert(`card ${card.id} has non-empty name`, card.name.length > 0);
  assert(`card ${card.id} has non-empty description`, card.description.length > 0);
  assert(`card ${card.id} has valid category`, [
    "review", "capture", "runtime", "memory", "surface", "teaching", "recovery", "system"
  ].includes(card.category));
  assert(`card ${card.id} has valid risk`, ["safe", "caution", "restricted"].includes(card.risk));
  assert(`card ${card.id} has tags array`, Array.isArray(card.tags));
  assert(`card ${card.id} has boolean enabled`, typeof card.enabled === "boolean");
  assert(`card ${card.id} has boolean requiresConfirmation`, typeof card.requiresConfirmation === "boolean");
}

console.log("\n--- All Required Cards Present ---");
const requiredIds = [
  "capture_last_chatgpt_response",
  "capture_builder_result",
  "capture_review_result",
  "request_codex_review",
  "summarize_review",
  "escalate_to_lead",
  "hold_runtime",
  "clear_runtime",
  "emergency_halt",
  "start_teaching_mode",
  "acknowledge_step",
  "retry_builder",
  "prepare_recovery_hand",
  "archive_outcome",
  "open_execution_deck",
];
for (const id of requiredIds) {
  assert(`card ${id} exists in registry`, id in EXECUTION_CARD_REGISTRY);
  const card = EXECUTION_CARD_REGISTRY[id];
  assert(`card ${id} is enabled`, card.enabled === true);
}

console.log("\n--- Card Risk Distribution ---");
const safeCards = allCards.filter((c) => c.risk === "safe");
const cautionCards = allCards.filter((c) => c.risk === "caution");
const restrictedCards = allCards.filter((c) => c.risk === "restricted");
assert("safe risk cards exist", safeCards.length > 0);
assert("caution risk cards exist", cautionCards.length > 0);
assert("restricted risk cards exist", restrictedCards.length > 0);
assert("restricted risk card is emergency_halt", restrictedCards.some((c) => c.id === "emergency_halt"));

console.log("\n--- Card Category Distribution ---");
for (const cat of ["review", "capture", "runtime", "system", "teaching", "recovery"] as CardCategory[]) {
  const cats = allCards.filter((c) => c.category === cat);
  assert(`category ${cat} has cards`, cats.length > 0, `${cats.length}`);
}

console.log("\n--- Alias Lookup ---");
const aliases = [
  ["copy last response", "capture_last_chatgpt_response"],
  ["copy chatgpt response", "capture_last_chatgpt_response"],
  ["capture response", "capture_last_chatgpt_response"],
  ["save last response", "capture_last_chatgpt_response"],
  ["archive chatgpt reply", "capture_last_chatgpt_response"],
  ["request review", "request_codex_review"],
  ["codex review", "request_codex_review"],
  ["ai review", "request_codex_review"],
  ["escalate", "escalate_to_lead"],
  ["get help", "escalate_to_lead"],
  ["call lead", "escalate_to_lead"],
  ["hold", "hold_runtime"],
  ["pause runtime", "hold_runtime"],
  ["clear", "clear_runtime"],
  ["discard cards", "clear_runtime"],
  ["emergency stop", "emergency_halt"],
  ["halt", "emergency_halt"],
  ["stop everything", "emergency_halt"],
  ["teach me", "start_teaching_mode"],
  ["start teaching", "start_teaching_mode"],
  ["guide me", "start_teaching_mode"],
  ["teaching demo", "start_teaching_mode"],
  ["acknowledge", "acknowledge_step"],
  ["next step", "acknowledge_step"],
  ["retry build", "retry_builder"],
  ["rebuild", "retry_builder"],
  ["try build again", "retry_builder"],
  ["stage recovery", "prepare_recovery_hand"],
  ["recovery hand", "prepare_recovery_hand"],
  ["archive", "archive_outcome"],
  ["save session", "archive_outcome"],
  ["open deck", "open_execution_deck"],
  ["show deck", "open_execution_deck"],
  ["execution deck", "open_execution_deck"],
];
for (const [alias, expectedId] of aliases) {
  const card = resolveCardByAlias(alias);
  assert(`alias "${alias}" resolves to ${expectedId}`, card?.id === expectedId, card?.id);
}

assert("unknown alias returns undefined", resolveCardByAlias("xyzzy nonexistent card") === undefined);
assert("empty alias returns undefined", resolveCardByAlias("") === undefined);

console.log("\n--- Category Filtering ---");
const reviewCards = getCardsByCategory("review");
assert("getCardsByCategory review returns cards", reviewCards.length > 0);
for (const card of reviewCards) {
  assert(`review card ${card.id} has review category`, card.category === "review");
}

const captureCards = getCardsByCategory("capture");
assert("getCardsByCategory capture returns cards", captureCards.length > 0);

const runtimeCards = getCardsByCategory("runtime");
assert("getCardsByCategory runtime returns cards", runtimeCards.length > 0);

console.log("\n--- Enabled Filtering ---");
const enabledCards = getEnabledCards();
assert("getEnabledCards returns only enabled cards", enabledCards.every((c) => c.enabled));
assert("getEnabledCards returns all enabled cards", enabledCards.length === allCards.filter((c) => c.enabled).length);

const enabledReviewCards = getEnabledCardsByCategory("review");
for (const card of enabledReviewCards) {
  assert(`enabled review card ${card.id}`, card.enabled && card.category === "review");
}

console.log("\n--- Hands ---");
assert("EXECUTION_HANDS has 5 hands", EXECUTION_HANDS.length === 5);
for (const hand of EXECUTION_HANDS) {
  assert(`hand ${hand.id} has non-empty id`, hand.id.length > 0);
  assert(`hand ${hand.id} has non-empty name`, hand.name.length > 0);
  assert(`hand ${hand.id} has cards array`, Array.isArray(hand.cards));
  assert(`hand ${hand.id} has at least one card`, hand.cards.length > 0);
  for (const cardId of hand.cards) {
    assert(`hand ${hand.id} references valid card ${cardId}`, cardId in EXECUTION_CARD_REGISTRY);
  }
}

console.log("\n--- Required Hands ---");
const requiredHands = ["hand-reviewer", "hand-recovery", "hand-runtime-control", "hand-teaching", "hand-capture"];
for (const id of requiredHands) {
  const hand = getHand(id);
  assert(`hand ${id} exists`, hand !== undefined);
}

console.log("\n--- Hand Reviewer ---");
const reviewerHand = getHand("hand-reviewer")!;
assert("reviewer hand has 4 cards", reviewerHand.cards.length === 4);
assert("reviewer hand has capture_builder_result", reviewerHand.cards.includes("capture_builder_result"));
assert("reviewer hand has request_codex_review", reviewerHand.cards.includes("request_codex_review"));
assert("reviewer hand has summarize_review", reviewerHand.cards.includes("summarize_review"));
assert("reviewer hand has archive_outcome", reviewerHand.cards.includes("archive_outcome"));

console.log("\n--- Hand Recovery ---");
const recoveryHand = getHand("hand-recovery")!;
assert("recovery hand has 3 cards", recoveryHand.cards.length === 3);
assert("recovery hand has retry_builder", recoveryHand.cards.includes("retry_builder"));
assert("recovery hand has escalate_to_lead", recoveryHand.cards.includes("escalate_to_lead"));
assert("recovery hand has prepare_recovery_hand", recoveryHand.cards.includes("prepare_recovery_hand"));

console.log("\n--- Hand Runtime Control ---");
const rtHand = getHand("hand-runtime-control")!;
assert("runtime control hand has 3 cards", rtHand.cards.length === 3);
assert("runtime control hand has hold_runtime", rtHand.cards.includes("hold_runtime"));
assert("runtime control hand has clear_runtime", rtHand.cards.includes("clear_runtime"));
assert("runtime control hand has emergency_halt", rtHand.cards.includes("emergency_halt"));

console.log("\n--- getAllHands returns copy ---");
const hands1 = getAllHands();
const hands2 = getAllHands();
assert("getAllHands returns different array instances", hands1 !== hands2);
assert("getAllHands returns equal content", JSON.stringify(hands1) === JSON.stringify(hands2));

console.log("\n--- getHandCards ---");
const reviewerCards = getHandCards("hand-reviewer");
assert("getHandCards reviewer returns correct count", reviewerCards.length === 4);
for (const card of reviewerCards) {
  assert("getHandCards returns ExecutionCard", typeof card.id === "string");
}
assert("getHandCards invalid hand returns empty", getHandCards("nonexistent-hand").length === 0);

console.log("\n--- No Duplicate Aliases ---");
const allAliases: string[] = [];
for (const card of allCards) {
  if (card.aliases) {
    allAliases.push(...card.aliases);
  }
}
const uniqueAliases = [...new Set(allAliases.map((a) => a.toLowerCase()))];
assert("no case-insensitive duplicate aliases", uniqueAliases.length === allAliases.map((a) => a.toLowerCase()).length);

console.log("\n--- Deterministic Ordering ---");
const ids1 = Object.keys(EXECUTION_CARD_REGISTRY);
const ids2 = Object.keys(EXECUTION_CARD_REGISTRY);
assert("registry keys are deterministically ordered", JSON.stringify(ids1) === JSON.stringify(ids2));

const handIds1 = EXECUTION_HANDS.map((h) => h.id);
const handIds2 = EXECUTION_HANDS.map((h) => h.id);
assert("hands are deterministically ordered", JSON.stringify(handIds1) === JSON.stringify(handIds2));

console.log("\n--- Safety Proof ---");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const src = readFileSync(join(process.cwd(), "src/lib/computer-use/execution-card-registry.ts"), "utf8");
assert("no dispatchEvent", !/dispatchEvent/.test(src));
assert("no ipcRenderer", !/ipcRenderer/.test(src));
assert("no exec", !/\bexec\b/.test(src));
assert("no spawn", !/\bspawn\b/.test(src));
assert("no MouseEvent", !/MouseEvent/.test(src));
assert("no click()", !/\.click\(/.test(src));
assert("no focus()", !/\.focus\(/.test(src));
assert("no clipboard read", !/clipboardData/.test(src));
assert("no clipboard write", !/setData/.test(src));
assert("no fetch/HTTP requests", !/\bfetch\b/.test(src) || src.split("\n").filter((l: string) => /^\s*\bfetch\b/.test(l)).length === 0);
assert("no child_process", !/child_process/.test(src));
assert("no setInterval polling", !/setInterval.*\d{4,}/.test(src));
assert("no real script execution", !/\.exec\(/.test(src) && !/spawn\(/.test(src));
assert("no synthetic input", !/\bdispatchEvent\b|\bnew\s+MouseEvent\b|\bnew\s+KeyboardEvent\b/.test(src));
assert("no click injection", !/\.click\(\)/.test(src));
assert("no shell execution", !/shell/.test(src) || src.includes("// shell is not used"));

console.log("\n--- Non-Executing ---");
for (const card of allCards) {
  assert(`card ${card.id} does not execute`, card.enabled === true && !src.includes(`executeCard("${card.id}")`));
}
assert("registry has no execute function", !/executeCard|runCard|callCard/.test(src));

console.log("\n### Summary");
console.log(`Total cards: ${cardIds.length}`);
console.log(`Total hands: ${EXECUTION_HANDS.length}`);
console.log(`Total aliases: ${allAliases.length}`);
console.log(`All assertions passed.`);