# D1 — Memory Asset Inventory

**Work order:** L-XX Samus-Manus Memory Recovery & MUTHUR Memory Transplant  
**Phase:** Discovery only (no implementation)  
**Samus-Manus root:** `C:\dev\samus-manus`  
**MUTHUR root:** `f:\dev\echo-mirage-cyberdeck`  
**Evidence date:** 2026-06-07 (local filesystem inspection)

---

## Executive summary

Samus-Manus memory is **not lost**. It survives as:

1. **Hybrid SQLite memory** (`memory.py`) — rows + lexical term index; embedding column present but **empty on this machine**
2. **Semantic Atlas** (`atlas.py`) — separate SQLite graph at `~/.codex/atlas/atlas.db` with live entities/relations
3. **Canonical file layer** — life conversation, reconstruction anchor, memorial, archives
4. **MUTHUR partial port** — sql.js ship DB + in-memory atlas seed; no Python runtime bridge

There is **no separate vector database product** (no FAISS/Chroma/Pinecone runtime). Embeddings are stored as JSON in SQLite when populated.

---

## Live databases (verified on disk)

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `C:\dev\samus-manus\.codex\memory.db` | Project-scoped memory (current boot default when workspace = samus-manus) | **Active data** | `core/config/paths.py` `get_memory_db_path()`; **6,715** `memories`, **17,875** `memory_terms`; **0/6715** rows with non-null embedding (2026-06-07) |
| `C:\dev\samus-manus\skills\memory\memory.db` | Legacy in-repo memory DB | **Active data (split-brain)** | Hardcoded in `api/chat.py`; **37,866** memories, **2,326** terms; dominant type `voice_input` (37,434 rows); **0** embeddings populated |
| `C:\Users\<user>\.codex\atlas\atlas.db` | Central Semantic Atlas graph | **Active data** | `get_atlas_db_path()` default; **46** entities, **103** relations, **99** source_locations, audit tables populated |
| `f:\dev\echo-mirage-cyberdeck\.muthur\memory\muthur-memory.db` | MUTHUR ship memory (sql.js) | **Active data** | **33** memories, **1,100** terms, **0** receipts; **0/33** embeddings |

**Note:** `*.db` files are gitignored in Samus-Manus; absence from git does not mean absence from disk.

---

## SQLite memory stores (Samus-Manus)

| Asset | Path / resolution | Purpose | Status |
|-------|-------------------|---------|--------|
| Memory class | `skills/memory/memory.py` | CRUD, hybrid retrieval, embeddings API | **Active code** |
| Path resolver | `core/config/paths.py` | `.codex/memory.db` → `data/memory/` → legacy `skills/memory/memory.db` | **Active code** |
| Boot wiring | `boot_me.ps1`, `ai_bootup.py` | Scope, identity bootstrap, atlas warm | **Active code** |
| Context loader | `tools/resume_context.py` | Ingest canonical markdown into DB chunks | **Active code** |
| Memory CLI | `skills/memory/memory_cli.py` | list/query/backup/migrate | **Active code** |
| SQL dumps | `skills/memory/memory_dump.sql`, `memory_pruned.sql` | Schema + historical row snapshots | **Archive (versioned)** |
| Frozen export | `skills/memory/chemInd-memory.py` | 86-row Python snapshot (2026-03-12) | **Dead snapshot** |
| Browser export | `memory/memory_for_dexie.json` | Dexie/IndexedDB-shaped export | **Artifact (unwired to Python boot)** |
| Default fallback | `data/memory/memory.db` | Config default path | **Not present on disk** (only `.txt` under `data/memory/`) |
| Profile DBs | `memory/profiles/friend.db`, `hangout.db`, `*_permanent.db` | Long-term profile layers | **Designed in code** (`long_term_memory.py`, `hangout_memory.py`); **`memory/profiles/` directory absent** |
| Servitor DB | `servitor_{name}.db` (cwd) | Minimal single-table memory | **Peripheral** (`servitor_listener.py`) |
| MVP DB | `samus_manus_mvp/memory.db` | Deprecated MVP | **Dead** (`trash/samus_manus_mvp/DEPRECATED.md`) |

---

## Semantic Atlas (Samus-Manus)

| Asset | Path | Purpose | Status |
|-------|------|---------|--------|
| Atlas engine | `skills/memory/atlas.py` | Entity/alias/relation graph, resolver, ingestion | **Active code** |
| Atlas CLI | `skills/memory/atlas_cli.py` | ingest, resolve, audit | **Active** (`npm run atlas:ingest*`) |
| Per-repo isolated atlas | `<workspace>/.atlas/atlas.db` | Cyberdeck-local graph | **Active pattern** |
| Central atlas | `$CODEX_HOME/atlas/atlas.db` | Shared graph across workspaces | **Active (live data on operator machine)** |
| Docs alias | `skills/memory/atlas.db` | Referenced in older docs | **Docs drift** vs central path |
| Eval / A-B | `tools/atlas_eval_matrix.py`, `experiments/memory_ab/` | Regression harness | **Active tooling** |

**Naming:** Code uses **Semantic Atlas**, not “Memory Atlas”. MUTHUR UI label is “Memory Atlas”.

---

## Vector / embedding stores

| Store | Technology | Status | Evidence |
|-------|------------|--------|----------|
| `memories.embedding` column | JSON float vectors via `sentence-transformers` (`all-MiniLM-L6-v2`) | **Code active; data empty on live DBs** | `memory.py` `_get_embedding()`; live DB query 2026-06-07: 0 populated rows in both Samus DBs |
| `memory_terms` table | Lexical hybrid index | **Active** | Populated in all live DBs |
| FAISS / Chroma / Pinecone | — | **Not implemented** | Mentioned only in `docs/diagrams/memory_layer_comparison.md` |
| larql / vindex | Separate product (`f:\dev\larql`) | **Not part of samus-manus runtime** | Workspace map only |

---

## Memory services, APIs, skills

| Component | Path | Role | Status |
|-----------|------|------|--------|
| Agent runtime | `samus_agent.py` | Atlas-first context, memory fallback | **Active** |
| Chat API | `api/chat.py` | Atlas resolve + memory persist | **Active** (legacy DB path risk) |
| Chat server | `ai_chat_server.py` | Optional Noosphere bridge | **Active** (adjacent substrate) |
| Orchestrator (legacy) | `skills/orchestrator.py`, `skills/memory_agent.py` | Separate `agent_memory` table | **Legacy / stale** |
| Canonical sync | `skills/memory/sync_canonical_memory.py` | Pointer rows for anchor/life/memorial | **Active** |
| Remember skill | `skills/remember/` | Export/replay archives | **Active** |
| Technique recall | `skills/memory/tool_recall.py` | Scoped tool lessons | **Active at boot** |
| Project memory swap | `skills/memory/project_memory.py` | Alternate DB for task scope | **Active code** |
| Flight log | `skills/memory/flight_log.py` | JSONL ops diary | **Active** (adjacent, not semantic core) |
| Skills doctor | `tools/skills_doctor.py` | Validates DB paths | **Active** |
| Backup | `tools/backup_state.py` | State backup | **Active** |
| Identity bootstrap | `skills/memory/identity_bootstrap.py` | Seeds identity rows | **Active** (called from `ai_bootup.py`) |

---

## MUTHUR memory assets (transplant target)

| Asset | Path | Role | Status |
|-------|------|------|--------|
| Ship memory core | `src/muthur/memory/core.ts` | sql.js SQLite, hybrid query | **Partial** (semantic score stubbed to 0) |
| Boot | `src/muthur/boot/boot_muthur.ts` | Hydrate identity, canonical docs, atlas seed | **Active** |
| Atlas (in-memory) | `src/muthur/atlas/atlas.ts` | Entity graph + resolve | **Partial** (not persisted to atlas.db) |
| Atlas UI | `src/components/cyberdeck/memory-atlas-pane-body.tsx` | Operator pane | **Active** |
| Atlas API | `src/app/api/muthur/atlas/route.ts` | GET/POST resolve | **Active** |
| Memory API | `src/app/api/muthur/memory/route.ts` | record_turn, recent | **Active** |
| Client memory | `src/lib/muthur-memory.ts` | IndexedDB facts/turns | **Active** |
| Promotion | `src/muthur/memory/promotion.ts` | observation → durable | **Skeleton (unwired)** |
| Probes | `scripts/probe-muthur-atlas-memory.ts` | Regression | **Active** |

---

## External related systems

| System | Path | Relationship |
|--------|------|--------------|
| Noosphere | `C:\dev\noosphere\` | Chat/hat/mindshare substrate; documented in `docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md` |
| Samus ↔ MUTHUR bridge | `.cursor/hooks/*`, voice only | **No memory data bridge** |
| Echo Mirage handoff docs | `docs/echo-mirage-memory-spec.md` | Spec references Samus locations |

---

## Split-brain risk (documented, not fixed)

| Issue | Evidence |
|-------|----------|
| Boot default → `.codex/memory.db` | `paths.py`, `boot_me.ps1` |
| Chat API → `skills/memory/memory.db` | `api/chat.py` hardcoded path |
| Two live DBs with divergent row counts | 6,715 vs 37,866 memories on operator machine |
| Embeddings empty in both | Semantic recall depends on query-time embed + lexical fallback only |

---

## What appears permanently absent from repo (not from disk)

- No committed `.db` files (gitignored)
- No `memory/profiles/` directory tree
- No runtime FAISS/Chroma index files
- No `f:\dev\samus-manus` path (use `C:\dev\samus-manus`)
