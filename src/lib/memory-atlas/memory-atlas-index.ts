import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type MemoryAtlasWorkOrder = {
  id: string;
  status: string;
  owner: string;
  summary: string;
  keywords: string[];
  relativePath: string;
  verificationId?: string;
  adrId?: string;
};

export type MemoryAtlasVerification = {
  id: string;
  verdict: string;
  workOrderId: string;
  summary: string;
  keywords: string[];
  relativePath: string;
};

export type MemoryAtlasAdr = {
  id: string;
  decision: string;
  consequences: string;
  summary: string;
  keywords: string[];
  workOrderId?: string;
  relativePath: string;
};

export type MemoryAtlasFoundation = {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  relativePath: string;
};

export type MemoryAtlasIndex = {
  workOrders: MemoryAtlasWorkOrder[];
  verifications: MemoryAtlasVerification[];
  adrs: MemoryAtlasAdr[];
  foundations: MemoryAtlasFoundation[];
};

const WORK_ORDER_ID_RE = /\b(L-(?:[A-Z]+-)*\d+[A-Z]?)\b/i;
const VERIFICATION_ID_RE = /\b(JP-[A-Z0-9-]+|JF-[A-Z0-9-]+)\b/i;
const ADR_ID_RE = /\b(ADR-[A-Z]+-\d+)\b/i;

const ACTIVE_STATUS_RE =
  /^(proposed|planned|in progress|active|open|blocked|pending|draft)$/i;
const COMPLETE_STATUS_RE =
  /^(implemented|complete|completed|done|pass|passed|accepted|preserved)$/i;

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listMarkdownFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listMarkdownFiles(full));
      continue;
    }
    if (/\.md$/i.test(entry)) files.push(full);
  }
  return files;
}

function fieldValue(text: string, label: string): string | undefined {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, "i");
  return text.match(re)?.[1]?.trim();
}

function sectionValue(text: string, heading: string): string | undefined {
  const re = new RegExp(`## ${heading}\\s*\\n+([^#]+)`, "i");
  const block = text.match(re)?.[1]?.trim();
  if (!block) return undefined;
  return block.split("\n").find((line) => line.trim())?.trim();
}

function keywordsFromText(text: string, id: string): string[] {
  const keywordsBlock = text.match(/## Keywords\s*\n+([^\n#]+)/i)?.[1]?.trim();
  const fromSection = keywordsBlock
    ? keywordsBlock.split(/[,;]/).map((part) => part.trim().toLowerCase()).filter(Boolean)
    : [];
  const fromSummary = (fieldValue(text, "Summary") ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);
  return [...new Set([id.toLowerCase(), ...fromSection, ...fromSummary])];
}

function relativeFromRoot(workspaceRoot: string, absPath: string): string {
  return path.relative(workspaceRoot, absPath).split(path.sep).join("/");
}

function parseWorkOrderFile(absPath: string, workspaceRoot: string): MemoryAtlasWorkOrder | null {
  const text = readText(absPath);
  if (!text) return null;

  const headingId = text.match(/^#\s+(L-(?:[A-Z]+-)*\d+[A-Z]?)/im)?.[1];
  const filenameId = path.basename(absPath).match(/^(L-(?:[A-Z]+-)*\d+[A-Z]?)/i)?.[1];
  const id = (headingId ?? filenameId)?.toUpperCase();
  if (!id) return null;

  return {
    id,
    status: fieldValue(text, "Status") ?? "Unknown",
    owner: fieldValue(text, "Owner") ?? "MUTHUR / Cadre",
    summary: fieldValue(text, "Summary") ?? text.match(/^#\s+[^\n]+/m)?.[0]?.replace(/^#\s+/, "") ?? id,
    keywords: keywordsFromText(text, id),
    relativePath: relativeFromRoot(workspaceRoot, absPath),
    verificationId: text.match(/\b(JP-[A-Z0-9-]+)\b/i)?.[1]?.toUpperCase(),
    adrId: text.match(/\b(ADR-[A-Z]+-\d+)\b/i)?.[1]?.toUpperCase(),
  };
}

function parseVerificationFile(absPath: string, workspaceRoot: string): MemoryAtlasVerification | null {
  const text = readText(absPath);
  if (!text) return null;

  const headingId = text.match(/^#\s+(JP-[A-Z0-9-]+|JF-[A-Z0-9-]+)/im)?.[1];
  const filenameId = path.basename(absPath).match(/^(JP-[A-Z0-9-]+|JF-[A-Z0-9-]+)/i)?.[1];
  const id = (headingId ?? filenameId)?.toUpperCase();
  if (!id) return null;

  const workOrderId =
    fieldValue(text, "Tied work order")?.toUpperCase() ??
    text.match(/\*\*Work order:\*\*\s*(L-(?:[A-Z]+-)*\d+[A-Z]?)/i)?.[1]?.toUpperCase() ??
    (id.startsWith("JP-") ? id.slice(3) : id.startsWith("JF-") ? id.slice(3) : id).toUpperCase();

  const verdictRaw = text.match(/## Verdict\s*\n+\*\*([^*]+)\*\*/i)?.[1]?.trim() ?? "Unknown";
  const titleTail =
    text.match(/^#\s+[^\n—-]+[—-]\s*([^\n]+)/m)?.[1]?.trim() ??
    text.match(/^#\s+[^\n]+/m)?.[0]?.replace(/^#\s+/, "") ??
    id;

  const titleKeywords = titleTail
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);

  return {
    id,
    verdict: verdictRaw,
    workOrderId,
    summary: titleTail,
    keywords: [...new Set([
      ...keywordsFromText(text, id),
      ...titleKeywords,
      workOrderId.toLowerCase(),
      id.replace(/^JP-/, "").replace(/^JF-/, "").toLowerCase(),
    ])],
    relativePath: relativeFromRoot(workspaceRoot, absPath),
  };
}

function parseAdrFile(absPath: string, workspaceRoot: string): MemoryAtlasAdr | null {
  const text = readText(absPath);
  if (!text) return null;

  const id = (text.match(/^#\s+(ADR-[A-Z]+-\d+)/im)?.[1] ?? path.basename(absPath).match(/^(ADR-[A-Z]+-\d+)/i)?.[1])?.toUpperCase();
  if (!id) return null;

  return {
    id,
    decision: sectionValue(text, "Decision") ?? fieldValue(text, "Decision") ?? "",
    consequences: sectionValue(text, "Consequences") ?? "",
    summary: text.match(/^#\s+[^\n—-]+[—-]\s*([^\n]+)/m)?.[1]?.trim() ?? id,
    keywords: keywordsFromText(text, id),
    workOrderId: text.match(/\*\*Work order:\*\*\s*(L-(?:[A-Z]+-)*\d+[A-Z]?)/i)?.[1]?.toUpperCase(),
    relativePath: relativeFromRoot(workspaceRoot, absPath),
  };
}

function parseFoundationRegistry(absPath: string, workspaceRoot: string): MemoryAtlasFoundation[] {
  const text = readText(absPath);
  if (!text) return [];

  const entries: MemoryAtlasFoundation[] = [];
  const idMatches = text.matchAll(/\*\*Artifact ID\*\*\s*\|\s*`([^`]+)`/gi);
  for (const match of idMatches) {
    const id = match[1].trim();
    entries.push({
      id,
      name: id,
      summary: "Immutable foundation origin artifact",
      keywords: [id, "foundation", "origin", "lineage"],
      relativePath: relativeFromRoot(workspaceRoot, absPath),
    });
  }

  if (entries.length === 0 && /foundation-001/i.test(text)) {
    entries.push({
      id: "foundation-001",
      name: "lets-remember-something-ai",
      summary: "Immutable origin artifact — Samus-Manus continuity lineage",
      keywords: ["foundation-001", "foundation", "origin", "lineage", "lets-remember-something-ai"],
      relativePath: relativeFromRoot(workspaceRoot, absPath),
    });
  }

  return entries;
}

export function scoreTopicMatch(
  topic: string,
  entry: { id: string; summary: string; keywords: string[] },
): number {
  const normalizedTopic = topic.toLowerCase();
  const haystack = `${entry.id} ${entry.summary} ${entry.keywords.join(" ")}`.toLowerCase();
  let score = 0;

  if (haystack.includes(normalizedTopic)) score += 12;

  const tokens = normalizedTopic.split(/\W+/).filter((token) => token.length > 2);
  for (const token of tokens) {
    if (haystack.includes(token)) score += 3;
  }

  return score;
}

export function isActiveThreadStatus(status: string): boolean {
  const trimmed = status.trim();
  if (!trimmed) return false;
  if (COMPLETE_STATUS_RE.test(trimmed)) return false;
  return ACTIVE_STATUS_RE.test(trimmed) || /progress|planned|proposed/i.test(trimmed);
}

export function buildMemoryAtlasIndex(workspaceRoot = process.cwd()): MemoryAtlasIndex {
  const workOrderPaths = [
    ...listMarkdownFiles(path.join(workspaceRoot, "docs", "work-orders")),
    ...listMarkdownFiles(path.join(workspaceRoot, "docs", "cadre", "tech-lead-legislator")),
  ];

  const workOrdersById = new Map<string, MemoryAtlasWorkOrder>();
  for (const absPath of workOrderPaths) {
    const parsed = parseWorkOrderFile(absPath, workspaceRoot);
    if (!parsed) continue;
    const existing = workOrdersById.get(parsed.id);
    if (!existing || absPath.includes(`${path.sep}work-orders${path.sep}`)) {
      workOrdersById.set(parsed.id, parsed);
    }
  }

  const verifications: MemoryAtlasVerification[] = [];
  for (const absPath of listMarkdownFiles(path.join(workspaceRoot, "docs", "verifications"))) {
    const parsed = parseVerificationFile(absPath, workspaceRoot);
    if (parsed) verifications.push(parsed);
  }

  const adrs: MemoryAtlasAdr[] = [];
  for (const absPath of listMarkdownFiles(path.join(workspaceRoot, "docs", "adr"))) {
    const parsed = parseAdrFile(absPath, workspaceRoot);
    if (parsed) adrs.push(parsed);
  }

  const foundations = [
    ...parseFoundationRegistry(path.join(workspaceRoot, "docs", "memory-recovery", "foundation-registry.md"), workspaceRoot),
    ...parseFoundationRegistry(path.join(workspaceRoot, "docs", "foundations", "README.md"), workspaceRoot),
  ];

  const dedupedFoundations = [...new Map(foundations.map((entry) => [entry.id, entry])).values()];

  return {
    workOrders: [...workOrdersById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    verifications: verifications.sort((a, b) => a.id.localeCompare(b.id)),
    adrs: adrs.sort((a, b) => a.id.localeCompare(b.id)),
    foundations: dedupedFoundations,
  };
}

export function findBestWorkOrder(index: MemoryAtlasIndex, topic: string): MemoryAtlasWorkOrder | null {
  let best: MemoryAtlasWorkOrder | null = null;
  let bestScore = 0;
  for (const entry of index.workOrders) {
    const score = scoreTopicMatch(topic, entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function findBestVerification(index: MemoryAtlasIndex, topic: string): MemoryAtlasVerification | null {
  let best: MemoryAtlasVerification | null = null;
  let bestScore = 0;
  for (const entry of index.verifications) {
    const score = scoreTopicMatch(topic, entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function findBestAdr(index: MemoryAtlasIndex, topic: string): MemoryAtlasAdr | null {
  let best: MemoryAtlasAdr | null = null;
  let bestScore = 0;
  for (const entry of index.adrs) {
    const score = scoreTopicMatch(topic, entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function findVerificationForWorkOrder(
  index: MemoryAtlasIndex,
  workOrderId: string,
): MemoryAtlasVerification | undefined {
  return index.verifications.find(
    (entry) =>
      entry.workOrderId.toUpperCase() === workOrderId.toUpperCase() ||
      entry.id.toUpperCase().includes(workOrderId.toUpperCase()),
  );
}

export function findAdrForWorkOrder(index: MemoryAtlasIndex, workOrderId: string): MemoryAtlasAdr | undefined {
  return index.adrs.find((entry) => entry.workOrderId?.toUpperCase() === workOrderId.toUpperCase());
}

export { WORK_ORDER_ID_RE, VERIFICATION_ID_RE, ADR_ID_RE };
