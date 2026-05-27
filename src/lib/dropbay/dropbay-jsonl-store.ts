import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { dropBayStreamHub } from "@/lib/dropbay/dropbay-stream";
import type { DropStore } from "@/lib/dropbay/dropbay-store";
import {
  DROP_BAY_DEFAULT_LIMIT,
  DROP_BAY_JSONL_PATH,
  DROP_BAY_MAX_SOURCE_LENGTH,
  DROP_BAY_MAX_TEXT_LENGTH,
  DROP_BAY_MAX_URL_LENGTH,
  type CreateDropInput,
  type Drop,
  type ListDropsOptions,
} from "@/lib/dropbay/dropbay-types";

function dropsFilePath(): string {
  return path.join(process.cwd(), DROP_BAY_JSONL_PATH);
}

async function ensureDropDir(): Promise<void> {
  await fs.mkdir(path.dirname(dropsFilePath()), { recursive: true });
}

function normalizeInput(input: CreateDropInput): {
  text: string;
  url: string;
  source: string;
  imageUrl: string;
  mimeType: string;
} {
  const text = String(input.text ?? "").trim().slice(0, DROP_BAY_MAX_TEXT_LENGTH);
  const url = String(input.url ?? "").trim().slice(0, DROP_BAY_MAX_URL_LENGTH);
  const source = String(input.source ?? "unknown")
    .trim()
    .slice(0, DROP_BAY_MAX_SOURCE_LENGTH) || "unknown";
  const imageUrl = String(input.imageUrl ?? "").trim().slice(0, DROP_BAY_MAX_URL_LENGTH);
  const mimeType = String(input.mimeType ?? "").trim().slice(0, 64);
  return { text, url, source, imageUrl, mimeType };
}

export function validateCreateDropInput(input: CreateDropInput): string | null {
  const { text, url, imageUrl } = normalizeInput(input);
  if (!text && !url && !imageUrl) return "Provide text, url, or image.";
  return null;
}

function parseDropLine(line: string): Drop | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<Drop>;
    if (!parsed.id || !parsed.timestamp) return null;
    return {
      id: String(parsed.id),
      timestamp: String(parsed.timestamp),
      source: String(parsed.source ?? "unknown"),
      text: String(parsed.text ?? ""),
      url: String(parsed.url ?? ""),
      imageUrl: parsed.imageUrl ? String(parsed.imageUrl) : undefined,
      mimeType: parsed.mimeType ? String(parsed.mimeType) : undefined,
      status: parsed.status === "processed" || parsed.status === "failed" ? parsed.status : "pending",
    };
  } catch {
    return null;
  }
}

async function readAllDrops(): Promise<Drop[]> {
  try {
    const raw = await fs.readFile(dropsFilePath(), "utf8");
    const drops: Drop[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const drop = parseDropLine(line);
      if (drop) drops.push(drop);
    }
    return drops;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export class JsonlDropStore implements DropStore {
  async createDrop(input: CreateDropInput): Promise<Drop> {
    const error = validateCreateDropInput(input);
    if (error) throw new Error(error);

    const { text, url, source, imageUrl, mimeType } = normalizeInput(input);
    const drop: Drop = {
      id: `drop_${nanoid()}`,
      timestamp: new Date().toISOString(),
      source,
      text,
      url,
      imageUrl: imageUrl || undefined,
      mimeType: mimeType || undefined,
      status: "pending",
    };

    await ensureDropDir();
    await fs.appendFile(dropsFilePath(), `${JSON.stringify(drop)}\n`, "utf8");
    await this.broadcastDrop(drop);
    return drop;
  }

  async persistDrop(drop: Drop): Promise<void> {
    await ensureDropDir();
    await fs.appendFile(dropsFilePath(), `${JSON.stringify(drop)}\n`, "utf8");
  }

  async listDrops(options: ListDropsOptions = {}): Promise<Drop[]> {
    const limit = Math.max(1, Math.min(options.limit ?? DROP_BAY_DEFAULT_LIMIT, 500));
    const drops = await readAllDrops();
    return drops.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  async broadcastDrop(drop: Drop): Promise<void> {
    dropBayStreamHub.broadcastDrop(drop);
  }
}
