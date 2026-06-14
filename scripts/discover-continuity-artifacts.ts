/**
 * L-MEM-005 discovery scanner (read-only). Does not import or modify Samus-Manus.
 * Run: pnpm discover:continuity-artifacts
 */
import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const SAMUS_ROOT = process.env.SAMUS_MANUS_ROOT ?? "C:\\dev\\samus-manus";
const OUT_MANIFEST = path.join(
  process.cwd(),
  "docs",
  "memory-recovery",
  "continuity-manifest.json",
);

type Classification =
  | "Foundation"
  | "Doctrine"
  | "Identity"
  | "Architecture"
  | "Historical"
  | "Noise";

type ManifestEntry = {
  artifact_id: string;
  path: string;
  type: string;
  size_bytes: number;
  approximate_date: string;
  classification: Classification;
  continuity_score: number;
  lineage_score: number;
  import_recommendation: string;
  continuity_relevance: string;
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".venv",
  "__pycache__",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".pytest_cache",
  ".uv-cache",
  ".npm-cache",
  "site-packages",
]);

const NOISE_HINTS = [
  /_OceanofPDF/i,
  /trash[\\/]/i,
  /samus_manus_mvp/i,
  /vendor[\\/]/i,
  /public[\\/]vendor/i,
];

const CURATED: Array<{
  rel: string;
  classification: Classification;
  continuity: number;
  lineage: number;
  recommendation: string;
  relevance: string;
}> = [
  {
    rel: "skills/mind/hey-let-remember-something-ai.txt",
    classification: "Foundation",
    continuity: 100,
    lineage: 100,
    recommendation: "foundation_register",
    relevance: "Origin life conversation; daemon/nowon memory genesis",
  },
  {
    rel: ".muthur/foundations/lets-remember-something-ai.txt",
    classification: "Foundation",
    continuity: 100,
    lineage: 100,
    recommendation: "preserved_foundation_001",
    relevance: "MUTHUR copy of Foundation-001 (echo-mirage)",
  },
  {
    rel: "memory/reconstruction_anchor.md",
    classification: "Foundation",
    continuity: 95,
    lineage: 92,
    recommendation: "foundation_candidate",
    relevance: "Atlas-first recovery orientation; anchor vs truth doctrine",
  },
  {
    rel: "memory/remember-memorial.md",
    classification: "Foundation",
    continuity: 88,
    lineage: 85,
    recommendation: "foundation_candidate",
    relevance: "Remember memorial tradition anchor",
  },
  {
    rel: "memory/memories_archive/2026-03-27-memory-ceremony.txt",
    classification: "Foundation",
    continuity: 86,
    lineage: 84,
    recommendation: "foundation_archive",
    relevance: "Verbatim memory ceremony founding ritual",
  },
  {
    rel: "docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md",
    classification: "Doctrine",
    continuity: 94,
    lineage: 90,
    recommendation: "doctrine_import_readonly",
    relevance: "SOUL/MEMORY/REMEMBER/MIND/NOOSPHERE stack prose",
  },
  {
    rel: "docs/MIND_LINEAGE.md",
    classification: "Doctrine",
    continuity: 93,
    lineage: 91,
    recommendation: "doctrine_import_readonly",
    relevance: "memory → remember → mind → noosphere lineage chain",
  },
  {
    rel: "docs/canonical/NOWON_MEMORY_VISION.md",
    classification: "Doctrine",
    continuity: 90,
    lineage: 88,
    recommendation: "doctrine_import_readonly",
    relevance: "Product thesis: chat + memory.db + body",
  },
  {
    rel: "skills/memory/MEMORY.md",
    classification: "Doctrine",
    continuity: 89,
    lineage: 82,
    recommendation: "doctrine_import_readonly",
    relevance: "Operator memory behavior contract",
  },
  {
    rel: "skills/memory/MEMORY_WRITES.md",
    classification: "Doctrine",
    continuity: 87,
    lineage: 80,
    recommendation: "doctrine_import_readonly",
    relevance: "Write paths and memory conventions",
  },
  {
    rel: "skills/memory/SEMANTIC_GRAPH.md",
    classification: "Doctrine",
    continuity: 85,
    lineage: 86,
    recommendation: "atlas_doctrine",
    relevance: "Semantic Atlas / graph operator doctrine",
  },
  {
    rel: "memory/soul.md",
    classification: "Identity",
    continuity: 84,
    lineage: 83,
    recommendation: "identity_archive",
    relevance: "Soul layer / RAID identity backup notes",
  },
  {
    rel: "docs/AION_IDENTITY.md",
    classification: "Identity",
    continuity: 82,
    lineage: 78,
    recommendation: "identity_archive",
    relevance: "Codex collaborator continuity pack",
  },
  {
    rel: "skills/memory/atlas.py",
    classification: "Architecture",
    continuity: 88,
    lineage: 90,
    recommendation: "atlas_code_reference",
    relevance: "Semantic Atlas engine — entity graph evolution",
  },
  {
    rel: "skills/memory/memory.py",
    classification: "Architecture",
    continuity: 90,
    lineage: 88,
    recommendation: "memory_runtime_port",
    relevance: "Hybrid SQLite memory CRUD and retrieval",
  },
  {
    rel: "ai_bootup.py",
    classification: "Architecture",
    continuity: 86,
    lineage: 85,
    recommendation: "boot_chain_reference",
    relevance: "Boot chain: identity, memory, atlas warm, continuity phrases",
  },
  {
    rel: ".codex/memory.db",
    classification: "Architecture",
    continuity: 92,
    lineage: 88,
    recommendation: "db_export_cold_backup",
    relevance: "Live project-scoped memory corpus (boot default)",
  },
  {
    rel: "skills/memory/memory.db",
    classification: "Architecture",
    continuity: 91,
    lineage: 87,
    recommendation: "db_export_cold_backup",
    relevance: "Legacy live memory corpus (split-brain with .codex)",
  },
  {
    rel: "%USERPROFILE%/.codex/atlas/atlas.db",
    classification: "Architecture",
    continuity: 90,
    lineage: 92,
    recommendation: "atlas_db_cold_backup",
    relevance: "Central Semantic Atlas graph (46 entities, 103 relations on operator machine)",
  },
];

function slugId(rel: string): string {
  return rel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function classifyHeuristic(rel: string, contentSample: string): {
  classification: Classification;
  continuity: number;
  lineage: number;
  recommendation: string;
  relevance: string;
} {
  const lower = rel.toLowerCase();
  const text = contentSample.toLowerCase();

  if (NOISE_HINTS.some((re) => re.test(rel))) {
    return {
      classification: "Noise",
      continuity: 5,
      lineage: 3,
      recommendation: "discard",
      relevance: "Low-signal or unrelated content",
    };
  }

  if (/hey-let-remember|foundation|reconstruction_anchor|remember-memorial|memory-ceremony/i.test(rel)) {
    return {
      classification: "Foundation",
      continuity: 80,
      lineage: 78,
      recommendation: "foundation_review",
      relevance: "Continuity anchor candidate",
    };
  }

  if (/mind_lineage|noosphere|memory_vision|memory\.md|memory_writes|semantic_graph|doctrine|canonical/i.test(rel)) {
    return {
      classification: "Doctrine",
      continuity: 70,
      lineage: 68,
      recommendation: "doctrine_archive",
      relevance: "Shaped memory or continuity doctrine",
    };
  }

  if (/agency|soul|identity|aion|founding|jenna|reliving|selfhood|consciousness/i.test(rel + text)) {
    if (/\.uv-cache|site-packages|numpy|win32com/i.test(rel)) {
      return {
        classification: "Noise",
        continuity: 5,
        lineage: 3,
        recommendation: "discard",
        relevance: "Dependency cache false positive",
      };
    }
    return {
      classification: "Identity",
      continuity: 65,
      lineage: 62,
      recommendation: "identity_archive",
      relevance: "Identity, agency, or continuity discussion",
    };
  }

  if (/atlas|memory\.py|memory\.db|schema|retrieval|boot|samus_agent|paths\.py|core\.ts/i.test(rel)) {
    return {
      classification: "Architecture",
      continuity: 60,
      lineage: 65,
      recommendation: "architecture_reference",
      relevance: "System design or runtime artifact",
    };
  }

  if (/memories_archive|memory_dump|memory_pruned|chemind|2026-03-27|archive|ceremony/i.test(rel)) {
    return {
      classification: "Historical",
      continuity: 55,
      lineage: 50,
      recommendation: "cold_archive",
      relevance: "Historical project event or snapshot",
    };
  }

  if (/voice_input|voice_inbox|\.log$/i.test(rel) || text.includes("voice_input")) {
    return {
      classification: "Noise",
      continuity: 15,
      lineage: 10,
      recommendation: "do_not_import_bulk",
      relevance: "High-volume runtime log; low lineage density",
    };
  }

  return {
    classification: "Historical",
    continuity: 25,
    lineage: 20,
    recommendation: "review_later",
    relevance: "Peripheral project file",
  };
}

function walkFiles(root: string, base = root): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const full = path.join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...walkFiles(full, base));
      continue;
    }
    if (!/\.(md|txt|py|sql|json|jsonl|db)$/i.test(name)) continue;
    out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

function readSample(abs: string): string {
  try {
    const buf = readFileSync(abs);
    if (abs.endsWith(".db")) return "[sqlite-database]";
    return buf.slice(0, 4096).toString("utf8");
  } catch {
    return "";
  }
}

function statArtifact(samusRoot: string, rel: string) {
  const expanded = rel.replace("%USERPROFILE%", process.env.USERPROFILE ?? "");
  const echoPath = expanded.startsWith(".muthur/")
    ? path.join(process.cwd(), expanded)
    : path.join(samusRoot, expanded);
  if (!existsSync(echoPath)) return null;
  const st = statSync(echoPath);
  return {
    size_bytes: st.size,
    approximate_date: st.mtime.toISOString().slice(0, 10),
    sha256: st.size < 5_000_000 ? createHash("sha256").update(readFileSync(echoPath)).digest("hex") : "large-file-skip",
  };
}

function main(): void {
  if (!existsSync(SAMUS_ROOT)) {
    console.error(`Samus-Manus root not found: ${SAMUS_ROOT}`);
    process.exit(1);
  }

  const curatedIds = new Set<string>();
  const entries: ManifestEntry[] = [];

  for (const item of CURATED) {
    const stat = statArtifact(SAMUS_ROOT, item.rel);
    if (!stat) continue;
    const id = slugId(item.rel);
    curatedIds.add(id);
    entries.push({
      artifact_id: id,
      path: item.rel,
      type: path.extname(item.rel).replace(".", "") || "file",
      size_bytes: stat.size_bytes,
      approximate_date: stat.approximate_date,
      classification: item.classification,
      continuity_score: item.continuity,
      lineage_score: item.lineage,
      import_recommendation: item.recommendation,
      continuity_relevance: item.relevance,
    });
  }

  const allFiles = walkFiles(SAMUS_ROOT);
  for (const rel of allFiles) {
    const id = slugId(rel);
    if (curatedIds.has(id)) continue;
    const stat = statArtifact(SAMUS_ROOT, rel);
    if (!stat) continue;
    const sample = readSample(path.join(SAMUS_ROOT, rel));
    const h = classifyHeuristic(rel, sample);
    if (h.classification === "Noise" && h.continuity < 20) continue;
    entries.push({
      artifact_id: id,
      path: rel,
      type: path.extname(rel).replace(".", "") || "file",
      size_bytes: stat.size_bytes,
      approximate_date: stat.approximate_date,
      classification: h.classification,
      continuity_score: h.continuity,
      lineage_score: h.lineage,
      import_recommendation: h.recommendation,
      continuity_relevance: h.relevance,
    });
  }

  entries.sort((a, b) => b.continuity_score - a.continuity_score || b.lineage_score - a.lineage_score);

  const scanned_total = entries.length;
  const filtered = entries.filter(
    (entry) =>
      entry.classification !== "Noise" &&
      (entry.continuity_score >= 45 || entry.lineage_score >= 45),
  );
  const artifacts = filtered.slice(0, 250);

  const manifest = {
    schema_version: 1,
    work_order: "L-MEM-005",
    discovery_date: "2026-06-07",
    samus_manus_root: SAMUS_ROOT,
    muthur_root: process.cwd(),
    core_question:
      "If all databases were lost tomorrow, which artifacts would need to survive for MUTHUR to retain continuity with Samus-Manus?",
    scanned_file_count: scanned_total,
    artifact_count: artifacts.length,
    filter_note:
      "Manifest includes curated + heuristic candidates (continuity_score >= 45 or lineage_score >= 45), excluding Noise, capped at 250.",
    artifacts,
  };

  const { writeFileSync, mkdirSync } = require("fs") as typeof import("fs");
  mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
  writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`discover:continuity-artifacts wrote ${artifacts.length} entries (scanned ${scanned_total}) → ${OUT_MANIFEST}`);
}

main();
