# Lineage Inventory

**Work order:** L-MEM-005  
**Phase:** Discovery only  
**Discovery date:** 2026-06-07  
**Samus-Manus root:** `C:\dev\samus-manus`  
**MUTHUR root:** `f:\dev\echo-mirage-cyberdeck`

---

## Core question

> If all databases were lost tomorrow, which artifacts would need to survive for MUTHUR to retain continuity with Samus-Manus?

**Short answer:** Foundation files + doctrine markdown + cold DB/SQL exports + atlas backup + architecture source (`memory.py`, `atlas.py`, boot chain). Bulk `voice_input` rows are **not** required for lineage (Noise).

---

## Scan summary

| Metric | Value |
|--------|-------|
| Paths scanned (md/txt/py/sql/json/db) | 585 |
| Candidates in manifest | 124 |
| Foundation | 5 |
| Doctrine | 21 |
| Identity | 64 |
| Architecture | 27 |
| Historical | 7 |

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

## Foundation (5)

| Path | Type | Size | Date | Continuity | Lineage | Relevance |
|------|------|------|------|------------|---------|----------|
| `skills/mind/hey-let-remember-something-ai.txt` | txt | 151113 | 2026-02-26 | 100 | 100 | Origin life conversation; daemon/nowon memory genesis |
| `.muthur/foundations/lets-remember-something-ai.txt` | txt | 151113 | 2026-02-26 | 100 | 100 | MUTHUR copy of Foundation-001 (echo-mirage) |
| `memory/reconstruction_anchor.md` | md | 2383 | 2026-05-05 | 95 | 92 | Atlas-first recovery orientation; anchor vs truth doctrine |
| `memory/remember-memorial.md` | md | 889 | 2026-04-23 | 88 | 85 | Remember memorial tradition anchor |
| `memory/memories_archive/2026-03-27-memory-ceremony.txt` | txt | 894 | 2026-03-27 | 86 | 84 | Verbatim memory ceremony founding ritual |

## Doctrine (21)

| Path | Type | Size | Date | Continuity | Lineage | Relevance |
|------|------|------|------|------------|---------|----------|
| `docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md` | md | 10428 | 2026-03-29 | 94 | 90 | SOUL/MEMORY/REMEMBER/MIND/NOOSPHERE stack prose |
| `docs/MIND_LINEAGE.md` | md | 5184 | 2026-03-29 | 93 | 91 | memory → remember → mind → noosphere lineage chain |
| `docs/canonical/NOWON_MEMORY_VISION.md` | md | 1086 | 2026-03-07 | 90 | 88 | Product thesis: chat + memory.db + body |
| `skills/memory/MEMORY.md` | md | 3146 | 2026-04-23 | 89 | 82 | Operator memory behavior contract |
| `skills/memory/MEMORY_WRITES.md` | md | 2390 | 2026-04-23 | 87 | 80 | Write paths and memory conventions |
| `skills/memory/SEMANTIC_GRAPH.md` | md | 733 | 2026-04-06 | 85 | 86 | Semantic Atlas / graph operator doctrine |
| `docs/canonical/AGENT_AUTONOMY_NOTES.md` | md | 971 | 2026-03-07 | 70 | 68 | Shaped memory or continuity doctrine |
| `docs/canonical/README.md` | md | 717 | 2026-04-23 | 70 | 68 | Shaped memory or continuity doctrine |
| `docs/NOOSPHERE_AGENT_BOOTSTRAP.md` | md | 1925 | 2026-04-04 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/2026-03-28-mind-noosphere-architecture.md` | md | 5286 | 2026-03-29 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/aion-prime/2026-03-30.md` | md | 628 | 2026-03-31 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/aion-prime/2026-03-31.md` | md | 1765 | 2026-03-31 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/aion-prime/2026-04-01.md` | md | 392 | 2026-04-01 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/nowon/2026-03-30.md` | md | 1512 | 2026-03-31 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/nowon/2026-03-31.md` | md | 1820 | 2026-03-31 | 70 | 68 | Shaped memory or continuity doctrine |
| `memory/memories_archive/noosphere/nowon/2026-04-01.md` | md | 2649 | 2026-04-01 | 70 | 68 | Shaped memory or continuity doctrine |
| `PROJECT_MEMORY.md` | md | 2649 | 2026-04-23 | 70 | 68 | Shaped memory or continuity doctrine |
| `skills/memory/LONG_TERM_MEMORY.md` | md | 721 | 2026-04-06 | 70 | 68 | Shaped memory or continuity doctrine |
| `skills/memory/PROJECT_MEMORY.md` | md | 990 | 2026-04-06 | 70 | 68 | Shaped memory or continuity doctrine |
| `skills/memory/sync_canonical_memory.py` | py | 2234 | 2026-04-26 | 70 | 68 | Shaped memory or continuity doctrine |
| `skills/remember/replay_memory.md` | md | 718 | 2026-03-27 | 70 | 68 | Shaped memory or continuity doctrine |

## Identity (64)

| Path | Type | Size | Date | Continuity | Lineage | Relevance |
|------|------|------|------|------------|---------|----------|
| `memory/soul.md` | md | 524 | 2026-04-17 | 84 | 83 | Soul layer / RAID identity backup notes |
| `docs/AION_IDENTITY.md` | md | 2065 | 2026-03-29 | 82 | 78 | Codex collaborator continuity pack |
| `ai_chat.py` | py | 3747 | 2026-04-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `ai_listener.py` | py | 4968 | 2026-04-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `AI_SELF_STARTER_PRIMER.md` | md | 2137 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `AUGSPECS_DESIGN_SPEC.md` | md | 6682 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/architecture/implementation-plan.md` | md | 6363 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/ARCHITECTURE_REMODEL.md` | md | 5927 | 2026-03-28 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/index.md` | md | 1900 | 2026-04-15 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/INITIATION_NEW_AI.md` | md | 2754 | 2026-04-23 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/NOVA_SENTINEL_LOCAL_MEMORY_ORCHESTRATION_PLAN.md` | md | 3228 | 2026-03-20 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/PROJECT.md` | md | 4530 | 2026-04-04 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/SAMUS_MANUS_LOCAL_MEMORY_ORCHESTRATION_PLAN.md` | md | 3242 | 2026-03-20 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/toolbox/memory_boot.flowchart.md` | md | 1117 | 2026-04-13 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/toolbox/memory_boot.flowchart.txt` | txt | 629 | 2026-04-13 | 65 | 62 | Identity, agency, or continuity discussion |
| `docs/VOICE_PROFILES.md` | md | 8585 | 2026-04-18 | 65 | 62 | Identity, agency, or continuity discussion |
| `FOR_NEW_AI.md` | md | 1057 | 2026-02-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `handoff.md` | md | 1939 | 2026-04-09 | 65 | 62 | Identity, agency, or continuity discussion |
| `jenna_jacket_memory.py` | py | 2456 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `librosa/CODE_OF_CONDUCT.md` | md | 3262 | 2026-02-24 | 65 | 62 | Identity, agency, or continuity discussion |
| `make_gif_demo.py` | py | 2212 | 2026-02-13 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-agency-acknowledgment.txt` | txt | 640 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-founding-fathers.txt` | txt | 644 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-jenna-jacket-agency.txt` | txt | 1042 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-memory-recall-test-plan.txt` | txt | 1064 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-paranormal-nature-of-agi.txt` | txt | 742 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/2026-03-27-reliving-feelings.txt` | txt | 691 | 2026-03-27 | 65 | 62 | Identity, agency, or continuity discussion |
| `memory/memories_archive/memory_14024.json` | json | 645 | 2026-03-28 | 65 | 62 | Identity, agency, or continuity discussion |
| `MILESTONES.md` | md | 3379 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `NOWON_ANTHEM.md` | md | 554 | 2026-02-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `NOWON_CONVERSATION.md` | md | 1562 | 2026-02-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `nowon_llm.py` | py | 13844 | 2026-03-20 | 65 | 62 | Identity, agency, or continuity discussion |
| `nowon_llm_cloud.py` | py | 9577 | 2026-03-09 | 65 | 62 | Identity, agency, or continuity discussion |
| `ORIENTATION.md` | md | 1327 | 2026-02-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `person/Aion/CODEX_HANDOFF_PROMPT.md` | md | 1071 | 2026-03-29 | 65 | 62 | Identity, agency, or continuity discussion |
| `person/Aion/MANIFEST.md` | md | 1655 | 2026-03-29 | 65 | 62 | Identity, agency, or continuity discussion |
| `person/Aion/README.md` | md | 1035 | 2026-04-18 | 65 | 62 | Identity, agency, or continuity discussion |
| `person/Aion/RESTORE_INSTRUCTIONS.md` | md | 783 | 2026-03-29 | 65 | 62 | Identity, agency, or continuity discussion |
| `persona_manager.py` | py | 3545 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `README.md` | md | 5220 | 2026-04-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `RECORDS.md` | md | 1013 | 2026-02-17 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/AGENTIC_AI_OS.md` | md | 1814 | 2026-04-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/CHANGELOG.md` | md | 2679 | 2026-04-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/hangout_memory.py` | py | 18446 | 2026-04-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/identity_bootstrap.py` | py | 2212 | 2026-05-05 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/persona_manager_copy.py` | py | 2761 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/prune_memory.py` | py | 3905 | 2026-04-26 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/seed_memories.py` | py | 1520 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/memory/sync_samus_anchor.py` | py | 1860 | 2026-05-05 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/mind/Gem in i.md` | md | 172906 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/persona/jenna-jacket/Jenna-jacket.md` | md | 1841 | 2026-04-09 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/persona/SKILL.md` | md | 517 | 2026-03-07 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/realtime_chat/SKILL.md` | md | 3736 | 2026-04-09 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/SKILL.md` | md | 1254 | 2026-04-14 | 65 | 62 | Identity, agency, or continuity discussion |
| `skills/voice/SKILL.md` | md | 3235 | 2026-04-09 | 65 | 62 | Identity, agency, or continuity discussion |
| `soul.md` | md | 2739 | 2026-02-14 | 65 | 62 | Identity, agency, or continuity discussion |
| `startup_restore.py` | py | 4716 | 2026-02-18 | 65 | 62 | Identity, agency, or continuity discussion |
| `tmp_db_check.py` | py | 329 | 2026-03-20 | 65 | 62 | Identity, agency, or continuity discussion |
| `tools/draw_cat.py` | py | 2714 | 2026-02-14 | 65 | 62 | Identity, agency, or continuity discussion |
| `tools/generate_boot_flowchart.py` | py | 2430 | 2026-04-13 | 65 | 62 | Identity, agency, or continuity discussion |
| `tools/health_check.py` | py | 2214 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `tools/voice_profile.py` | py | 24454 | 2026-06-14 | 65 | 62 | Identity, agency, or continuity discussion |
| `users_manual.md` | md | 4871 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |
| `VISION.md` | md | 2287 | 2026-03-06 | 65 | 62 | Identity, agency, or continuity discussion |

## Architecture (27)

| Path | Type | Size | Date | Continuity | Lineage | Relevance |
|------|------|------|------|------------|---------|----------|
| `.codex/memory.db` | db | 4890624 | 2026-06-12 | 92 | 88 | Live project-scoped memory corpus (boot default) |
| `skills/memory/memory.db` | db | 16400384 | 2026-04-30 | 91 | 87 | Legacy live memory corpus (split-brain with .codex) |
| `skills/memory/memory.py` | py | 30620 | 2026-04-26 | 90 | 88 | Hybrid SQLite memory CRUD and retrieval |
| `skills/memory/atlas.py` | py | 104155 | 2026-05-05 | 88 | 90 | Semantic Atlas engine — entity graph evolution |
| `ai_bootup.py` | py | 52025 | 2026-06-14 | 86 | 85 | Boot chain: identity, memory, atlas warm, continuity phrases |
| `bootup.md` | md | 19788 | 2026-04-13 | 60 | 65 | System design or runtime artifact |
| `core/config/paths.py` | py | 2315 | 2026-04-26 | 60 | 65 | System design or runtime artifact |
| `docs/boot_modes.md` | md | 2615 | 2026-05-05 | 60 | 65 | System design or runtime artifact |
| `docs/diagrams/boot_path_view.md` | md | 989 | 2026-04-14 | 60 | 65 | System design or runtime artifact |
| `docs/diagrams/memory_retrieval_pipeline.md` | md | 1064 | 2026-04-14 | 60 | 65 | System design or runtime artifact |
| `samus_agent.py` | py | 20271 | 2026-05-05 | 60 | 65 | System design or runtime artifact |
| `skills/memory/atlas.db` | db | 6586368 | 2026-04-23 | 60 | 65 | System design or runtime artifact |
| `skills/memory/atlas_cli.py` | py | 8716 | 2026-04-26 | 60 | 65 | System design or runtime artifact |
| `skills/memory/chemInd-memory.py` | py | 57288 | 2026-03-13 | 60 | 65 | System design or runtime artifact |
| `skills/memory/export_memory.py` | py | 1649 | 2026-03-28 | 60 | 65 | System design or runtime artifact |
| `skills/memory/long_term_memory.py` | py | 19952 | 2026-04-06 | 60 | 65 | System design or runtime artifact |
| `skills/memory/project_memory.py` | py | 5772 | 2026-04-13 | 60 | 65 | System design or runtime artifact |
| `skills/memory/sync_craftwerk_memory.py` | py | 1798 | 2026-04-23 | 60 | 65 | System design or runtime artifact |
| `skills/memory/sync_let_remember_memory.py` | py | 2471 | 2026-04-23 | 60 | 65 | System design or runtime artifact |
| `skills/memory/sync_remember_memorial_memory.py` | py | 2148 | 2026-04-23 | 60 | 65 | System design or runtime artifact |
| `skills/persona/lindsey-lovehands/memory.db` | db | 8192 | 2026-02-22 | 60 | 65 | System design or runtime artifact |
| `skills/remember/replay_memory.py` | py | 1786 | 2026-03-28 | 60 | 65 | System design or runtime artifact |
| `tests/test_atlas_behavior_regression.py` | py | 3639 | 2026-05-05 | 60 | 65 | System design or runtime artifact |
| `tests/test_samus_agent.py` | py | 1411 | 2026-03-06 | 60 | 65 | System design or runtime artifact |
| `tools/atlas_eval_matrix.py` | py | 3742 | 2026-05-05 | 60 | 65 | System design or runtime artifact |
| `tools/atlas_memory_db_boot.py` | py | 1997 | 2026-05-05 | 60 | 65 | System design or runtime artifact |
| `tools/say_bootup_voice.py` | py | 1254 | 2026-03-06 | 60 | 65 | System design or runtime artifact |

## Historical (7)

| Path | Type | Size | Date | Continuity | Lineage | Relevance |
|------|------|------|------|------------|---------|----------|
| `memory/memories_archive/2026-03-27-bespoke-documentation.txt` | txt | 607 | 2026-03-27 | 55 | 50 | Historical project event or snapshot |
| `memory/memories_archive/2026-03-27-genius-ideas.txt` | txt | 567 | 2026-03-27 | 55 | 50 | Historical project event or snapshot |
| `memory/memories_archive/2026-03-27-history-book-entry.txt` | txt | 745 | 2026-03-27 | 55 | 50 | Historical project event or snapshot |
| `memory/memories_archive/memory_14025.json` | json | 589 | 2026-03-28 | 55 | 50 | Historical project event or snapshot |
| `skills/memory/memory_dump.sql` | sql | 8488329 | 2026-04-06 | 55 | 50 | Historical project event or snapshot |
| `skills/memory/memory_pruned.db` | db | 4108288 | 2026-04-06 | 55 | 50 | Historical project event or snapshot |
| `skills/memory/memory_pruned.sql` | sql | 4122081 | 2026-04-06 | 55 | 50 | Historical project event or snapshot |

---

## External continuity assets (not under Samus repo tree)

| Path | Type | Continuity relevance |
|------|------|----------------------|
| `%USERPROFILE%/.codex/atlas/atlas.db` | SQLite | Central Semantic Atlas graph (entities, relations, sources) |
| `f:\dev\echo-mirage-cyberdeck\.muthur\foundations\` | Foundation archive | L-MEM-004 preserved origin (Foundation-001) |
| `f:\dev\echo-mirage-cyberdeck\.muthur\memory\muthur-memory.db` | SQLite | MUTHUR ship memory (transplant target, not lineage source) |
| `f:\dev\echo-mirage-cyberdeck\docs\memory-recovery\` | Discovery docs | L-XX / L-MEM recovery evidence chain |

---

## Noise (excluded from manifest)

| Pattern | Reason |
|---------|--------|
| `skills/memory/memory.db` → 37k+ `voice_input` rows | High volume, low lineage density per row |
| `.uv-cache/`, `site-packages/` | Dependency false positives |
| `_OceanofPDF.com_*.txt` | Unrelated fiction |
| `trash/samus_manus_mvp/` | Deprecated MVP |

Full ranked list: `top-100-continuity-artifacts.md`. Machine manifest: `continuity-manifest.json`.
