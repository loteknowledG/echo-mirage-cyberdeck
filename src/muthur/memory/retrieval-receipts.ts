import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

import type { MemoryRecord } from "./core";

export type MemoryRetrievalSourceType = "ship_memory" | "client_context";

export interface MemoryRetrievalReceiptItem {
  memory_id: number;
  source_type: MemoryRetrievalSourceType;
  score: number;
  snippet: string;
  memory_type: string;
}

export interface MemoryRetrievalReceipt {
  query: string;
  timestamp: string;
  client_context_present: boolean;
  selected: MemoryRetrievalReceiptItem[];
}

function receiptsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".muthur", "receipts", "memory");
}

export function writeMemoryRetrievalReceipt(args: {
  query: string;
  shipResults: MemoryRecord[];
  clientContext?: string;
  workspaceRoot?: string;
}): string {
  const workspaceRoot = args.workspaceRoot ?? process.cwd();
  const dir = receiptsDir(workspaceRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const client = typeof args.clientContext === "string" ? args.clientContext.trim() : "";
  const selected: MemoryRetrievalReceiptItem[] = [];

  if (client) {
    selected.push({
      memory_id: -1,
      source_type: "client_context",
      score: 1,
      snippet: client.slice(0, 240),
      memory_type: "client_memory",
    });
  }

  for (const row of args.shipResults) {
    selected.push({
      memory_id: row.id,
      source_type: "ship_memory",
      score: row.score ?? 0,
      snippet: row.text.slice(0, 240),
      memory_type: row.type,
    });
  }

  const timestamp = new Date().toISOString();
  const receipt: MemoryRetrievalReceipt = {
    query: args.query,
    timestamp,
    client_context_present: client.length > 0,
    selected,
  };

  const fileName = `${timestamp.replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, fileName);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2), "utf-8");
  return filePath;
}
