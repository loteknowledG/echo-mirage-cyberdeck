import { readFileSync } from "node:fs";
import type { MemoryCard, MemoryCardFrontmatter } from "./memory-card-schema";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const YAML_LINE_REGEX = /^(\w+):\s*(.*)$/;
const YAML_LIST_REGEX = /^(\w+):\s*$/;
const YAML_LIST_ITEM_REGEX = /^\s+-\s+(.*)$/;

function parseYamlValue(value: string): string | string[] | number {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    return inner.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return trimmed;
}

function parseFrontmatterYaml(frontmatterStr: string): Partial<MemoryCardFrontmatter> {
  const result: Partial<MemoryCardFrontmatter> = {};
  const lines = frontmatterStr.split("\n");
  let currentKey: string | null = null;
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const keyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2];

      if (value === "" && !trimmed.endsWith(":")) {
        const listMatch = trimmed.match(/^\w+:\s+\[(.*)\]\s*$/);
        if (listMatch) {
          result[currentKey as keyof MemoryCardFrontmatter] = listMatch[1].split(",").map(s => s.trim()) as never;
          currentKey = null;
          continue;
        }
      }

      if (value === "" || trimmed.endsWith(":")) {
        if (trimmed.endsWith(":") && !trimmed.includes("[")) {
          inList = true;
          result[currentKey as keyof MemoryCardFrontmatter] = [] as never;
        } else if (value) {
          result[currentKey as keyof MemoryCardFrontmatter] = parseYamlValue(value) as never;
          currentKey = null;
        }
      } else {
        result[currentKey as keyof MemoryCardFrontmatter] = parseYamlValue(value) as never;
        currentKey = null;
      }
    } else if (currentKey && inList) {
      const listItemMatch = trimmed.match(/^-\s+(.*)$/);
      if (listItemMatch) {
        const arr = result[currentKey as keyof MemoryCardFrontmatter] as string[];
        if (Array.isArray(arr)) {
          arr.push(listItemMatch[1].trim());
        }
      } else {
        inList = false;
        currentKey = null;
      }
    }
  }

  return result;
}

export function loadMemoryCard(filePath: string): MemoryCard | null {
  try {
    const content = readFileSync(filePath, "utf8");
    const match = content.match(FRONTMATTER_REGEX);

    if (!match) {
      return null;
    }

    const [, frontmatterStr, body] = match;
    const parsed = parseFrontmatterYaml(frontmatterStr);

    const required: Array<keyof MemoryCardFrontmatter> = ["card_id", "card_type", "title"];
    for (const field of required) {
      if (!parsed[field]) {
        return null;
      }
    }

    return {
      card_id: parsed.card_id!,
      card_type: parsed.card_type!,
      title: parsed.title!,
      project: parsed.project,
      deck: parsed.deck,
      clicks: parsed.clicks,
      tags: parsed.tags,
      aliases: parsed.aliases,
      related_cards: parsed.related_cards,
      version: parsed.version,
      filePath,
      content: body.trim(),
    };
  } catch {
    return null;
  }
}

export type ValidationError = {
  filePath: string;
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export function validateMemoryCard(card: MemoryCard): ValidationResult {
  const errors: ValidationError[] = [];
  const fp = card.filePath;

  if (!card.card_id) {
    errors.push({ filePath: fp, field: "card_id", message: "missing required card_id" });
  }

  if (!card.card_type) {
    errors.push({ filePath: fp, field: "card_type", message: "missing required card_type" });
  }

  if (!card.title) {
    errors.push({ filePath: fp, field: "title", message: "missing required title" });
  }

  if (card.tags !== undefined && !Array.isArray(card.tags)) {
    errors.push({ filePath: fp, field: "tags", message: "invalid tags: expected string array" });
  }

  if (card.aliases !== undefined && !Array.isArray(card.aliases)) {
    errors.push({ filePath: fp, field: "aliases", message: "invalid aliases: expected string array" });
  }

  if (card.related_cards !== undefined && !Array.isArray(card.related_cards)) {
    errors.push({ filePath: fp, field: "related_cards", message: "invalid related_cards: expected string array" });
  }

  return { valid: errors.length === 0, errors };
}

export function validateMemoryCardSimple(card: MemoryCard): string[] {
  return validateMemoryCard(card).errors.map((e) => `${e.filePath}: ${e.message}`);
}