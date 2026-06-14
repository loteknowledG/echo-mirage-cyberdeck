# D3 — Active vs Dead Memory Paths

**Work order:** L-XX Samus-Manus Memory Recovery & MUTHUR Memory Transplant  
**Phase:** Discovery only  
**Evidence date:** 2026-06-07

Each entry: **path → purpose → status → evidence**.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Active** | Code runs today; data or wiring confirmed |
| **Partial** | Runs but incomplete, split-brain, or degraded |
| **Dead** | Deprecated, superseded, or frozen snapshot only |
| **Unknown** | Referenced in docs; not verified on disk |

---

## Samus-Manus — active paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `skills/memory/memory.py` | Hybrid SQLite memory engine | **Active** | Imported by boot, agent, chat, CLI |
| `skills/memory/atlas.py` | Semantic Atlas graph + resolver | **Active** | Live `~/.codex/atlas/atlas.db` (46 entities, 103 relations) |
| `boot_me.ps1` / `ai_bootup.py` | Boot: scope, identity, atlas warm | **Active** | `memory:boot*` npm scripts |
| `tools/resume_context.py` | Canonical file → DB chunks | **Active** | Post-boot unless `DbOnlyMemory` |
| `skills/memory/sync_canonical_memory.py` | Pointer rows for canonical docs | **Active** | `memory:sync:canonical` |
| `samus_agent.py` | Atlas-first agent context | **Active** | `_resolve_atlas_context` |
| `skills/memory/memory_cli.py` | Operator CLI | **Active** | Documented in `SKILL.md` |
| `skills/memory/tool_recall.py` | Technique recall at boot | **Active** | Boot prints recent techniques |
| `skills/memory/identity_bootstrap.py` | Identity row seeding | **Active** | Called from `ai_bootup.py` |
| `skills/remember/export_memory.py`, `replay_memory.py` | Archive export/replay | **Active** | Remember skill |
| `C:\dev\samus-manus\.codex\memory.db` | Project memory data | **Active data** | 6,715 rows (2026-06-07) |
| `~/.codex/atlas/atlas.db` | Central atlas data | **Active data** | Populated audit + entity tables |

---

## Samus-Manus — partial / degraded paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `C:\dev\samus-manus\skills\memory\memory.db` | Legacy memory store | **Partial (split-brain)** | 37,866 rows; `api/chat.py` still hardcodes this path while boot prefers `.codex/memory.db` |
| `memories.embedding` column (both live DBs) | Semantic vector recall | **Partial (data empty)** | Code supports `_get_embedding()`; **0** populated embedding rows in both DBs on operator machine |
| Hybrid retrieval at runtime | Semantic + lexical + recency | **Partial** | Lexical/recency works via `memory_terms`; semantic leg requires stored embeddings or degrades |
| `memory/profiles/*.db` | Friend/hangout long-term profiles | **Partial (code only)** | Paths in `long_term_memory.py`, `hangout_memory.py`; directory absent |
| `docs` citing `skills/memory/atlas.db` | Local atlas path | **Partial (docs drift)** | Runtime default is `$CODEX_HOME/atlas/atlas.db` |
| `bootup.md` heartbeat-as-core | Boot narrative | **Partial (conflict)** | Contradicts `docs/PROJECT.md` (heartbeat shelved) |

---

## Samus-Manus — dead / legacy paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `trash/samus_manus_mvp/` | MVP memory runtime | **Dead** | `DEPRECATED.md` |
| `skills/orchestrator.py` + `memory_agent.py` | `agent_memory` table | **Dead / stale** | Separate schema; unlikely hot path |
| `skills/memory/chemInd-memory.py` | DB snapshot | **Dead snapshot** | Frozen export |
| `memory/memory_for_dexie.json` | Browser IndexedDB experiment | **Dead (unwired)** | Not loaded by Python boot |
| `samus_manus_mvp/memory.db` | MVP DB path | **Dead** | Referenced only in deprecated docs |
| `ai_systems_viewer.py` hardcoded legacy DB | Viewer tool | **Stale path** | Points at `skills/memory/memory.db` only |

---

## MUTHUR (echo-mirage) — active paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `src/muthur/boot/boot_muthur.ts` | Boot hydration | **Active** | Identity, canonical docs, daily memory, atlas seed |
| `src/muthur/memory/core.ts` + `.muthur/memory/muthur-memory.db` | Ship SQLite memory | **Active** | 33 rows; sql.js flush to disk |
| `src/lib/muthur-memory.ts` | IndexedDB client memory | **Active** | Injected into chat from browser |
| `src/app/api/muthur/memory/route.ts` | record_turn API | **Active** | POST persists turns |
| `src/app/api/muthur/atlas/route.ts` | Atlas API | **Active** | GET entities, POST resolve |
| `src/components/cyberdeck/memory-atlas-pane-body.tsx` | Memory Atlas UI | **Active** | Live fetch from API |
| `scripts/probe-muthur-atlas-memory.ts` | Regression probe | **Active** | `pnpm probe:muthur-atlas-memory` |
| `src/lib/muthur-ship-memory.ts` | Client → ship persist bridge | **Active** | POST after chat reply |

---

## MUTHUR — partial / unwired paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `src/muthur/memory/core.ts` semantic scoring | Vector recall | **Partial (stubbed)** | `const semantic = 0` in ranking |
| `src/muthur/atlas/atlas.ts` | Entity graph | **Partial (in-memory)** | Re-seeded each boot; not loaded from SQLite atlas |
| `src/muthur/memory/promotion.ts` | Promotion pipeline | **Partial (unwired)** | No call sites outside module |
| `recallTechniques()` / `recordTechnique()` | Technique loop | **Partial (unwired)** | No API/tool hook |
| `src/app/api/cyberdeck-chat/route.ts` | Chat memory injection | **Partial** | Server `buildMemoryContext` **skipped** when client sends `memoryContext` string |
| `src/lib/mock/atlas.ts` | Static mock atlas | **Stale** | Superseded by live API |
| `docs` `.echo-mirage/memory.sqlite` | Specified operator DB | **Unknown / not implemented** | Not found in scanned `src/` |

---

## MUTHUR — dead / theater-only paths

| Path | Purpose | Status | Evidence |
|------|---------|--------|----------|
| `src/lib/cyberdeck/operator-orchestrator.ts` `handleAtlasSelected` | “Samus-Manus // Memory” line | **Theater only** | No data write |
| Samus Python import at runtime | Live memory bridge | **Absent** | Only voice hooks reference `SAMUS_MANUS_ROOT` |

---

## External systems

| System | Status | Relationship to Samus memory |
|--------|--------|------------------------------|
| `C:\dev\noosphere\` | **Active (separate repo)** | Documented as chat substrate; bridge optional via `ai_chat_server.py` |
| `f:\dev\larql\` | **Separate product** | Not samus-manus memory runtime |

---

## Recoverable data summary

| Data | Recoverable? | Notes |
|------|--------------|-------|
| Legacy `skills/memory/memory.db` (37k rows) | **Yes** | Largest corpus; mostly `voice_input` type |
| Project `.codex/memory.db` (6.7k rows) | **Yes** | Current boot default |
| Central atlas graph | **Yes** | `~/.codex/atlas/atlas.db` |
| SQL dumps / archives | **Yes** | Versioned in repo |
| Embeddings in live DBs | **No (on this machine)** | Column exists; all NULL — may need re-embed job, not archaeology |
| `memory/profiles/` DBs | **No** | Never created on disk |
| MVP trash | **Low value** | Superseded |

---

## Answers to success-criteria questions (evidence-based)

| Question | Answer |
|----------|--------|
| What memory systems exist? | Samus: SQLite hybrid + Semantic Atlas SQLite + canonical files. MUTHUR: sql.js ship + IndexedDB + in-memory atlas seed. |
| What memory data still exists? | **Yes** — two Samus memory DBs + atlas.db + MUTHUR ship DB + archives (see D1 counts). |
| What architecture survived? | Full Samus **code** stack; MUTHUR **partial TypeScript port**. |
| What artifacts remain? | Life file, memorial, reconstruction anchor, archives (see D2). |
| What is permanently lost? | Profile DB files (never created); populated embeddings in live DBs (if never stored, not recoverable without re-embedding). |
| What can be recovered? | Row text, atlas graph, canonical docs, archive exports — **without rewriting architecture**. |
