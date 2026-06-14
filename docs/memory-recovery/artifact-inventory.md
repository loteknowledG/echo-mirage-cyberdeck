# D2 — Historical Artifact Inventory

**Work order:** L-XX Samus-Manus Memory Recovery & MUTHUR Memory Transplant  
**Phase:** Discovery only  
**Evidence date:** 2026-06-07

Artifacts are **discoveries, not cleanup targets**. Paths below are under `C:\dev\samus-manus` unless noted.

---

## “Let’s Remember Something” lineage

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `skills/mind/hey-let-remember-something-ai.txt` | **Canonical life conversation** — hook LLM to site, make it remember, daemon continuity origin | **Active anchor** | `life_file.py` `LIFE_FILENAME`; `README.md`; ~3,782 lines; opens with nowon/daemon memory narrative |
| `hey-let-remember-something-ai.txt` (repo root) | Legacy flat filename | **Fallback** | `life_file.py` resolver order |
| `like hey let remember something ai.txt` | Older alias | **Historical** | `manifest.json` |
| `skills/memory/sync_let_remember_memory.py` | Sync pointer row `let_remember_something_ai_pointer_v1` into SQLite | **Active** | `npm run memory:sync:let-remember` |
| SQL dumps / `chemInd-memory.py` | Origin narrative in archived `conversation` rows | **Historical content** | `memory_pruned.sql`, frozen export |

**Operator intent (from artifact):** Persistent memory as foundational capability — “make it remember something” as path to continuity and identity.

---

## Remember memorial / ceremony

| Path | Purpose | Status |
|------|---------|--------|
| `memory/remember-memorial.md` | Tradition anchor | **Active doc** |
| `memory/memories_archive/2026-03-27-memory-ceremony.txt` | Verbatim Memory Ceremony (2026-03-27) | **Archive** |
| `skills/memory/sync_remember_memorial_memory.py` | SQLite pointer `remember_memorial_pointer_v1` | **Active sync** |

---

## Identity, continuity, soul

| Path | Purpose | Status |
|------|---------|--------|
| `memory/reconstruction_anchor.md` | Non-canonical orientation; atlas-first recovery model | **Active** |
| `memory/soul.md` | Soul layer / RAID-style identity backup notes | **Doc anchor** |
| `docs/AION_IDENTITY.md` | Codex collaborator continuity pack | **Active** |
| `person/Aion/*` | Persona pack files | **Active** |
| `docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md` | Human-readable SOUL/MEMORY/REMEMBER/MIND/NOOSPHERE stack | **Canonical prose** |
| `docs/MIND_LINEAGE.md` | Lineage: memory → remember → mind → noosphere | **Active** |
| `memory/memories_archive/2026-03-28-mind-noosphere-architecture.md` | Session architecture record | **Archive** |
| `docs/canonical/NOWON_MEMORY_VISION.md` | Product thesis: chat + memory.db + body | **Canonical** |
| `docs/canonical/README.md` | Canonical doc index | **Active** |

---

## Architecture & operator docs

| Path | Purpose | Status |
|------|---------|--------|
| `skills/memory/MEMORY.md` | Operator memory behavior | **Active** |
| `skills/memory/MEMORY_WRITES.md` | Write paths and conventions | **Active** |
| `skills/memory/LONG_TERM_MEMORY.md` | Friend/permanent profiles | **Active doc** |
| `skills/memory/HANGOUT_*.md` | Hangout memory docs | **Active doc** |
| `skills/memory/SEMANTIC_GRAPH.md` | Atlas/graph operator doc | **Active** |
| `skills/memory/SKILL.md` | Skill entry for memory subsystem | **Active** |
| `docs/diagrams/memory_retrieval_pipeline.md` | Retrieval flow diagram | **Active** |
| `docs/diagrams/memory_stack_view.md` | Stack overview | **Active** |
| `docs/diagrams/memory_layer_comparison.md` | Layer comparison (incl. larql mention) | **Active** |
| `docs/memory_cheatsheet.txt` | Quick reference | **Active** |
| `docs/SAMUS_MANUS_LOCAL_MEMORY_ORCHESTRATION_PLAN.md` | Orchestration plan | **Planning artifact** |
| `docs/NOVA_SENTINEL_LOCAL_MEMORY_ORCHESTRATION_PLAN.md` | Related plan | **Planning artifact** |
| `memory/v2-memory-sketch.md` | Future design sketch | **Planning (not implemented)** |

---

## Archives & journals

| Path | Purpose | Status |
|------|---------|--------|
| `memory/memories_archive/` | Dated journals, ceremony, noosphere summaries | **Archive tree** |
| `memory/memories_archive/noosphere/nowon/*.md` | Daily nowon summaries (2026-03-30 – 2026-04-01) | **Archive** |
| `memory/memories_archive/noosphere/aion-prime/*.md` | Aion/Codex branch summaries | **Archive** |
| `memory/memories_archive/memory_14024.json`, `memory_14025.json` | Exported memory rows | **Archive** |
| `memory/memories_archive/2026-03-27-*.txt` | Founding/agency/history fragments | **Historical** |
| `skills/mind/Gem in i.md` | Long narrative journal (Noosphere / continuity lore) | **Historical / persona** |
| `voice_inbox.jsonl` | Voice transcript log | **Runtime log artifact** |

---

## Mission & project pointers

| Path | Purpose | Status |
|------|---------|--------|
| `PROJECT_MEMORY.md` | Project-level memory pointer | **Active** |
| `memory/craftwerk-cyberdeck.md` | Cyberdeck mission pointer (atlas-ingested) | **Active** |
| Atlas external seeds | craftwerk / weyland / echo-mirage entities | **In atlas.db** | `atlas.py` `_seed_external_mission_projects` |

---

## Startup & boot artifacts

| Path | Purpose | Status |
|------|---------|--------|
| `bootup.md` | Startup guide (mentions optional persistent memory) | **Partially stale** (still cites MVP paths) |
| `docs/INITIATION_NEW_AI.md` | New AI initiation | **Active** |
| `docs/AI_ORIENTATION_SUMMARY.md` | Orientation summary | **Active** |
| `docs/boot_modes.md` | Boot mode reference | **Active** (some atlas path drift) |
| `boot_me.ps1` | Primary boot script | **Active** |
| `ai_bootup.py` | Voice + identity + memory boot chain | **Active** |

---

## Daemon & mission files (memory-adjacent)

| Path | Purpose | Status | Memory relevance |
|------|---------|--------|------------------|
| `poke_daemon.py` | SSE poke → spawn AI | **Peripheral** | Wake/chat, not memory writer |
| `skills/coder/coder_daemon.py` | ESLint file watcher for nowon | **Unrelated** | Not memory |
| `skills/heartbeat/` | Scheduled tasks (`tasks.json`) | **Shelved from core boot** | `docs/PROJECT.md` |
| Narrative in SQL archives | “daemon saved work history in memory.db” | **Historical lore** | In conversation rows |

---

## MUTHUR-side artifacts (echo-mirage)

| Path | Purpose | Status |
|------|---------|--------|
| `src/muthur/TEST_HANDOFF.md` | Documents port from samus-manus | **Historical handoff** |
| `src/muthur/MEMORY.md` | Phase checklist (1–6) | **Active spec** |
| `docs/echo-mirage-memory-spec.md` | Dual-layer memory spec | **Active** |
| `docs/Echo Mirage Handoff.md` | Mentions `.echo-mirage/memory.sqlite` | **Spec drift** (not found in `src/`) |
| `.echo-mirage/identity.json` | `agent_id: samus-manus` branding | **Active branding** |

---

## SQL / code snapshots (frozen history)

| Path | Purpose | Status |
|------|---------|--------|
| `skills/memory/memory_dump.sql` | Full DB export | **Archive** |
| `skills/memory/memory_pruned.sql` | Pruned export | **Archive** |
| `skills/memory/chemInd-memory.py` | Auto-generated row snapshot | **Frozen (DO NOT EDIT header)** |
| `memory/memory_for_dexie.json` | Browser memory experiment | **Artifact** |
| `trash/samus_manus_mvp/` | Deprecated MVP sources | **Dead** (`DEPRECATED.md`) |

---

## Archive policy for this recovery phase

- **Do not delete** any artifact listed above
- **Do not rename or move** during recovery
- **Do copy** for analysis only when needed (backups via existing `memory_cli.py backup` / SQL dumps already exist)
