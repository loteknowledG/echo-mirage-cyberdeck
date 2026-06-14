import { readFileSync, writeFileSync } from "fs";
import path from "path";

type Entry = {
  artifact_id: string;
  path: string;
  type: string;
  size_bytes: number;
  approximate_date: string;
  classification: string;
  continuity_score: number;
  lineage_score: number;
  import_recommendation: string;
  continuity_relevance: string;
};

type Manifest = {
  artifacts: Entry[];
  scanned_file_count: number;
  artifact_count: number;
  samus_manus_root: string;
};

const manifestPath = path.join(process.cwd(), "docs/memory-recovery/continuity-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

function continuityPreserved(classification: string): string {
  if (classification === "Foundation") {
    return "Origin/constitutional lineage — survives DB loss if file preserved.";
  }
  if (classification === "Doctrine") {
    return "System-shaping ideas — explains why memory/atlas behave as they do.";
  }
  if (classification === "Identity") {
    return "Agency, selfhood, continuity, or operator-AI relationship context.";
  }
  if (classification === "Architecture") {
    return "Runtime/schema design — required to rebuild behavior from specs + exports.";
  }
  return "Historical project record — context for evolution timeline.";
}

function renderTop100(): void {
  const top = manifest.artifacts.slice(0, 100);
  let md = `# Top 100 Continuity Artifacts

**Work order:** L-MEM-005 Continuity Artifact Discovery & Lineage Extraction  
**Discovery date:** 2026-06-07  
**Samus-Manus root:** \`${manifest.samus_manus_root}\`  
**Source:** \`continuity-manifest.json\` (${manifest.artifact_count} candidates from ${manifest.scanned_file_count} scanned paths)

Ranked by \`continuity_score\` then \`lineage_score\`. **Discovery only** — no import performed.

---

`;

  top.forEach((entry, index) => {
    md += `## ${index + 1}. \`${entry.path}\`

| Field | Value |
|-------|-------|
| Artifact ID | \`${entry.artifact_id}\` |
| Classification | ${entry.classification} |
| Continuity score | ${entry.continuity_score} |
| Lineage score | ${entry.lineage_score} |
| Size | ${entry.size_bytes.toLocaleString()} bytes |
| Approx. date | ${entry.approximate_date} |
| Import recommendation | \`${entry.import_recommendation}\` |

**Why it matters:** ${entry.continuity_relevance}

**Continuity preserved:** ${continuityPreserved(entry.classification)}

---

`;
  });

  writeFileSync(path.join(process.cwd(), "docs/memory-recovery/top-100-continuity-artifacts.md"), md);
}

function renderLineageInventory(): void {
  const byClass = new Map<string, Entry[]>();
  for (const entry of manifest.artifacts) {
    const list = byClass.get(entry.classification) ?? [];
    list.push(entry);
    byClass.set(entry.classification, list);
  }

  let md = `# Lineage Inventory

**Work order:** L-MEM-005  
**Phase:** Discovery only  
**Discovery date:** 2026-06-07  
**Samus-Manus root:** \`C:\\dev\\samus-manus\`  
**MUTHUR root:** \`f:\\dev\\echo-mirage-cyberdeck\`

---

## Core question

> If all databases were lost tomorrow, which artifacts would need to survive for MUTHUR to retain continuity with Samus-Manus?

**Short answer:** Foundation files + doctrine markdown + cold DB/SQL exports + atlas backup + architecture source (\`memory.py\`, \`atlas.py\`, boot chain). Bulk \`voice_input\` rows are **not** required for lineage (Noise).

---

## Scan summary

| Metric | Value |
|--------|-------|
| Paths scanned (md/txt/py/sql/json/db) | ${manifest.scanned_file_count} |
| Candidates in manifest | ${manifest.artifact_count} |
| Foundation | ${byClass.get("Foundation")?.length ?? 0} |
| Doctrine | ${byClass.get("Doctrine")?.length ?? 0} |
| Identity | ${byClass.get("Identity")?.length ?? 0} |
| Architecture | ${byClass.get("Architecture")?.length ?? 0} |
| Historical | ${byClass.get("Historical")?.length ?? 0} |

---

## D2 — Continuity classification definitions

| Class | Meaning |
|-------|---------|
| **Foundation** | Origin and constitutional artifacts |
| **Doctrine** | Ideas that shaped the system |
| **Identity** | Memory, agency, continuity, time, selfhood discussions |
| **Architecture** | Artifacts that altered or implement system design |
| **Historical** | Important project events and snapshots |
| **Noise** | Loops, spam, duplicates, dependency cache, low-signal bulk (excluded from manifest) |

---

`;

  for (const classification of [
    "Foundation",
    "Doctrine",
    "Identity",
    "Architecture",
    "Historical",
  ]) {
    const items = byClass.get(classification) ?? [];
    md += `## ${classification} (${items.length})\n\n`;
    if (items.length === 0) {
      md += "_None in manifest._\n\n";
      continue;
    }
    md += "| Path | Type | Size | Date | Continuity | Lineage | Relevance |\n";
    md += "|------|------|------|------|------------|---------|----------|\n";
    for (const entry of items) {
      md += `| \`${entry.path}\` | ${entry.type} | ${entry.size_bytes} | ${entry.approximate_date} | ${entry.continuity_score} | ${entry.lineage_score} | ${entry.continuity_relevance.replace(/\|/g, "/")} |\n`;
    }
    md += "\n";
  }

  md += `---

## External continuity assets (not under Samus repo tree)

| Path | Type | Continuity relevance |
|------|------|----------------------|
| \`%USERPROFILE%/.codex/atlas/atlas.db\` | SQLite | Central Semantic Atlas graph (entities, relations, sources) |
| \`f:\\dev\\echo-mirage-cyberdeck\\.muthur\\foundations\\\` | Foundation archive | L-MEM-004 preserved origin (Foundation-001) |
| \`f:\\dev\\echo-mirage-cyberdeck\\.muthur\\memory\\muthur-memory.db\` | SQLite | MUTHUR ship memory (transplant target, not lineage source) |
| \`f:\\dev\\echo-mirage-cyberdeck\\docs\\memory-recovery\\\` | Discovery docs | L-XX / L-MEM recovery evidence chain |

---

## Noise (excluded from manifest)

| Pattern | Reason |
|---------|--------|
| \`skills/memory/memory.db\` → 37k+ \`voice_input\` rows | High volume, low lineage density per row |
| \`.uv-cache/\`, \`site-packages/\` | Dependency false positives |
| \`_OceanofPDF.com_*.txt\` | Unrelated fiction |
| \`trash/samus_manus_mvp/\` | Deprecated MVP |

Full ranked list: \`top-100-continuity-artifacts.md\`. Machine manifest: \`continuity-manifest.json\`.
`;

  writeFileSync(path.join(process.cwd(), "docs/memory-recovery/lineage-inventory.md"), md);
}

renderTop100();
renderLineageInventory();
console.log("render-continuity-docs: wrote top-100 + lineage-inventory");
