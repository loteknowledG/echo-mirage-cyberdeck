import { join } from "node:path";
import { scanMemoryCards, printRegistrySummary, printScanErrors } from "../src/lib/cards/scan-memory-cards";

let failedCount = 0;

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    failedCount++;
    return;
  }
  console.log(`PASS ${name}`);
}

console.log("=== Memory Card Registry Probe ===\n");

const docsPath = join(process.cwd(), "docs");
console.log(`Scanning: ${docsPath}\n`);

const result = scanMemoryCards(docsPath);
const { registry } = result;

console.log("\n--- Strict Validation ---");
assert("no errors in scan", result.errors.length === 0, result.errors.length > 0 ? result.errors : undefined);

console.log("\n--- Registry Structure ---");
assert("cards array exists", Array.isArray(registry.cards));
assert("byId is record", typeof registry.byId === "object");
assert("byTag is record", typeof registry.byTag === "object");
assert("byType is record", typeof registry.byType === "object");

console.log("\n--- Card Loading ---");
assert("at least one card loaded", registry.cards.length > 0, `Found ${registry.cards.length} cards`);

console.log("\n--- Identity Uniqueness ---");
const cardIds = registry.cards.map((c) => c.card_id);
const uniqueIds = new Set(cardIds);
assert("no duplicate card_ids", uniqueIds.size === cardIds.length, `Duplicate IDs: ${cardIds.length - uniqueIds.size}`);

console.log("\n--- Required Fields ---");
for (const card of registry.cards) {
  assert(`card ${card.card_id} has card_id`, !!card.card_id);
  assert(`card ${card.card_id} has card_type`, !!card.card_type);
  assert(`card ${card.card_id} has title`, !!card.title);
  assert(`card ${card.card_id} has filePath`, !!card.filePath);
}

console.log("\n--- Tag Indexing ---");
for (const card of registry.cards) {
  if (card.tags && card.tags.length > 0) {
    for (const tag of card.tags) {
      const cardsWithTag = registry.byTag[tag];
      assert(`tag "${tag}" indexes card ${card.card_id}`, cardsWithTag?.some((c) => c.card_id === card.card_id));
    }
  }
}

console.log("\n--- Type Indexing ---");
for (const card of registry.cards) {
  const typeCards = registry.byType[card.card_type];
  assert(`type "${card.card_type}" indexes card ${card.card_id}`, typeCards?.some((c) => c.card_id === card.card_id));
}

console.log("\n--- Related Cards Resolution ---");
for (const card of registry.cards) {
  if (card.related_cards && card.related_cards.length > 0) {
    for (const relatedId of card.related_cards) {
      const exists = !!registry.byId[relatedId];
      assert(`card ${card.card_id} related_cards "${relatedId}" resolves`, exists);
    }
  }
}

console.log("\n--- File Path Stability ---");
for (const card of registry.cards) {
  assert(`card ${card.card_id} filePath is absolute`, card.filePath.startsWith("/") || /^[A-Z]:\\/i.test(card.filePath));
}

console.log("\n--- Aliases Present ---");
const cardsWithAliases = registry.cards.filter((c) => c.aliases && c.aliases.length > 0);
assert("some cards have aliases", cardsWithAliases.length > 0, `Found ${cardsWithAliases.length} cards with aliases`);

console.log("\n### Summary");
console.log(`Total cards: ${registry.cards.length}`);
console.log(`Unique IDs: ${Object.keys(registry.byId).length}`);
console.log(`Tags: ${Object.keys(registry.byTag).length}`);
console.log(`Types: ${Object.keys(registry.byType).length}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Warnings: ${result.warnings.length}`);

if (failedCount === 0) {
  console.log("\nAll assertions passed.");
  printRegistrySummary(registry);
} else {
  console.log(`\n${failedCount} assertion(s) failed.`);
  printScanErrors(result);
  process.exit(1);
}