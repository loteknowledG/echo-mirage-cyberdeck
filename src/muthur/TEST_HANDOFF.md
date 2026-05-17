# MUTHUR Memory Integration - Test Handoff

## Summary

MUTHUR Memory Runtime has been ported from `samus-manus` to `echo-mirage-cyberdeck`. This introduces SQLite-backed persistent memory with hybrid retrieval, boot sequencing, and a promotion pipeline.

## Files Changed

```
A src/muthur/memory/core.ts       - SQLite memory core with hybrid retrieval
A src/muthur/memory/promotion.ts  - Memory lifecycle promotion pipeline
A src/muthur/memory/index.ts      - Memory module exports
A src/muthur/boot/boot_muthur.ts  - MUTHUR boot sequence
A src/muthur/atlas/atlas.ts        - Semantic Atlas (future entity graph)
A src/muthur/atlas/index.ts       - Atlas exports
A src/muthur/index.ts             - Main MUTHUR module exports
A src/muthur/memory/SELF.md       - Identity anchor
A src/muthur/memory/MEMORY.md      - Operational memory doc
A src/muthur/memory/daily/.gitkeep
A src/muthur/receipts/.gitkeep
```

## Known Issues (Pre-existing)

These errors existed before this work:
```
src/app/cyberdeck/page.tsx(3128,15): error TS2345: Argument of type '"CARD_TABLE_CLEARED"' is not assignable to parameter of type 'NarrationEvent'.
src/app/cyberdeck/page.tsx(5125,29): error TS2345: Same as above
src/components/cyberdeck/roll-a-deck.tsx(135,31): error TS2709: Cannot use namespace 'EmblaCarousel' as a type.
```

## New TypeScript Errors (Should Fix)

These are in the new muthur code and need fixing:

### 1. sql.js not installed
```bash
pnpm add sql.js
```

### 2. Type errors in core.ts (implicit any)
Add explicit types to callback parameters in:
- Line 296: `row` parameter
- Line 417: `r` parameter
- Line 427: `r` parameter
- Line 431: `r` parameter
- Line 548: `row` parameter

### 3. Type errors in boot_muthur.ts
Lines 204-209: Spread argument issues with `stmt.run()` - sql.js stmt.run() takes an array, not spread.

### 4. Path alias in memory/index.ts
```from "@/lib/muthur-memory"``` - verify this resolves correctly.

## Validation Commands

```bash
# Type check
pnpm exec tsc --noEmit

# Lint
pnpm exec eslint src/muthur electron/main.js electron/preload.js

# Build
pnpm build

# E2E
pnpm e2e
```

## Test Scenarios

### 1. Memory Core
- [ ] `new Memory()` initializes SQLite schema
- [ ] `memory.add(kind, text, metadata)` stores and returns memory ID
- [ ] `memory.all(limit)` retrieves memories ordered by recency
- [ ] `memory.query_similar(query, topK)` returns hybrid-scored results
- [ ] `memory.reinforceMemory(id)` updates stability/count

### 2. Boot Sequence
- [ ] `bootMuthur()` completes without error
- [ ] Identity records are created on first boot
- [ ] Runtime identity records current IDE
- [ ] Startup sequencer avoids duplicate records

### 3. Retrieval Integration
- [ ] `buildMemoryContext(query?)` returns formatted memory string
- [ ] Memory query results are included in chat API when memoryContext provided

### 4. Promotion Pipeline
- [ ] Observations can be promoted to candidates
- [ ] Durable memories meet reinforcement/stability thresholds
- [ ] Low-value memories can decay

### 5. Atlas (Future)
- [ ] `getAtlas().resolveEntity()` finds entities
- [ ] Hard/soft relations are correctly categorized
- [ ] Core concepts (voice, memory, audio, identity) are seeded

## Safety Proof Checklist

Confirm NO instances of:
- [ ] `MouseEvent` or `KeyboardEvent` injection
- [ ] `dispatchEvent` for control
- [ ] `ipcRenderer` / `ipcMain` shell execution
- [ ] `getUserMedia` / `MediaRecorder`
- [ ] Unrestricted `exec` / `spawn`
- [ ] Cursor movement

## Architecture

```
src/muthur/
├── memory/
│   ├── core.ts      # SQLite Memory class (uses sql.js WASM)
│   ├── promotion.ts # Lifecycle pipeline
│   ├── SELF.md      # Identity anchor
│   ├── MEMORY.md    # Operational memory
│   └── daily/       # Episodic memories
├── boot/
│   └── boot_muthur.ts  # Boot sequence
├── atlas/
│   └── atlas.ts     # Semantic entity graph (future)
└── receipts/         # Operational evidence
```

## Dependencies Added

- `sql.js` - Pure JS SQLite (WASM, no native rebuild needed)

## Next Steps for Full Integration

1. Wire `buildMemoryContext()` into `src/app/api/cyberdeck-chat/route.ts` to inject memory before MUTHUR responds
2. Add `appendDailyMemory()` call after each chat session
3. Implement MUTHUR memory tools to record technique learnings
4. Consider `better-sqlite3` for production (native, faster) when Electron rebuild is acceptable

## Contact

For questions about this implementation, review the doc at `src/muthur/memory/MEMORY.md` or the source at `src/muthur/memory/core.ts`.