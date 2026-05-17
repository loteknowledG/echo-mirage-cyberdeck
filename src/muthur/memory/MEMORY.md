# MUTHUR MEMORY

## Durable Operational Memory

This file stores evergreen operational knowledge that persists across sessions.

## Project Context

- **Project**: Echo Mirage Cyberdeck
- **Framework**: Next.js 16 + Electron 41 + TypeScript
- **Package Manager**: pnpm

## MUTHUR System

MUTHUR is the AI continuity co-pilot. Key components:

- `src/lib/muthur-core/` - Core MUTHUR loop and tools
- `src/lib/muthur-memory.ts` - Current IndexedDB-based conversation memory
- `src/muthur/memory/core.ts` - New SQLite-based memory subsystem (Phase 1 port)
- `src/muthur/boot/boot_muthur.ts` - MUTHUR boot sequence (Phase 2 port)

## Memory Architecture (In Progress)

### Phase 1 - Memory Core Port (DONE)
- [x] SQLite persistence layer
- [x] Memory records with metadata
- [x] Lexical term indexing
- [x] Hybrid retrieval (semantic + lexical + recency)
- [x] Technique recall
- [x] Reinforcement counts

### Phase 2 - Boot Sequence (DONE)
- [x] Identity restoration
- [x] Startup sequencing
- [x] Memory hydration
- [x] Runtime identity recording

### Phase 3 - File Structure (IN PROGRESS)
- [x] SELF.md identity anchor
- [ ] MEMORY.md this file
- [ ] daily/ directory
- [ ] receipts/ directory
- [ ] atlas/ directory

### Phase 4 - Memory Promotion Pipeline
- [ ] Observation → candidate
- [ ] Candidate → reinforced
- [ ] Reinforced → durable
- [ ] Archive/skill extraction

### Phase 5 - Retrieval Integration
- [ ] Query before MUTHUR responds
- [ ] Context injection hooks
- [ ] Relevant memory surfacing

### Phase 6 - Semantic Atlas Compatibility
- [ ] Clean interfaces for future entity graph
- [ ] Topology relations
- [ ] Dependency maps

## Key Decisions

1. **sql.js** (WASM) chosen over better-sqlite3 to avoid native module rebuilds for Electron
2. **Renderer-only** memory initially; main process access via IPC if needed
3. **Hybrid retrieval** weights: semantic 60%, lexical 25%, recency 10%, metadata 5%
4. **Deduplication threshold**: 0.92 (SequenceMatcher ratio)

## Operational Notes

- MUTHUR Memory uses IndexedDB via idb-keyval for simple conversation memory
- New SQLite memory provides durable, queryable persistence for operational facts
- The two systems complement each other: quick conversation context vs. durable learned knowledge

## Session Log

### 2026-05-17
- Initial memory system transplant from samus-manus
- Created src/muthur/memory/core.ts with SQLite hybrid retrieval
- Created src/muthur/boot/boot_muthur.ts with boot sequence
- Created src/muthur/memory/SELF.md identity anchor
- Created src/muthur/memory/MEMORY.md this file