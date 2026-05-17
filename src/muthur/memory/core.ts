import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

export type MemoryKind =
  | "conversation"
  | "startup_sequencer"
  | "runtime_identity"
  | "tool_technique"
  | "technique"
  | "project_learning"
  | "workflow_tip"
  | "observation"
  | "receipt"
  | "doctrine"
  | "identity"
  | "daily_memory"
  | "canonical_doc";

export interface MemoryRecord {
  id: number;
  type: string;
  text: string;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  created_at: number;
  score?: number;
}

export interface MemoryOptions {
  path?: string;
  wSemantic?: number;
  wLexical?: number;
  wRecency?: number;
  wMetadata?: number;
  dedupThreshold?: number;
  minRelevanceThreshold?: number;
}

const DEFAULT_WEIGHTS = {
  semantic: 0.6,
  lexical: 0.25,
  recency: 0.1,
  metadata: 0.05,
};

const DEFAULT_DEDUP_THRESHOLD = 0.92;
const DEFAULT_MIN_RELEVANCE = 0.08;
const HALF_LIFE_DAYS = 30;
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "for",
  "from", "have", "he", "her", "his", "how", "i", "if", "in", "is", "it", "its",
  "me", "my", "no", "not", "of", "on", "or", "our", "that", "the", "their",
  "them", "then", "there", "this", "to", "we", "what", "when", "where", "which", "with", "you",
]);

let _sqlPromise: Promise<SqlJsStatic> | null = null;
type SqlRow = SqlValue[];

function getSqlJs() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file: string) => {
        if (typeof process !== "undefined" && process.versions?.node) {
          return path.join(process.cwd(), "node_modules", "sql.js", "dist", file);
        }
        return `https://sql.js.org/dist/${file}`;
      },
    });
  }
  return _sqlPromise;
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => !STOPWORDS.has(t));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  aNorm = Math.sqrt(aNorm);
  bNorm = Math.sqrt(bNorm);
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (aNorm * bNorm);
}

function recencyScore(createdAt: number, nowTs: number): number {
  const ageSeconds = Math.max(0, nowTs - createdAt);
  const halfLife = HALF_LIFE_DAYS * 24 * 3600;
  return Math.exp(-Math.LN2 * (ageSeconds / halfLife));
}

function lexScore(query: string, candidate: string): number {
  const qTokens = tokenize(query);
  const cTokens = tokenize(candidate);
  if (!qTokens.length || !cTokens.length) return 0;

  const qSet = new Set(qTokens);
  const cSet = new Set(cTokens);
  const overlap = [...qSet].filter(t => cSet.has(t)).length;

  if (overlap === 0) {
    return query.toLowerCase().includes(candidate.toLowerCase()) ? 0.2 : 0;
  }

  const precision = overlap / qTokens.length;
  const recall = overlap / cTokens.length;
  return (2 * precision * recall) / (precision + recall + 1e-12);
}

function canonicalText(text: string): string {
  return tokenize(text).join(" ");
}

export class Memory {
  private db: Database | null = null;
  private dbPath: string;
  private wSemantic: number;
  private wLexical: number;
  private wRecency: number;
  private wMetadata: number;
  private dedupThreshold: number;
  private minRelevanceThreshold: number;
  private _ready: Promise<void>;
  private _dirty: boolean = false;

  constructor(options: MemoryOptions = {}) {
    this.dbPath = options.path ?? ".muthur/memory/muthur-memory.db";
    this.wSemantic = options.wSemantic ?? DEFAULT_WEIGHTS.semantic;
    this.wLexical = options.wLexical ?? DEFAULT_WEIGHTS.lexical;
    this.wRecency = options.wRecency ?? DEFAULT_WEIGHTS.recency;
    this.wMetadata = options.wMetadata ?? DEFAULT_WEIGHTS.metadata;
    this.dedupThreshold = options.dedupThreshold ?? DEFAULT_DEDUP_THRESHOLD;
    this.minRelevanceThreshold = options.minRelevanceThreshold ?? DEFAULT_MIN_RELEVANCE;
    this._ready = this._init();
  }

  private async _init(): Promise<void> {
    try {
      const SQL = await getSqlJs();

      const dbDir = path.dirname(this.dbPath);
      if (dbDir && !existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      if (existsSync(this.dbPath)) {
        try {
          const fileBuffer = readFileSync(this.dbPath);
          this.db = new SQL.Database(fileBuffer);
        } catch {
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }

      this.db.run(`
        CREATE TABLE IF NOT EXISTS memories (
          id INTEGER PRIMARY KEY,
          type TEXT,
          text TEXT,
          metadata TEXT,
          embedding TEXT,
          created_at REAL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS memory_terms (
          memory_id INTEGER,
          term TEXT,
          weight REAL DEFAULT 1.0,
          PRIMARY KEY (memory_id, term)
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memory_terms_term ON memory_terms(term)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_memory_terms_memory_id ON memory_terms(memory_id)`);

      this.db.run(`CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY,
        type TEXT,
        operation TEXT,
        artifact TEXT,
        metadata TEXT,
        created_at REAL
      )`);
    } catch (err) {
      console.error("[MUTHUR:Memory] Init failed:", err);
    }
  }

  async ready(): Promise<void> {
    await this._ready;
  }

  flush(): void {
    if (!this.db || !this._dirty) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dbDir = path.dirname(this.dbPath);
      if (dbDir && !existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }
      writeFileSync(this.dbPath, buffer);
      this._dirty = false;
    } catch (err) {
      console.error("[MUTHUR:Memory] Flush failed:", err);
    }
  }

  private _normalizeWeights(): [number, number, number, number] {
    const vals = [this.wSemantic, this.wLexical, this.wRecency, this.wMetadata];
    const nonNeg = vals.map(v => Math.max(0, v));
    const sum = nonNeg.reduce((a, b) => a + b, 0);
    if (sum <= 0) return [0.6, 0.25, 0.1, 0.05];
    return nonNeg.map(v => v / sum) as [number, number, number, number];
  }

  private _indexTerms(memoryId: number, kind: string, text: string, metadata?: Record<string, unknown>): void {
    if (!this.db) return;

    const terms = new Set<string>();
    for (const term of tokenize(kind)) terms.add(term);
    for (const term of tokenize(text)) terms.add(term);

    if (metadata) {
      const metaStr = JSON.stringify(metadata);
      for (const term of tokenize(metaStr)) terms.add(term);
    }

    if (terms.size === 0) return;

    const stmt = this.db.prepare(`INSERT OR IGNORE INTO memory_terms (memory_id, term, weight) VALUES (?, ?, ?)`);
    for (const term of terms) {
      stmt.run([memoryId, term, 1.0]);
    }
    stmt.free();
  }

  private _fetchRow(memoryId: number): MemoryRecord | null {
    if (!this.db) return null;

    const result = this.db.exec(
      `SELECT id, type, text, metadata, embedding, created_at FROM memories WHERE id = ?`,
      [memoryId]
    );

    if (!result.length || !result[0].values.length) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as number,
      type: row[1] as string,
      text: row[2] as string,
      metadata: JSON.parse((row[3] as string) || "{}"),
      embedding: row[4] ? JSON.parse(row[4] as string) : null,
      created_at: row[5] as number,
    };
  }

  updateMetadata(memoryId: number, updates: Record<string, unknown>): MemoryRecord | null {
    if (!this.db) return null;
    const row = this._fetchRow(memoryId);
    if (!row) return null;
    const meta = { ...row.metadata, ...updates };
    this.db.run(`UPDATE memories SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), memoryId]);
    this._dirty = true;
    row.metadata = meta;
    return row;
  }

  private _findDuplicate(kind: string, text: string): MemoryRecord | null {
    if (!this.db) return null;
    const canonical = canonicalText(text);
    if (!canonical) return null;

    const result = this.db.exec(
      `SELECT id, type, text, metadata, embedding, created_at FROM memories WHERE type = ?`,
      [kind]
    );
    if (!result.length) return null;

    for (const row of result[0].values) {
      const rowText = row[2] as string;
      if (canonicalText(rowText) === canonical) {
        return {
          id: row[0] as number,
          type: row[1] as string,
          text: rowText,
          metadata: JSON.parse((row[3] as string) || "{}"),
          embedding: row[4] ? JSON.parse(row[4] as string) : null,
          created_at: row[5] as number,
        };
      }
    }
    return null;
  }

  add(kind: string, text: string, metadata?: Record<string, unknown>): number | null {
    if (!this.db) return null;

    const existing = this._findDuplicate(kind, text);
    if (existing) {
      this.reinforceMemory(existing.id, "duplicate prevention");
      return existing.id;
    }

    const ts = Date.now();
    const metaJson = JSON.stringify(metadata ?? {});

    this.db.run(
      `INSERT INTO memories (type, text, metadata, embedding, created_at) VALUES (?, ?, ?, ?, ?)`,
      [kind, text, metaJson, null, ts]
    );

    const result = this.db.exec(`SELECT last_insert_rowid()`);
    const memoryId = result[0]?.values[0]?.[0] as number;

    if (memoryId) {
      this._indexTerms(memoryId, kind, text, metadata);
      this._dirty = true;
    }

    return memoryId;
  }

  addWithEmbedding(kind: string, text: string, embedding: number[], metadata?: Record<string, unknown>): number | null {
    if (!this.db) return null;

    const existing = this._findDuplicate(kind, text);
    if (existing) {
      this.reinforceMemory(existing.id, "duplicate prevention");
      return existing.id;
    }

    const ts = Date.now();
    const metaJson = JSON.stringify(metadata ?? {});
    const embJson = JSON.stringify(embedding);

    this.db.run(
      `INSERT INTO memories (type, text, metadata, embedding, created_at) VALUES (?, ?, ?, ?, ?)`,
      [kind, text, metaJson, embJson, ts]
    );

    const result = this.db.exec(`SELECT last_insert_rowid()`);
    const memoryId = result[0]?.values[0]?.[0] as number;

    if (memoryId) {
      this._indexTerms(memoryId, kind, text, metadata);
      this._dirty = true;
    }

    return memoryId;
  }

  all(limit: number = 100): MemoryRecord[] {
    if (!this.db) return [];

    const result = this.db.exec(
      `SELECT id, type, text, metadata, embedding, created_at FROM memories ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );

    if (!result.length) return [];

    return result[0].values.map((row: SqlRow) => ({
      id: row[0] as number,
      type: row[1] as string,
      text: row[2] as string,
      metadata: JSON.parse((row[3] as string) || "{}"),
      embedding: row[4] ? JSON.parse(row[4] as string) : null,
      created_at: row[5] as number,
    }));
  }

  query_similar(
    query: string,
    topK: number = 5,
    metadataFilter?: Record<string, unknown>,
    strictMetadataFilter: boolean = false
  ): MemoryRecord[] {
    if (!this.db) return [];

    const nowTs = Date.now();
    const [wSem, wLex, wRec, wMeta] = this._normalizeWeights();

    const candidateIds = this._candidateIds(query, metadataFilter, 750);
    if (!candidateIds.length) return [];
    if (candidateIds.length > 900) candidateIds.length = 900;

    const placeholders = candidateIds.map(() => "?").join(",");
    const result = this.db.exec(
      `SELECT id, type, text, metadata, embedding, created_at FROM memories WHERE id IN (${placeholders})`,
      candidateIds
    );

    if (!result.length) return [];

    const rows = result[0].values;

    const semanticById: Map<number, number> = new Map();
    for (const row of rows) {
      const emb = row[4] ? JSON.parse(row[4] as string) : null;
      if (!emb) continue;
    }

    const ranked: Array<{ score: number; record: MemoryRecord }> = [];

    for (const row of rows) {
      const rid = row[0] as number;
      const rType = row[1] as string;
      const rText = row[2] as string;
      const rMeta = JSON.parse((row[3] as string) || "{}");
      const rCreated = row[5] as number;

      if (strictMetadataFilter && metadataFilter) {
        const match = Object.entries(metadataFilter).every(([k, v]) => rMeta[k] === v);
        if (!match) continue;
      }

      const emb = row[4] ? JSON.parse(row[4] as string) : null;
      const semantic = 0;
      const lexical = lexScore(query, rText);
      const recency = recencyScore(rCreated, nowTs);

      let metaBoost = 0;
      if (metadataFilter) {
        const matches = Object.entries(metadataFilter).filter(([k, v]) => rMeta[k] === v).length;
        metaBoost = matches / Object.keys(metadataFilter).length;
      }

      const score = wSem * semantic + wLex * lexical + wRec * recency + wMeta * metaBoost;

      if (score < this.minRelevanceThreshold && metaBoost <= 0) continue;
      if (lexical < 0.01 && semantic < 0.01 && metaBoost <= 0) continue;

      ranked.push({
        score,
        record: {
          id: rid,
          type: rType,
          text: rText,
          metadata: rMeta,
          embedding: emb,
          created_at: rCreated,
          score,
        },
      });
    }

    ranked.sort((a, b) => b.score - a.score);

    const canonicals: string[] = [];
    const out: MemoryRecord[] = [];

    for (const { record } of ranked) {
      if (!record.text) continue;
      const canonical = canonicalText(record.text);

      const isDupe = canonicals.some(seen => {
        if (canonical === seen) return true;
        if (canonical.length > 0 && seen.length > 0) {
          let matches = 0;
          const maxLen = Math.max(canonical.length, seen.length);
          for (let i = 0; i < Math.min(canonical.length, seen.length); i++) {
            if (canonical[i] === seen[i]) matches++;
          }
          return (matches / maxLen) >= this.dedupThreshold;
        }
        return false;
      });

      if (isDupe) continue;

      canonicals.push(canonical);
      out.push(record);
      if (out.length >= topK) break;
    }

    return out;
  }

  private _candidateIds(query: string, metadataFilter?: Record<string, unknown>, limit: number = 500): number[] {
    if (!this.db) return [];

    const queryTerms = [...new Set([...tokenize(query)])];
    const metaTerms = metadataFilter ? [...new Set(tokenize(JSON.stringify(metadataFilter)))] : [];
    const terms = [...new Set([...queryTerms, ...metaTerms])];

    if (terms.length === 0) {
      const result = this.db.exec(`SELECT id FROM memories ORDER BY created_at DESC LIMIT ?`, [limit]);
      return result[0]?.values.map((r: SqlRow) => r[0] as number) ?? [];
    }

    const placeholders = terms.map(() => "?").join(",");
    const result = this.db.exec(
      `SELECT memory_id, COUNT(*) as hits FROM memory_terms WHERE term IN (${placeholders}) GROUP BY memory_id ORDER BY hits DESC, memory_id DESC LIMIT ?`,
      [...terms, limit]
    );

    if (result.length && result[0].values.length) {
      return result[0].values.map((r: SqlRow) => r[0] as number);
    }

    return [];
  }

  reinforceMemory(memoryId: number, reason?: string, boost: number = 0.08): MemoryRecord | null {
    if (!this.db) return null;

    const row = this._fetchRow(memoryId);
    if (!row) return null;

    const meta = { ...row.metadata };
    const reinforcementCount = (meta.reinforcement_count as number) || 0;
    const lastRecalledAt = Date.now();
    let stability = (meta.stability as number) || 0;
    if (stability <= 0) stability = 0.4;
    stability = Math.min(1.0, stability + boost);

    meta.reinforcement_count = reinforcementCount + 1;
    meta.last_recalled_at = lastRecalledAt;
    meta.stability = stability;
    if (reason) meta.reinforced_reason = reason;

    this.db.run(`UPDATE memories SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), memoryId]);
    this._dirty = true;

    return { ...row, metadata: meta };
  }

  recordTechnique(
    toolName: string,
    technique: string,
    task?: string,
    outcome?: string,
    metadata?: Record<string, unknown>,
    scopeType: string = "portable",
    scopeName?: string
  ): number | null {
    if (!this.db || !technique?.trim()) return null;

    const meta: Record<string, unknown> = {
      source: metadata?.source || "memory",
      captured_at: Date.now(),
      tool: toolName || "unknown",
      scope_type: scopeType,
      scope: scopeType,
      kind: "technique",
      long_term: true,
      ...metadata,
    };
    if (scopeName) meta.scope_name = scopeName;
    if (task) meta.task = task;
    if (outcome) meta.outcome = outcome;

    return this.add("tool_technique", technique.trim(), meta);
  }

  recallTechniques(
    query: string = "",
    topK: number = 5,
    toolName?: string,
    reinforce: boolean = true
  ): MemoryRecord[] {
    const candidates = query
      ? this.query_similar(query || toolName || "", topK * 4, undefined, false)
      : this.all(500);

    const toolNeed = (toolName || "").toLowerCase().trim();

    const filtered = candidates.filter(row => {
      if (!["tool_technique", "technique", "project_learning", "workflow_tip"].includes(row.type)) {
        return false;
      }
      if (!toolNeed) return true;
      const meta = row.metadata || {};
      const rowTool = ((meta.tool as string) || (meta.tool_name as string) || row.type || "").toLowerCase();
      return toolNeed && (rowTool.includes(toolNeed) || toolNeed.includes(rowTool));
    });

    if (reinforce) {
      for (const row of filtered.slice(0, topK)) {
        this.reinforceMemory(row.id, `recalled for: ${query || toolName || "technique"}`);
      }
    }

    return filtered.slice(0, topK);
  }

  getMemoryCount(): number {
    if (!this.db) return 0;
    const result = this.db.exec(`SELECT COUNT(*) FROM memories`);
    return (result[0]?.values[0]?.[0] as number) ?? 0;
  }

  addReceipt(type: string, operation: string, artifact: string, metadata?: Record<string, unknown>): number | null {
    if (!this.db) return null;
    const ts = Date.now();
    const metaJson = JSON.stringify(metadata ?? {});
    this.db.run(
      `INSERT INTO receipts (type, operation, artifact, metadata, created_at) VALUES (?, ?, ?, ?, ?)`,
      [type, operation, artifact, metaJson, ts]
    );
    const result = this.db.exec(`SELECT last_insert_rowid()`);
    this._dirty = true;
    return result[0]?.values[0]?.[0] as number ?? null;
  }

  getRecentReceipts(limit: number = 50): Array<{
    id: number;
    type: string;
    operation: string;
    artifact: string;
    metadata: Record<string, unknown>;
    created_at: number;
  }> {
    if (!this.db) return [];
    const result = this.db.exec(
      `SELECT id, type, operation, artifact, metadata, created_at FROM receipts ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    if (!result.length) return [];
    return result[0].values.map((row: SqlRow) => ({
      id: row[0] as number,
      type: row[1] as string,
      operation: row[2] as string,
      artifact: row[3] as string,
      metadata: JSON.parse((row[4] as string) || "{}"),
      created_at: row[5] as number,
    }));
  }

  close(): void {
    this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

let _globalMemory: Memory | null = null;

export function getMemory(options?: MemoryOptions): Memory {
  if (!_globalMemory) {
    _globalMemory = new Memory(options);
  }
  return _globalMemory;
}

export function resetMemory(): void {
  if (_globalMemory) {
    _globalMemory.close();
    _globalMemory = null;
  }
}