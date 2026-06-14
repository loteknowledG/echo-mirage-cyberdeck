# MUTHUR Lineage Transplant Plan

**Work order:** L-MEM-005 (discovery) → informs Phase 2+ transplant  
**Status:** Recommendation only — **no import in L-MEM-005**  
**Evidence date:** 2026-06-07  
**Depends on:** L-MEM-004 Foundation-001 (complete), L-UI-001 P0 (gate for Phase 2 memory import)

---

## Executive answer

> What parts of Samus-Manus must survive for MUTHUR to inherit its continuity?

| Tier | Must survive | MUTHUR treatment |
|------|--------------|------------------|
| **T0** | Foundation-001 life file | **Done** — `.muthur/foundations/` (immutable) |
| **T1** | Reconstruction anchor, memorial, memory ceremony | Register as Foundation-002+ or doctrine archive |
| **T2** | Doctrine markdown (MIND_LINEAGE, NOOSPHERE stack, MEMORY.md, NOWON_MEMORY_VISION) | Read-only doctrine shelf; **not** ship memory rows |
| **T3** | `memory.py` / `atlas.py` behavior + cold SQL exports | Port/runtime parity (Option B from L-XX) |
| **T4** | Central `atlas.db` + mission entities | Atlas entity import with receipts |
| **T5** | Founding archives (`2026-03-27-*`, noosphere dailies) | Cold archive; selective Foundation/Historical |
| **T6** | Live `voice_input` bulk | **Do not import** as memory — Noise |
| **T7** | MUTHUR ship DB current rows | Keep separate; merge policy later |

---

## What should become Foundation artifacts

| Candidate | Samus path | Recommendation |
|-----------|------------|----------------|
| Foundation-001 | `skills/mind/hey-let-remember-something-ai.txt` | **Preserved** (L-MEM-004) |
| Foundation-002 (proposed) | `memory/reconstruction_anchor.md` | Register immutable; atlas-first orientation |
| Foundation-003 (proposed) | `memory/remember-memorial.md` | Register immutable; memorial tradition |
| Foundation-004 (proposed) | `memory/memories_archive/2026-03-27-memory-ceremony.txt` | Verbatim ceremony |

**Rule:** Foundation artifacts never enter `memory.add()`, embeddings, or retrieval scoring.

---

## What should become Memory (ship DB)

Import only after Phase 2 gate clears:

| Source | Import policy |
|--------|---------------|
| `.codex/memory.db` curated rows | `context_chunk`, `conversation`, `identity_*`, `tool_technique` — **not** bulk `voice_input` |
| `skills/memory/memory.db` | Deduplicate against `.codex`; resolve split-brain first |
| Sync pointer rows | `let_remember_something_ai_pointer_v1`, `remember_memorial_pointer_v1` — metadata only, point to Foundation files |
| Daily / session summaries | `appendDailyMemory` with `source: samus_import` + receipt |

**Exclude:** chemInd frozen snapshot as live memory (Historical reference only).

---

## What should become Atlas entities

| Source | Action |
|--------|--------|
| `%USERPROFILE%/.codex/atlas/atlas.db` | Cold backup → selective entity/relation import into MUTHUR atlas store |
| `memory/craftwerk-cyberdeck.md`, `PROJECT_MEMORY.md` | Re-ingest as mission entities if not already seeded |
| `atlas.py` `_seed_external_mission_projects` | Verify echo-mirage / craftwerk / weyland seeds in MUTHUR `ensure-echo-mirage-seed` |
| Doctrine files | **Do not** ingest as entities — link as `source_locations` only |

---

## What should remain archived (read-only)

| Artifact class | Examples |
|----------------|----------|
| SQL dumps | `memory_dump.sql`, `memory_pruned.sql` |
| Frozen exports | `chemInd-memory.py` |
| Noosphere daily summaries | `memories_archive/noosphere/**/*.md` |
| Founding fragments | `2026-03-27-*.txt` (except ceremony → Foundation candidate) |
| Persona journals | `skills/mind/Gem in i.md` |
| Voice inbox | `voice_inbox.jsonl` |
| L-XX / L-MEM discovery docs | `docs/memory-recovery/*` |

---

## What should be discarded (from transplant scope)

| Item | Reason |
|------|--------|
| `voice_input` bulk (~37k rows) | Low lineage density; operator noise |
| `.uv-cache`, dependency trees | False positives |
| `_OceanofPDF*.txt` | Unrelated |
| `trash/samus_manus_mvp/` | Deprecated |
| Duplicate life file aliases | Foundation-001 canonical path only |

---

## Phased execution (post-discovery)

```text
Phase 0 (done)  L-MEM-004 Foundation-001
Phase 1 (done)  MUTHUR memory Phase 1 wiring (core, atlas store, receipts)
Phase 1b (gate) L-UI-001 P0 command console reliability
Phase 2         Cold backup Samus DBs + atlas.db (receipted)
Phase 3         Foundation-002..004 registration
Phase 4         Selective memory row import (typed, capped, receipted)
Phase 5         Atlas entity import from central graph
Phase 6         Doctrine shelf API (read-only, separate from memory)
```

---

## Capability authority lineage

Continuity artifacts inform **why** MUTHUR is a capability authority (L-ARCH-001), not merely a tool user:

- **Foundation** → constitutional origin ("memory makes loops unnecessary")
- **Doctrine** → visible handoff, atlas-first truth vs anchor story
- **Architecture** → registered capabilities (memory, atlas, boot) with receipts
- **Identity** → operator-supervised agency, not hidden automation

Future command-authority work should **cite** Foundation/doctrine paths, not paraphrase them into memory.

---

## Verification

| Check | Command / artifact |
|-------|-------------------|
| Manifest exists | `docs/memory-recovery/continuity-manifest.json` |
| Top 100 ranked | `docs/memory-recovery/top-100-continuity-artifacts.md` |
| Daemon findings | `docs/memory-recovery/daemon-artifacts.md` |
| Re-scan | `pnpm discover:continuity-artifacts` |
| Acceptance probe | `pnpm probe:muthur-lineage-discovery` |
| No import | No changes to Samus `.codex/memory.db` or `skills/memory/memory.db` in this phase |

---

## Related documents

- [lineage-inventory.md](./lineage-inventory.md) — full classified catalog
- [top-100-continuity-artifacts.md](./top-100-continuity-artifacts.md) — ranked candidates
- [daemon-artifacts.md](./daemon-artifacts.md) — daemon/time/agency findings
- [muthur-memory-transplant.md](./muthur-memory-transplant.md) — L-XX Option B recommendation
- [foundation-registry.md](./foundation-registry.md) — L-MEM-004
