// SERVER ONLY: reads continuity docs from disk. Do not import from client components.

import type { MemoryAtlasQueryIntent } from "@/lib/memory-atlas/memory-atlas-query";
import {
  buildMemoryAtlasIndex,
  findAdrForWorkOrder,
  findBestAdr,
  findBestVerification,
  findBestWorkOrder,
  findVerificationForWorkOrder,
  isActiveThreadStatus,
  type MemoryAtlasAdr,
  type MemoryAtlasIndex,
  type MemoryAtlasVerification,
  type MemoryAtlasWorkOrder,
} from "@/lib/memory-atlas/memory-atlas-index";

export type MemoryAtlasRetrievalResult = {
  memory_type: MemoryAtlasQueryIntent["kind"];
  response: string;
  result: Record<string, unknown>;
};

let cachedIndex: MemoryAtlasIndex | null = null;
let cachedRoot: string | null = null;

function getIndex(workspaceRoot: string): MemoryAtlasIndex {
  if (cachedIndex && cachedRoot === workspaceRoot) return cachedIndex;
  cachedIndex = buildMemoryAtlasIndex(workspaceRoot);
  cachedRoot = workspaceRoot;
  return cachedIndex;
}

function formatWorkOrderLine(entry: MemoryAtlasWorkOrder): string {
  return `${entry.id} — ${entry.summary} (status: ${entry.status}, owner: ${entry.owner})`;
}

function formatVerificationLine(entry: MemoryAtlasVerification): string {
  return `${entry.id} — ${entry.verdict} (work order: ${entry.workOrderId})`;
}

function formatAdrLine(entry: MemoryAtlasAdr): string {
  const decision = entry.decision || entry.summary;
  return `${entry.id}\nDecision: ${decision}${entry.consequences ? `\nConsequences: ${entry.consequences.split("\n")[0]}` : ""}`;
}

function buildWorkOrderResponse(index: MemoryAtlasIndex, topic: string): MemoryAtlasRetrievalResult {
  const workOrder = findBestWorkOrder(index, topic);
  if (!workOrder) {
    return {
      memory_type: "work_order",
      response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\nNo work order matched "${topic}".`,
      result: { topic, matched: false },
    };
  }

  const verification = findVerificationForWorkOrder(index, workOrder.id);
  const adr = findAdrForWorkOrder(index, workOrder.id) ?? (workOrder.adrId ? index.adrs.find((e) => e.id === workOrder.adrId) : undefined);

  const lines = [
    "[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]",
    "",
    `Work order: ${formatWorkOrderLine(workOrder)}`,
  ];
  if (verification) lines.push(`Verified by: ${verification.id}`);
  if (adr) lines.push(`ADR: ${adr.id} — ${adr.summary}`);

  return {
    memory_type: "work_order",
    response: lines.join("\n"),
    result: {
      id: workOrder.id,
      status: workOrder.status,
      owner: workOrder.owner,
      summary: workOrder.summary,
      verification_id: verification?.id ?? workOrder.verificationId ?? null,
      adr_id: adr?.id ?? workOrder.adrId ?? null,
      path: workOrder.relativePath,
    },
  };
}

function buildVerificationResponse(index: MemoryAtlasIndex, topic: string): MemoryAtlasRetrievalResult {
  const verification = findBestVerification(index, topic);
  if (!verification) {
    return {
      memory_type: "verification",
      response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\nNo verification matched "${topic}".`,
      result: { topic, matched: false },
    };
  }

  return {
    memory_type: "verification",
    response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\n${formatVerificationLine(verification)}`,
    result: {
      id: verification.id,
      verdict: verification.verdict,
      work_order_id: verification.workOrderId,
      summary: verification.summary,
      path: verification.relativePath,
    },
  };
}

function buildAdrResponse(index: MemoryAtlasIndex, topic: string): MemoryAtlasRetrievalResult {
  const adr = findBestAdr(index, topic);
  if (!adr) {
    return {
      memory_type: "adr",
      response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\nNo ADR matched "${topic}".`,
      result: { topic, matched: false },
    };
  }

  return {
    memory_type: "adr",
    response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\n${formatAdrLine(adr)}`,
    result: {
      id: adr.id,
      decision: adr.decision,
      consequences: adr.consequences,
      summary: adr.summary,
      work_order_id: adr.workOrderId ?? null,
      path: adr.relativePath,
    },
  };
}

function buildThreadResponse(
  index: MemoryAtlasIndex,
  kind: "active_threads" | "unfinished_threads",
): MemoryAtlasRetrievalResult {
  const active = index.workOrders.filter((entry) => isActiveThreadStatus(entry.status));
  const memoryThreads = active.filter((entry) => /L-MEM-/i.test(entry.id));
  const pool = kind === "unfinished_threads" && memoryThreads.length > 0 ? memoryThreads : active;

  if (pool.length === 0) {
    return {
      memory_type: kind,
      response: "[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\nNo active continuity threads found.",
      result: { threads: [] },
    };
  }

  const lines = pool.map((entry) => `- ${entry.id} (${entry.status}) — ${entry.summary}`);
  const header =
    kind === "unfinished_threads"
      ? "Unfinished / active memory threads:"
      : "Active continuity threads:";

  return {
    memory_type: kind,
    response: `[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\n${header}\n${lines.join("\n")}`,
    result: {
      threads: pool.map((entry) => ({
        id: entry.id,
        status: entry.status,
        owner: entry.owner,
        summary: entry.summary,
      })),
    },
  };
}

export function buildMemoryAtlasResponse(
  intent: MemoryAtlasQueryIntent,
  workspaceRoot = process.cwd(),
): MemoryAtlasRetrievalResult {
  const index = getIndex(workspaceRoot);

  switch (intent.kind) {
    case "work_order":
      return buildWorkOrderResponse(index, intent.topic ?? "");
    case "verification":
      return buildVerificationResponse(index, intent.topic ?? "");
    case "adr":
      return buildAdrResponse(index, intent.topic ?? "");
    case "active_threads":
      return buildThreadResponse(index, "active_threads");
    case "unfinished_threads":
      return buildThreadResponse(index, "unfinished_threads");
    default:
      return {
        memory_type: "work_order",
        response: "[MUTHUR // MEMORY ATLAS // CONTINUITY RETRIEVAL]\n\nUnhandled memory intent.",
        result: {},
      };
  }
}

/** Test helper — clears in-process index cache */
export function resetMemoryAtlasIndexCache(): void {
  cachedIndex = null;
  cachedRoot = null;
}

export { parseMemoryAtlasQuery } from "@/lib/memory-atlas/memory-atlas-query";
