import { MEMORY_CONTEXT_TIMEOUT_MS } from "@/lib/fetch-with-timeout";

interface MemoryCacheEntry {
  context: string;
  queryHash: string;
  timestamp: number;
}

const memoryContextCache = new Map<string, MemoryCacheEntry>();
const MEMORY_CONTEXT_TTL_MS = 60_000;

let muthurBootPromise: Promise<void> | null = null;

function hashQuery(query: string): string {
  let hash = 0;
  const text = query.toLowerCase().trim();
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function ensureMuthurBooted(): Promise<void> {
  if (!muthurBootPromise) {
    muthurBootPromise = (async () => {
      const { bootMuthur } = await import("@/muthur/boot/boot_muthur");
      await bootMuthur({ workspaceRoot: process.cwd() });
    })().catch((err) => {
      muthurBootPromise = null;
      throw err;
    });
  }
  await muthurBootPromise;
}

export async function getMuthurChatMemoryContext(
  message: string,
  clientMemory?: unknown,
): Promise<string> {
  const queryHash = hashQuery(message);
  const now = Date.now();
  const clientContext = typeof clientMemory === "string" ? clientMemory : "";

  const cached = memoryContextCache.get(queryHash);
  if (cached && now - cached.timestamp < MEMORY_CONTEXT_TTL_MS) {
    return cached.context;
  }

  try {
    await ensureMuthurBooted();
    const { buildMemoryContext } = await import("@/muthur/boot/boot_muthur");

    const ctx = await Promise.race([
      buildMemoryContext(message, { clientContext, workspaceRoot: process.cwd() }),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), MEMORY_CONTEXT_TIMEOUT_MS)),
    ]);
    const context = ctx || "";

    if (context.trim().length > 0) {
      memoryContextCache.set(queryHash, {
        context,
        queryHash,
        timestamp: now,
      });
    }

    for (const [key, entry] of memoryContextCache.entries()) {
      if (now - entry.timestamp >= MEMORY_CONTEXT_TTL_MS) {
        memoryContextCache.delete(key);
      }
    }

    return context;
  } catch {
    return "";
  }
}
