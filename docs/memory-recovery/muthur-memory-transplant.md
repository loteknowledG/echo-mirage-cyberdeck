# D5 — MUTHUR Memory Transplant Recommendation

**Work order:** L-XX Samus-Manus Memory Recovery & MUTHUR Memory Transplant  
**Phase:** Discovery only — **recommendation, not implementation**  
**Evidence date:** 2026-06-07  
**Inputs:** D1–D4, live DB inspection, code scan of `C:\dev\samus-manus` and `f:\dev\echo-mirage-cyberdeck`

---

## Recovery verdict

**The original Samus-Manus memory architecture still exists.**

| Layer | Survived? | Evidence |
|-------|-----------|----------|
| SQLite hybrid memory (code + data) | **Yes** | Two live DBs; 44k+ total rows |
| Semantic Atlas (code + data) | **Yes** | `~/.codex/atlas/atlas.db` populated |
| Canonical continuity files | **Yes** | Life file, anchor, memorial, archives |
| Embedding-populated semantic recall | **Unclear / degraded** | 0 embeddings in live Samus DBs on operator machine |
| MUTHUR full port | **No** | Partial TypeScript shell; stubs and unwired paths |

**Do not build a replacement memory system before exploiting what survived.**

---

## Option A — Reuse Samus-Manus memory directly

**Description:** MUTHUR calls Samus Python memory stack at runtime (subprocess, local API, or shared DB paths).

| Aspect | Assessment |
|--------|------------|
| **Reuse** | `memory.py`, `atlas.py`, live `.codex/memory.db`, central `atlas.db`, boot/sync scripts |
| **Effort** | Medium (2–4 weeks) — IPC bridge, path unification, Electron packaging |
| **Risks** | Python dep in Electron; split-brain DB paths (`api/chat.py` vs boot); Windows path coupling; two sources of truth if MUTHUR ship DB also writes |
| **Migration** | Point `MEMORY_DB_PATH` / `ATLAS_DB_PATH` at Samus stores; disable duplicate MUTHUR writes or merge policy |

**When to choose:** Operator runs Samus boot on same machine as cyberdeck; wants **one** memory corpus immediately without re-porting logic.

**Blockers:**

- Chat hot path today uses IndexedDB only (`cyberdeck-chat/route.ts` skips server memory when client sends context)
- No existing memory bridge (only voice hooks)

---

## Option B — Reuse schema + data; rebuild runtime in MUTHUR (recommended)

**Description:** Keep Samus **data artifacts** and **schema contracts**; complete the existing TypeScript port in `src/muthur/`.

| Aspect | Assessment |
|--------|------------|
| **Reuse** | Import/copy SQLite files; port retrieval logic; port atlas schema to sql.js or second DB file |
| **Effort** | Medium–large (4–8 weeks) phased |
| **Risks** | Port drift from Samus; sql.js perf limits; re-embed pipeline must be rebuilt in Node |
| **Migration** | One-time import scripts (future work order): legacy → `.muthur/memory/`; atlas.db → MUTHUR atlas store |

**When to choose:** Echo Mirage / Electron must stay Node-native; operator wants MUTHUR as sole runtime.

**Why recommended:**

1. Port **already started** (`TEST_HANDOFF.md`, `core.ts`, boot, probes, UI)
2. Samus **data is SQLite-portable** — archaeology confirms compatible tables
3. Avoids long-term Python subprocess in cyberdeck
4. Fixes known gaps surgically vs greenfield

---

## Option C — Reuse concepts only; rebuild completely

**Description:** Treat Samus as historical reference; design new memory from `docs/echo-mirage-memory-spec.md` only.

| Aspect | Assessment |
|--------|------------|
| **Reuse** | Doctrine, artifact narratives, operator UX patterns |
| **Effort** | Large (8+ weeks) |
| **Risks** | **Highest** — repeats work; loses 44k+ row corpus and atlas graph unless manually migrated anyway |
| **Migration** | N/A — new stores |

**When to choose:** Only if Samus code/data proven unusable — **not supported by evidence**.

**Recovery policy violation risk:** High — equivalent to “let’s rebuild” before exhausting transplant.

---

## Recommended path: **Option B** (phased)

### Phase 0 — Preservation (complete in recovery; no code)

- [x] Inventory assets (D1)
- [x] Inventory artifacts (D2)
- [x] Status map (D3)
- [x] Schema analysis (D4)
- [ ] Operator backup: copy `skills/memory/memory.db`, `.codex/memory.db`, `~/.codex/atlas/atlas.db` to cold storage

### Phase 1 — Wire what exists (first implementation work order)

| Item | Samus source | MUTHUR target | Priority |
|------|--------------|---------------|----------|
| Fix semantic stub | `memory.py` `query_similar` | `core.ts` real semantic score | **P0** |
| Chat merge policy | N/A (behavior) | `cyberdeck-chat/route.ts` merge client + ship | **P0** |
| Atlas persistence | `atlas.py` SQLite | New atlas store or tables in ship DB | **P1** |
| Wire promotion | Samus promotion patterns | `promotion.ts` post-chat hook | **P1** |
| Technique recall | `tool_recall.py` | `recallTechniques()` in tool path | **P1** |

### Phase 2 — Data transplant (second work order)

| Item | Action |
|------|--------|
| Legacy corpus | Import selected types from `skills/memory/memory.db` (exclude bulk `voice_input` if noise) |
| Project corpus | Merge `.codex/memory.db` |
| Atlas | Copy/import `atlas.db` entities/relations/locations |
| Canonical pointers | Re-run sync logic or import pointer rows |
| Embeddings | **Re-embed job** (Samus + MUTHUR) — data not recoverable from NULL columns |

### Phase 3 — Samus path unification (samus-manus repo, separate order)

| Item | Action |
|------|--------|
| `api/chat.py` DB path | Align with `get_memory_db_path()` |
| Document atlas path | Single source of truth in docs |
| Profile DBs | Decide if friend/hangout profiles still desired |

---

## What to transplant into MUTHUR (lineage checklist)

| Capability | Transplant? | Source | Notes |
|------------|-------------|--------|-------|
| Memory | **Yes** | SQLite rows + hybrid retrieval | Text recoverable now |
| Continuity | **Yes** | Canonical files + daily memory boot | Already partial in `boot_muthur.ts` |
| Entity tracking | **Yes** | Atlas graph | Needs persistence layer |
| Semantic recall | **Yes (rebuild embed)** | `memory.py` logic | Not recoverable from NULL embeddings |
| Identity persistence | **Yes** | `identity_bootstrap.py` patterns | Partially ported |
| Cross-session client recall | **Yes** | IndexedDB layer | Already operational |
| Noosphere bridge | **Optional** | `ai_chat_server.py` | Separate substrate |
| Voice corpus as memory | **Selective** | 37k `voice_input` rows | Likely noise — curator decision |

---

## What is permanently lost (evidence-based)

| Item | Verdict |
|------|---------|
| MVP trash tree | Superseded — low value |
| Populated embedding vectors in live DBs | **Not present** — must recompute if semantic recall needed |
| `memory/profiles/*.db` | Never created on disk |
| Dexie export as live runtime | Unwired experiment |
| Unified Samus chat/boot DB path | **Not lost** — fixable configuration drift |

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Split-brain Samus DBs | High | Unify paths before any import |
| Import 37k voice transcripts as memory | Medium | Type-filtered import |
| sql.js scale limits | Medium | Benchmark; defer `better-sqlite3` decision |
| Atlas drift (in-memory MUTHUR) | High | Persist early in Phase 1 |
| Skipping ship memory in chat | High | Merge policy in Phase 1 |
| Re-embed cost/time | Medium | Lazy embed on add + backfill job |

---

## Effort estimates (implementation work orders, not this recovery)

| Package | Estimate | Outcome |
|---------|----------|---------|
| Phase 1 wiring | 1–2 weeks | MUTHUR recall + chat + atlas persist functional |
| Phase 2 data import | 1–2 weeks | Samus corpus + atlas in MUTHUR stores |
| Re-embedding pipeline | 1–2 weeks | Semantic leg restored (Node ONNX or Python sidecar) |
| Samus unification | 3–5 days | Single DB path in Samus runtime |
| Option A Python bridge | 2–4 weeks | Alternative to Phase 1 port completion |

---

## Decision record

| Question | Recommendation |
|----------|----------------|
| Replace Samus memory? | **No** |
| Rebuild from scratch? | **No** (Option C rejected) |
| Run Samus Python inside MUTHUR forever? | **No** (Option A fallback only) |
| Primary strategy | **Option B** — complete MUTHUR port using Samus schema + live data |
| Next work order | Phase 0 backup → Phase 1 wiring (P0 items) — **separate ticket, operator approval required** |

---

## Operator gate

Per **Recovery Before Construction** policy:

> Only after this recovery documentation is accepted may a new work order open for implementation.

This document satisfies deliverable **D5**. Implementation must not begin until the operator opens that follow-on work order.
