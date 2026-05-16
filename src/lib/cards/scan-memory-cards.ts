import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadMemoryCard, validateMemoryCard } from "./load-memory-card";
import type { MemoryCard, MemoryCardRegistry } from "./memory-card-schema";

export type ScanResult = {
  registry: MemoryCardRegistry;
  errors: string[];
  warnings: string[];
};

export function scanMemoryCards(docsPath: string): ScanResult {
  const cards: MemoryCard[] = [];
  const byId: Record<string, MemoryCard> = {};
  const byTag: Record<string, MemoryCard[]> = {};
  const byType: Record<string, MemoryCard[]> = {};

  const errors: string[] = [];
  const warnings: string[] = [];

  function scanDirectory(dirPath: string): void {
    let entries;
    try {
      entries = readdirSync(dirPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith(".md")) {
        const card = loadMemoryCard(fullPath);
        if (!card) {
          warnings.push(`Malformed frontmatter in: ${fullPath}`);
          continue;
        }

        const validation = validateMemoryCard(card);
        if (!validation.valid) {
          for (const err of validation.errors) {
            errors.push(`${err.filePath}: ${err.field} - ${err.message}`);
          }
          continue;
        }

        if (card.tags) {
          const nonStrings = card.tags.filter((t) => typeof t !== "string");
          if (nonStrings.length > 0) {
            errors.push(`${fullPath}: tags contains non-string values`);
            continue;
          }
        }

        if (card.aliases) {
          const nonStrings = card.aliases.filter((a) => typeof a !== "string");
          if (nonStrings.length > 0) {
            errors.push(`${fullPath}: aliases contains non-string values`);
            continue;
          }
          const lowerAliases = card.aliases.map((a) => a.toLowerCase());
          const uniqueLower = new Set(lowerAliases);
          if (uniqueLower.size !== card.aliases.length) {
            errors.push(`${fullPath}: duplicate aliases detected`);
            continue;
          }
        }

        if (card.related_cards) {
          const nonStrings = card.related_cards.filter((r) => typeof r !== "string");
          if (nonStrings.length > 0) {
            errors.push(`${fullPath}: related_cards contains non-string values`);
            continue;
          }
        }

        if (byId[card.card_id]) {
          errors.push(`Duplicate card_id: ${card.card_id} (first in: ${byId[card.card_id].filePath}, duplicate in: ${fullPath})`);
          continue;
        }

        cards.push(card);
        byId[card.card_id] = card;

        if (card.tags) {
          for (const tag of card.tags) {
            if (!byTag[tag]) {
              byTag[tag] = [];
            }
            byTag[tag].push(card);
          }
        }

        if (!byType[card.card_type]) {
          byType[card.card_type] = [];
        }
        byType[card.card_type].push(card);
      }
    }
  }

  scanDirectory(docsPath);

  for (const card of cards) {
    if (card.related_cards) {
      for (const relatedId of card.related_cards) {
        if (!byId[relatedId]) {
          errors.push(`Unresolved related_card: ${relatedId} (referenced by ${card.card_id} in ${card.filePath})`);
        }
      }
    }
  }

  return {
    registry: {
      cards,
      byId,
      byTag,
      byType,
    },
    errors,
    warnings,
  };
}

export function printRegistrySummary(registry: MemoryCardRegistry): void {
  console.log("=== Memory Card Registry Summary ===\n");
  console.log(`Total cards: ${registry.cards.length}`);
  console.log(`Unique IDs: ${Object.keys(registry.byId).length}`);
  console.log(`Tags: ${Object.keys(registry.byTag).length}`);
  console.log(`Types: ${Object.keys(registry.byType).length}\n`);

  console.log("--- By Type ---");
  for (const [type, typeCards] of Object.entries(registry.byType)) {
    console.log(`  ${type}: ${typeCards.length} card(s)`);
  }

  console.log("\n--- By Tag (top 10) ---");
  const tagEntries = Object.entries(registry.byTag).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  for (const [tag, tagCards] of tagEntries) {
    console.log(`  ${tag}: ${tagCards.length} card(s)`);
  }

  console.log("\n--- Cards ---");
  for (const card of registry.cards) {
    console.log(`  ${card.card_id}`);
    console.log(`    title: ${card.title}`);
    console.log(`    type: ${card.card_type}`);
    console.log(`    file: ${card.filePath}`);
    if (card.tags && card.tags.length > 0) {
      console.log(`    tags: ${card.tags.join(", ")}`);
    }
    if (card.related_cards && card.related_cards.length > 0) {
      console.log(`    related: ${card.related_cards.join(", ")}`);
    }
  }
}

export function printScanErrors(result: ScanResult): void {
  if (result.errors.length > 0) {
    console.log("\n=== ERRORS ===");
    for (const err of result.errors) {
      console.log(`  ERROR: ${err}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log("\n=== WARNINGS ===");
    for (const warn of result.warnings) {
      console.log(`  WARNING: ${warn}`);
    }
  }
  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log("\n=== No errors or warnings ===");
  }
}