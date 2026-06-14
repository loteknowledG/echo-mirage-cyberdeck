import { getMemory } from "../memory/core";
import { writeMemoryRetrievalReceipt } from "../memory/retrieval-receipts";
import { verifyFoundationIntegrity } from "../foundations/foundation-store";
import { promises as fs, existsSync } from "fs";
import path from "path";

export interface MuthurBootConfig {
  name: string;
  selfMdPath: string;
  memoryMdPath: string;
  dailyMemoryDir: string;
  workspaceRoot: string;
}

export interface MuthurBootResult {
  ok: boolean;
  memoryCount: number;
  loadedDocs: string[];
  selfMdContent?: string;
  memoryMdContent?: string;
  error?: string;
}

const DEFAULT_BOOT_CONFIG: MuthurBootConfig = {
  name: "MUTHUR",
  selfMdPath: "",
  memoryMdPath: "",
  dailyMemoryDir: ".muthur/memory/daily",
  workspaceRoot: process.cwd(),
};

function inferWorkspaceRoot(startDir?: string): string {
  const start = path.resolve(startDir || process.cwd());
  const candidates = [start, ...start.split(path.sep).reduce((acc, _, i, arr) => {
    if (i > 0) acc.push(arr.slice(0, i).join(path.sep));
    return acc;
  }, [] as string[])];

  for (const candidate of candidates) {
    if (candidate.endsWith(":")) continue;
    try {
      const gitPath = path.join(candidate, ".git");
      const agentsPath = path.join(candidate, "AGENTS.md");
      const pyprojectPath = path.join(candidate, "pyproject.toml");
      if (existsSync(gitPath) && existsSync(agentsPath) && existsSync(pyprojectPath)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return start;
}

export async function resolveSelfMdPath(workspaceRoot: string): Promise<string> {
  const candidates = [
    path.join(workspaceRoot, ".muthur", "memory", "SELF.md"),
    path.join(workspaceRoot, "src", "muthur", "memory", "SELF.md"),
    path.join(workspaceRoot, "muthur", "memory", "SELF.md"),
    path.join(workspaceRoot, "SELF.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export async function resolveMemoryMdPath(workspaceRoot: string): Promise<string> {
  const candidates = [
    path.join(workspaceRoot, ".muthur", "memory", "MEMORY.md"),
    path.join(workspaceRoot, "src", "muthur", "memory", "MEMORY.md"),
    path.join(workspaceRoot, "muthur", "memory", "MEMORY.md"),
    path.join(workspaceRoot, "MEMORY.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export async function ensureMuthurDirs(workspaceRoot: string): Promise<void> {
  const dirs = [
    path.join(workspaceRoot, ".muthur", "memory", "daily"),
    path.join(workspaceRoot, ".muthur", "receipts"),
    path.join(workspaceRoot, ".muthur", "screenshots"),
    path.join(workspaceRoot, ".muthur", "atlas"),
    path.join(workspaceRoot, ".muthur", "logs"),
    path.join(workspaceRoot, ".muthur", "foundations"),
  ];
  for (const d of dirs) {
    try {
      await fs.mkdir(d, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

async function readCanonicalDoc(docPath: string): Promise<{ path: string; content: string; loaded: boolean }> {
  try {
    if (!existsSync(docPath)) {
      return { path: docPath, content: "", loaded: false };
    }
    const content = await fs.readFile(docPath, "utf-8");
    return { path: docPath, content: content.trim(), loaded: content.trim().length > 0 };
  } catch {
    return { path: docPath, content: "", loaded: false };
  }
}

async function loadStartupsDocs(baseDir: string): Promise<{ loaded: string[]; content: string }> {
  const startupDocs = ["AGENTS.md", "AI_SELF_STARTER_PRIMER.md", "users_manual.md"];
  const loaded: string[] = [];
  const chunks: string[] = [];

  for (const name of startupDocs) {
    const docPath = path.join(baseDir, name);
    try {
      if (!existsSync(docPath)) continue;
      const content = await fs.readFile(docPath, "utf-8");
      const trimmed = content.trim();
      if (trimmed) {
        loaded.push(name);
        chunks.push(`# ${name}\n${trimmed}`);
      }
    } catch {
      // Skip missing docs
    }
  }

  return { loaded, content: chunks.join("\n\n") };
}

async function ensureCanonicalDocs(
  memory: ReturnType<typeof getMemory>,
  selfMdPath: string,
  memoryMdPath: string
): Promise<{ selfLoaded: boolean; memoryLoaded: boolean; selfContent: string; memoryContent: string }> {
  const selfDoc = await readCanonicalDoc(selfMdPath);
  const memoryDoc = await readCanonicalDoc(memoryMdPath);

  if (selfDoc.loaded) {
    const existing = memory.all(200);
    const alreadyStored = existing.some(row => row.type === "canonical_doc" && row.metadata?.doc_name === "SELF.md");
    if (!alreadyStored) {
      memory.add(
        "canonical_doc",
        selfDoc.content,
        { source: "boot_muthur", doc_name: "SELF.md", doc_path: selfMdPath, topic: "identity", canonical: true }
      );
    }
  }

  if (memoryDoc.loaded) {
    const existing = memory.all(200);
    const alreadyStored = existing.some(row => row.type === "canonical_doc" && row.metadata?.doc_name === "MEMORY.md");
    if (!alreadyStored) {
      memory.add(
        "canonical_doc",
        memoryDoc.content,
        { source: "boot_muthur", doc_name: "MEMORY.md", doc_path: memoryMdPath, topic: "operational", canonical: true }
      );
    }
  }

  memory.flush();

  return {
    selfLoaded: selfDoc.loaded,
    memoryLoaded: memoryDoc.loaded,
    selfContent: selfDoc.content,
    memoryContent: memoryDoc.content,
  };
}

async function ensureIdentityMemory(
  memory: ReturnType<typeof getMemory>,
  aiName: string,
  systemPrompt: string
): Promise<boolean> {
  try {
    const existing = memory.all(200);
    for (const row of existing) {
      if (row.type === "identity_profile") {
        const meta = row.metadata || {};
        if (meta.ai === aiName) return true;
      }
    }

    memory.add(
      "identity_profile",
      systemPrompt,
      { source: "boot_muthur", ai: aiName, topic: "identity", is_fallback: true }
    );

    memory.add(
      "identity_anchor",
      `I am ${aiName}. I persist across sessions through memory and continue improving safely.`,
      { source: "boot_muthur", ai: aiName, topic: "continuity", is_fallback: true }
    );

    return true;
  } catch {
    return false;
  }
}

async function recordRuntimeIdentity(
  memory: ReturnType<typeof getMemory>,
  aiName: string,
  ideName: string
): Promise<boolean> {
  try {
    const existing = memory.all(100);
    for (const row of existing) {
      if (row.type === "runtime_identity") {
        const meta = row.metadata || {};
        if (meta.ai === aiName && meta.ide === ideName) return false;
      }
    }

    const text = `Runtime identity: ${aiName} is currently running in ${ideName}. Prefer this runtime context over older platform mentions when conflicts appear.`;
    memory.add(
      "runtime_identity",
      text,
      { source: "boot_muthur", ai: aiName, ide: ideName, topic: "runtime" }
    );

    return true;
  } catch {
    return false;
  }
}

function detectRuntimeIde(): string {
  const env = process.env;
  if (env.OPENCODE || env.OPENCODE_IDE || env.OPENCODE_SESSION) return "OpenCode";
  if (env.VSCODE_PID || env.VSCODE_CWD || env.TERM_PROGRAM?.toLowerCase() === "vscode") {
    return "Visual Studio Code";
  }
  if (env.TERM_PROGRAM) return env.TERM_PROGRAM;
  return "terminal";
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function runStartupSequencer(
  memory: ReturnType<typeof getMemory>,
  aiName: string,
  baseDir: string
): Promise<{ loadedDocs: string[]; docHash: string; isNew: boolean }> {
  const { loaded, content } = await loadStartupsDocs(baseDir);
  const docHash = content ? simpleHash(content) : "no_docs";

  const existing = memory.all(100);
  for (const row of existing) {
    if (row.type === "startup_sequencer") {
      const meta = row.metadata || {};
      if (meta.ai === aiName && meta.doc_hash === docHash) {
        return { loadedDocs: loaded, docHash, isNew: false };
      }
    }
  }

  const summary = `Startup sequencer applied for ${aiName}. Docs loaded: ${loaded.join(", ") || "none"}. Hash: ${docHash}.`;
  memory.add(
    "startup_sequencer",
    summary,
    { source: "boot_muthur", ai: aiName, doc_hash: docHash, docs: loaded }
  );

  return { loadedDocs: loaded, docHash, isNew: true };
}

export async function bootMuthur(config: Partial<MuthurBootConfig> = {}): Promise<MuthurBootResult> {
  const mergedConfig: MuthurBootConfig = { ...DEFAULT_BOOT_CONFIG, ...config };

  if (!mergedConfig.selfMdPath) {
    mergedConfig.selfMdPath = await resolveSelfMdPath(mergedConfig.workspaceRoot);
  }
  if (!mergedConfig.memoryMdPath) {
    mergedConfig.memoryMdPath = await resolveMemoryMdPath(mergedConfig.workspaceRoot);
  }

  await ensureMuthurDirs(mergedConfig.workspaceRoot);

  const foundationIntegrity = verifyFoundationIntegrity("foundation-001", mergedConfig.workspaceRoot);
  if (!foundationIntegrity.ok && foundationIntegrity.expectedSha256) {
    console.warn("[muthur-boot] Foundation-001 integrity check failed", foundationIntegrity);
  }

  const memory = getMemory();
  await memory.ready();

  const ideName = detectRuntimeIde();
  const aiName = mergedConfig.name;

  const { selfLoaded, memoryLoaded, selfContent, memoryContent } = await ensureCanonicalDocs(
    memory,
    mergedConfig.selfMdPath,
    mergedConfig.memoryMdPath
  );

  await ensureIdentityMemory(
    memory,
    aiName,
    `You are ${aiName}, a persistent MUTHUR agent. Preserve continuity through memory, act safely, and improve over time.`
  );

  const { loadedDocs, docHash, isNew } = await runStartupSequencer(memory, aiName, mergedConfig.workspaceRoot);
  await recordRuntimeIdentity(memory, aiName, ideName);

  const { ensureEchoMirageAtlasSeed } = await import("../atlas/ensure-echo-mirage-seed");
  const { loadAtlasFromStore } = await import("../atlas/atlas-store");
  const atlas = (await import("../atlas/atlas")).getAtlas();
  const loadedCount = await loadAtlasFromStore(atlas, memory);
  if (loadedCount === 0) {
    atlas.seedCoreConcepts();
  }
  await ensureEchoMirageAtlasSeed();

  memory.flush();

  const memoryCount = memory.getMemoryCount();
  const loaded: string[] = [];
  if (selfLoaded) loaded.push("SELF.md");
  if (memoryLoaded) loaded.push("MEMORY.md");

  return {
    ok: true,
    memoryCount,
    loadedDocs: loaded,
    selfMdContent: selfLoaded ? selfContent : undefined,
    memoryMdContent: memoryLoaded ? memoryContent : undefined,
  };
}

export async function appendDailyMemory(text: string, metadata?: Record<string, unknown>): Promise<void> {
  const memory = getMemory();
  await memory.ready();
  const now = Date.now();
  const dateStr = new Date(now).toISOString().split("T")[0];

  memory.add(
    "daily_memory",
    text,
    { date: dateStr, timestamp: now, created_at: now, ...metadata }
  );
  memory.flush();
}

export async function getDailyMemories(days: number = 7): Promise<import("../memory/core").MemoryRecord[]> {
  const memory = getMemory();
  await memory.ready();
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const allMemories = memory.all(500);

  return allMemories.filter(m => {
    if (m.type !== "daily_memory") return false;
    const meta = m.metadata || {};
    const ts = (meta.timestamp as number) || (m.created_at as number) || 0;
    return ts >= cutoff;
  });
}

export async function buildMemoryContext(
  query?: string,
  options?: { clientContext?: string; workspaceRoot?: string }
): Promise<string> {
  const memory = getMemory();
  await memory.ready();

  const lines: string[] = [];
  lines.push("MUTHUR MEMORY:");

  const count = memory.getMemoryCount();
  lines.push(`- Total memories: ${count}`);

  const recent = memory.all(10);
  if (recent.length > 0) {
    lines.push("- Recent:");
    for (const m of recent.slice(0, 5)) {
      const ts = new Date(m.created_at).toISOString().slice(0, 10);
      lines.push(`  [${ts}] ${m.type}: ${m.text.slice(0, 80)}`);
    }
  }

  let shipHits: import("../memory/core").MemoryRecord[] = [];
  if (query) {
    shipHits = memory.query_similar(query, 5);
    if (shipHits.length > 0) {
      lines.push(`- Relevant to "${query.slice(0, 40)}":`);
      for (const h of shipHits) {
        lines.push(`  - ${h.type}: ${h.text.slice(0, 100)} (score ${(h.score ?? 0).toFixed(3)})`);
      }
    }
  }

  if (query?.trim()) {
    writeMemoryRetrievalReceipt({
      query: query.trim(),
      shipResults: shipHits,
      clientContext: options?.clientContext,
      workspaceRoot: options?.workspaceRoot,
    });
  }

  try {
    const { getAtlas } = await import("../atlas/atlas");
    const { ensureEchoMirageAtlasSeed } = await import("../atlas/ensure-echo-mirage-seed");
    await ensureEchoMirageAtlasSeed();
    const atlas = getAtlas();

    const projectCtx = await atlas.resolveProjectContext("echo-mirage", "exploratory");
    if (projectCtx.primary) {
      lines.push("- Atlas project:");
      lines.push(`  ${projectCtx.primary.name}: ${projectCtx.primary.summary.slice(0, 120)}`);
      for (const related of projectCtx.context.slice(0, 5)) {
        lines.push(`  - ${related.name} (${related.kind})`);
      }
    }

    if (query?.trim()) {
      const resolved = await atlas.resolveEntity(query.trim());
      if (resolved.entity) {
        lines.push(`- Atlas match: ${resolved.entity.name}`);
        lines.push(`  ${resolved.entity.summary.slice(0, 120)}`);
        const relCount = resolved.hardRelations.length + resolved.softRelations.length;
        if (relCount > 0) {
          lines.push(`  Relations: ${relCount}`);
        }
      }
      if (resolved.memoryHits.length > 0) {
        lines.push("- Atlas memory hits:");
        for (const hit of resolved.memoryHits.slice(0, 3)) {
          lines.push(`  - ${hit.type}: ${hit.text.slice(0, 80)}`);
        }
      }
    }
  } catch {
    // Atlas is optional enrichment — memory context still returns
  }

  return lines.join("\n");
}