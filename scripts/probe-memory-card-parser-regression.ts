import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadMemoryCard, validateMemoryCard } from "../src/lib/cards/load-memory-card";
import { scanMemoryCards } from "../src/lib/cards/scan-memory-cards";

let failedCount = 0;

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    failedCount++;
    return;
  }
  console.log(`PASS ${name}`);
}

console.log("=== Memory Card Parser Regression Probe ===\n");

const testDir = join(process.cwd(), "test-card-temp");

function setupDir() {
  try { mkdirSync(testDir, { recursive: true }); } catch {}
}
function cleanupDir() {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
}

function writeTestCard(name: string, content: string) {
  writeFileSync(join(testDir, `${name}.md`), content, "utf8");
}

setupDir();

console.log("--- Malformed Frontmatter ---");

writeTestCard("no-frontmatter", `# Just a header\n\nNo frontmatter here.`);
const noFm = loadMemoryCard(join(testDir, "no-frontmatter.md"));
assert("no frontmatter returns null", noFm === null);

writeTestCard("empty-frontmatter", `---\n---\n# Empty`);
const emptyFm = loadMemoryCard(join(testDir, "empty-frontmatter.md"));
assert("empty frontmatter returns null", emptyFm === null);

writeTestCard("malformed-yaml", `---\ncard_id: test\ncard_type: memory\n  invalid yaml indent\n---\n# Bad`);
const badYaml = loadMemoryCard(join(testDir, "malformed-yaml.md"));
assert("malformed YAML returns null", badYaml === null);

console.log("\n--- Missing Required Fields ---");

writeTestCard("missing-card-id", `---\ncard_type: memory\ntitle: Test Card\n---\n# Missing ID`);
const missingId = loadMemoryCard(join(testDir, "missing-card-id.md"));
assert("missing card_id returns null", missingId === null);

writeTestCard("missing-card-type", `---\ncard_id: test.card.v0\ntitle: Test Card\n---\n# Missing Type`);
const missingType = loadMemoryCard(join(testDir, "missing-card-type.md"));
assert("missing card_type returns null", missingType === null);

writeTestCard("missing-title", `---\ncard_id: test.card.v0\ncard_type: memory\n---\n# Missing Title`);
const missingTitle = loadMemoryCard(join(testDir, "missing-title.md"));
assert("missing title returns null", missingTitle === null);

console.log("\n--- Valid Minimal Card ---");

writeTestCard("valid-minimal", `---\ncard_id: test.valid-minimal.v0\ncard_type: memory\ntitle: Valid Minimal\n---\n# Minimal Valid Card`);
const validMinimal = loadMemoryCard(join(testDir, "valid-minimal.md"));
assert("valid minimal card loads", validMinimal !== null);
if (validMinimal) {
  assert("valid card has correct card_id", validMinimal.card_id === "test.valid-minimal.v0");
  assert("valid card has correct card_type", validMinimal.card_type === "memory");
  assert("valid card has correct title", validMinimal.title === "Valid Minimal");
  assert("valid card has content", validMinimal.content.length > 0);
}

console.log("\n--- Tag Parsing ---");

writeTestCard("tags-inline", `---\ncard_id: test.tags-inline.v0\ncard_type: memory\ntitle: Tags Inline\ntags: [alpha, beta, gamma]\n---\n# Tags`);
const tagsInline = loadMemoryCard(join(testDir, "tags-inline.md"));
assert("inline tags array parses", tagsInline?.tags !== undefined && tagsInline.tags.length === 3);
assert("inline tags correct values", tagsInline?.tags?.join(",") === "alpha,beta,gamma");

writeTestCard("tags-list", `---\ncard_id: test.tags-list.v0\ncard_type: memory\ntitle: Tags List\ntags:\n  - uno\n  - dos\n  - tres\n---\n# Tags`);
const tagsList = loadMemoryCard(join(testDir, "tags-list.md"));
assert("list tags parses", tagsList?.tags !== undefined && tagsList.tags.length === 3);
assert("list tags correct values", tagsList?.tags?.join(",") === "uno,dos,tres");

writeTestCard("tags-empty", `---\ncard_id: test.tags-empty.v0\ncard_type: memory\ntitle: Tags Empty\ntags:\n---\n# Empty Tags`);
const tagsEmpty = loadMemoryCard(join(testDir, "tags-empty.md"));
assert("empty tags array parses", Array.isArray(tagsEmpty?.tags));

console.log("\n--- Aliases Parsing ---");

writeTestCard("aliases-inline", `---\ncard_id: test.aliases.v0\ncard_type: memory\ntitle: Aliases Inline\naliases: [alias-one, alias-two]\n---\n# Aliases`);
const aliasesInline = loadMemoryCard(join(testDir, "aliases-inline.md"));
assert("inline aliases parses", aliasesInline?.aliases !== undefined && aliasesInline.aliases.length === 2);

writeTestCard("aliases-list", `---\ncard_id: test.aliases-list.v0\ncard_type: memory\ntitle: Aliases List\naliases:\n  - first-alias\n  - second-alias\n---\n# Aliases`);
const aliasesList = loadMemoryCard(join(testDir, "aliases-list.md"));
assert("list aliases parses", aliasesList?.aliases !== undefined && aliasesList.aliases.length === 2);

console.log("\n--- Related Cards ---");

writeTestCard("related-inline", `---\ncard_id: test.related.v0\ncard_type: memory\ntitle: Related Inline\nrelated_cards: [card-a.v0, card-b.v0]\n---\n# Related`);
const relatedInline = loadMemoryCard(join(testDir, "related-inline.md"));
assert("inline related_cards parses", relatedInline?.related_cards !== undefined && relatedInline.related_cards.length === 2);

writeTestCard("related-list", `---\ncard_id: test.related-list.v0\ncard_type: memory\ntitle: Related List\nrelated_cards:\n  - related-card-1.v0\n  - related-card-2.v0\n---\n# Related`);
const relatedList = loadMemoryCard(join(testDir, "related-list.md"));
assert("list related_cards parses", relatedList?.related_cards !== undefined && relatedList.related_cards.length === 2);

console.log("\n--- Duplicate ID Detection ---");

const dupTestDir = join(testDir, "dup-test");
try { mkdirSync(dupTestDir, { recursive: true }); } catch {}

function writeDupCard(name: string, content: string) {
  writeFileSync(join(dupTestDir, `${name}.md`), content, "utf8");
}

writeDupCard("dup-a", `---\ncard_id: duplicate.id.v0\ncard_type: memory\ntitle: Duplicate A\n---\n# A`);
writeDupCard("dup-b", `---\ncard_id: duplicate.id.v0\ncard_type: memory\ntitle: Duplicate B\n---\n# B`);
const dupResult = scanMemoryCards(dupTestDir);
assert("duplicate card_id detected", dupResult.registry.cards.length === 1, `Expected 1, got ${dupResult.registry.cards.length}`);
assert("duplicate errors reported", dupResult.errors.length > 0);
assert("first card kept", dupResult.registry.byId["duplicate.id.v0"]?.title === "Duplicate A");

console.log("\n--- Related Card Resolution ---");

const docsPath = join(process.cwd(), "docs");
const docsResult = scanMemoryCards(docsPath);
const docsRegistry = docsResult.registry;

const cardCatalog = docsRegistry.byId["echo-mirage.memory.card-catalog.v0"];
assert("card catalog exists", cardCatalog !== undefined);
if (cardCatalog) {
  assert("card catalog has related_cards", (cardCatalog.related_cards?.length ?? 0) > 0);
  const firstRelated = cardCatalog.related_cards?.[0];
  assert("related card resolves", docsRegistry.byId[firstRelated!] !== undefined);
}

console.log("\n--- Content Extraction ---");

writeTestCard("content-test", `---\ncard_id: test.content.v0\ncard_type: memory\ntitle: Content Test\n---\n\n# This is content\n\nSome body text here.\n\n---\n\nMore content after divider.`);
const contentCard = loadMemoryCard(join(testDir, "content-test.md"));
assert("content extracted", contentCard !== null && contentCard !== undefined);
if (contentCard) {
  assert("content not empty", contentCard.content.length > 0);
  assert("content starts with header", contentCard.content.startsWith("# This is content"));
}

console.log("\n--- Optional Fields ---");

writeTestCard("optional-fields", `---\ncard_id: test.optional.v0\ncard_type: memory\ntitle: Optional Fields\nproject: my-project\ndeck: my-deck\nrisk: caution\nclicks: 5\nversion: v1\n---\n# Optional`);
const optionalCard = loadMemoryCard(join(testDir, "optional-fields.md"));
assert("optional project parses", optionalCard?.project === "my-project");
assert("optional deck parses", optionalCard?.deck === "my-deck");
assert("optional risk parses", optionalCard?.risk === "caution");
assert("optional clicks parses", optionalCard?.clicks === 5);
assert("optional version parses", optionalCard?.version === "v1");

console.log("\n--- Validation Errors ---");

writeTestCard("validation-test", `---\ncard_id: test.validation.v0\ncard_type: memory\ntitle: Validation Test\n---\n# Test`);
const validationCard = loadMemoryCard(join(testDir, "validation-test.md"));
assert("valid card has no errors", validationCard !== null);
if (validationCard) {
  const result = validateMemoryCard(validationCard);
  assert("validation returns valid for valid card", result.valid);
  assert("validation returns empty errors for valid card", result.errors.length === 0);
}

console.log("\n### Summary");
console.log(`Parser edge cases tested.`);
if (failedCount === 0) {
  console.log("All assertions passed.");
} else {
  console.log(`${failedCount} assertion(s) failed.`);
  process.exit(1);
}

cleanupDir();