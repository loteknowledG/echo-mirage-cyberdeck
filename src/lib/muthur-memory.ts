import { del, get, set } from "idb-keyval";

export type MuthurMemoryTurnRole = "user" | "assistant";

export type MuthurMemoryTurn = {
  id: string;
  role: MuthurMemoryTurnRole;
  text: string;
  at: number;
};

export type MuthurMemoryState = {
  schemaVersion: 1;
  summary: string;
  facts: string[];
  recentTurns: MuthurMemoryTurn[];
  updatedAt: number;
  turnCount: number;
};

export const MUTHUR_MEMORY_STORAGE_KEY = "echo-mirage-muthur-memory-v1";
const MAX_FACTS = 16;
const MAX_RECENT_TURNS = 12;
const MAX_RELEVANT_SNIPPETS = 6;
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "for",
  "from",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "this",
  "to",
  "u",
  "we",
  "what",
  "when",
  "where",
  "which",
  "with",
  "you",
]);

function now() {
  return Date.now();
}

function clampText(text: string, limit = 180) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function tokenize(text: string) {
  return clampText(text, 1000)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !STOPWORDS.has(token)) ?? [];
}

function buildVector(text: string) {
  const vector = new Map<string, number>();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) || 0) + 1);
  }
  return vector;
}

function cosineSimilarity(aText: string, bText: string) {
  const a = buildVector(aText);
  const b = buildVector(bText);
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (const value of a.values()) {
    aNorm += value * value;
  }
  for (const value of b.values()) {
    bNorm += value * value;
  }
  for (const [token, aValue] of a.entries()) {
    const bValue = b.get(token) || 0;
    dot += aValue * bValue;
  }

  if (aNorm <= 0 || bNorm <= 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function dedupeStrings(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = clampText(value, 220);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function extractExplicitFacts(text: string) {
  const clean = clampText(text, 220);
  if (!clean) return [];

  const facts: string[] = [];
  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\bmy name is\s+(.+?)(?:[.!?]|$)/i, label: "User name" },
    { regex: /\bcall me\s+(.+?)(?:[.!?]|$)/i, label: "Preferred name" },
    { regex: /\bi like\s+(.+?)(?:[.!?]|$)/i, label: "Likes" },
    { regex: /\bi prefer\s+(.+?)(?:[.!?]|$)/i, label: "Preference" },
    { regex: /\bremember that\s+(.+?)(?:[.!?]|$)/i, label: "Remember" },
    { regex: /\buse\s+(.+?)(?:[.!?]|$)/i, label: "Use" },
  ];

  for (const { regex, label } of patterns) {
    const match = clean.match(regex);
    if (!match?.[1]) continue;
    facts.push(`${label}: ${match[1].trim()}`);
  }

  return facts;
}

function buildSummary(facts: string[], recentTurns: MuthurMemoryTurn[]) {
  if (facts.length > 0) {
    return `Remembered facts: ${facts.slice(-4).join("; ")}`;
  }
  if (recentTurns.length > 0) {
    const recent = recentTurns
      .slice(-4)
      .map((turn) => `${turn.role}: ${clampText(turn.text, 72)}`)
      .join(" | ");
    return `Recent continuity: ${recent}`;
  }
  return "No durable notes yet.";
}

type MuthurMemorySnippet = {
  kind: "fact" | "turn";
  text: string;
  score: number;
};

function selectRelevantSnippets(memory: MuthurMemoryState, query?: string) {
  const base = normalizeMemory(memory);
  const q = clampText(query || "", 280);
  const scored: MuthurMemorySnippet[] = [];

  for (const fact of base.facts) {
    const score = q ? cosineSimilarity(q, fact) : 0.35;
    scored.push({ kind: "fact", text: fact, score });
  }

  for (const turn of base.recentTurns) {
    const score = q ? cosineSimilarity(q, turn.text) : 0.2;
    scored.push({
      kind: "turn",
      text: `${turn.role}: ${clampText(turn.text, 180)}`,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RELEVANT_SNIPPETS);
}

export function createEmptyMuthurMemory(): MuthurMemoryState {
  return {
    schemaVersion: 1,
    summary: "No durable notes yet.",
    facts: [],
    recentTurns: [],
    updatedAt: now(),
    turnCount: 0,
  };
}

function normalizeMemory(raw: unknown): MuthurMemoryState {
  const base = createEmptyMuthurMemory();
  if (!raw || typeof raw !== "object") return base;

  const candidate = raw as Partial<MuthurMemoryState> & {
    recentTurns?: Array<Partial<MuthurMemoryTurn>>;
  };
  const facts = Array.isArray(candidate.facts) ? dedupeStrings(candidate.facts) : [];
  const recentTurns = Array.isArray(candidate.recentTurns)
    ? candidate.recentTurns
        .map((turn): MuthurMemoryTurn => ({
          id: typeof turn?.id === "string" ? turn.id : `${now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: turn?.role === "assistant" ? "assistant" : "user",
          text: typeof turn?.text === "string" ? turn.text : "",
          at: typeof turn?.at === "number" ? turn.at : now(),
        }))
        .filter((turn) => turn.text.trim())
        .slice(-MAX_RECENT_TURNS)
    : [];

  const turnCount =
    typeof candidate.turnCount === "number" && Number.isFinite(candidate.turnCount)
      ? Math.max(0, Math.floor(candidate.turnCount))
      : recentTurns.length;

  return {
    schemaVersion: 1,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary.trim()
        : buildSummary(facts, recentTurns),
    facts: facts.slice(-MAX_FACTS),
    recentTurns,
    updatedAt:
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : now(),
    turnCount,
  };
}

export type MuthurMemoryLoadResult = {
  state: MuthurMemoryState;
  /** IndexedDB / idb-keyval read failure; state falls back to empty memory. */
  error: string | null;
};

export async function loadMuthurMemoryWithResult(): Promise<MuthurMemoryLoadResult> {
  try {
    const stored = await get(MUTHUR_MEMORY_STORAGE_KEY);
    return { state: normalizeMemory(stored), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { state: createEmptyMuthurMemory(), error: message };
  }
}

export async function loadMuthurMemory(): Promise<MuthurMemoryState> {
  const { state } = await loadMuthurMemoryWithResult();
  return state;
}

export async function saveMuthurMemory(memory: MuthurMemoryState): Promise<void> {
  try {
    await set(MUTHUR_MEMORY_STORAGE_KEY, normalizeMemory(memory));
  } catch {
    /* ignore */
  }
}

export async function clearMuthurMemory(): Promise<void> {
  try {
    await del(MUTHUR_MEMORY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function recordMuthurMemoryTurn(
  current: MuthurMemoryState,
  userText: string,
  assistantText: string,
): MuthurMemoryState {
  const base = normalizeMemory(current);
  const nextRecent = [
    ...base.recentTurns,
    {
      id: `${now()}-u-${Math.random().toString(36).slice(2, 8)}`,
      role: "user" as const,
      text: clampText(userText, 260),
      at: now(),
    },
    {
      id: `${now()}-a-${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant" as const,
      text: clampText(assistantText, 260),
      at: now(),
    },
  ].filter((turn) => turn.text.trim());

  const nextFacts = dedupeStrings([
    ...base.facts,
    ...extractExplicitFacts(userText),
    ...extractExplicitFacts(assistantText),
  ]).slice(-MAX_FACTS);

  const trimmedRecent = nextRecent.slice(-MAX_RECENT_TURNS);

  return {
    schemaVersion: 1,
    facts: nextFacts,
    recentTurns: trimmedRecent,
    summary: buildSummary(nextFacts, trimmedRecent),
    updatedAt: now(),
    turnCount: base.turnCount + 2,
  };
}

export function buildMuthurMemoryContext(memory: MuthurMemoryState, query?: string): string {
  const normalized = normalizeMemory(memory);
  const relevant = selectRelevantSnippets(normalized, query);
  const lines: string[] = [];
  lines.push("MUTHUR MEMORY:");
  lines.push(`- Summary: ${normalized.summary}`);
  lines.push(`- Turns remembered: ${normalized.turnCount}`);

  if (normalized.facts.length > 0) {
    lines.push("- Facts:");
    for (const fact of normalized.facts.slice(-8)) {
      lines.push(`  - ${fact}`);
    }
  }

  if (normalized.recentTurns.length > 0) {
    lines.push("- Recent turns:");
    for (const turn of normalized.recentTurns.slice(-6)) {
      lines.push(`  - ${turn.role}: ${clampText(turn.text, 120)}`);
    }
  }

  if (relevant.length > 0) {
    lines.push("- Relevant memory hits:");
    for (const hit of relevant) {
      lines.push(`  - ${hit.kind}: ${hit.text}`);
    }
  }

  return lines.join("\n");
}
