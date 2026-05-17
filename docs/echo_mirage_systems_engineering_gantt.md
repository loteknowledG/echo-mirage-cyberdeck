# Echo Mirage Systems Engineering Gantt Plan

This document represents the phased systems engineering workflow for Echo Mirage Cyberdeck with MUTHUR, Fusion, Semantic Atlas, and Multi-Root Scoping integrated. Designed for human and AI comprehension.

---

## Phases

### Phase 0: Environment Preparation
- Verify C: and F: disk stability (OS vs AI/data assets).
- Confirm dev dependencies (Node, pnpm, Python, Docker, VSCode extensions).
- Confirm MUTHUR memory backend operational (SQLite persistence).
- Confirm Semantic Atlas database ready (entities, relations, tags, receipts).

### Phase 1: Card Table & Feature Gating
- Identify all `server === "ct"` entry points.
- Replace with `safeSetServer()` or capability-guarded calls.
- Sanitize persisted restore states.
- Remove "ct" from runtime registries if disabled.
- Test UX: ensure "ct" is hidden and unreachable.

### Phase 2: Fusion Runtime Integration
- Define task/event types Fusion orchestrates.
- Integrate MUTHUR memory / Atlas lookup.
- Implement Multi-Root Scoping:
  - Maintain list of project roots.
  - Dynamically add/remove root folders.
  - Each root generates scoped Area Map for agents.
  - Ensure isolation between roots.
- Implement multi-agent supervision.
- Enable Fusion logging for receipts and task traces.

### Phase 3: MUTHUR + Semantic Atlas Integration
- Ensure memory retrieval API queries canonical docs, prior receipts, operational context within active roots.
- Implement Semantic Atlas API with multi-root awareness.
- Connect Fusion → Atlas for runtime routing per root.

### Phase 4: Context Assembly & Runtime Cognition
- Aggregate memory, Atlas, live lookup per root.
- Build Area Maps for each root.
- Inject scoped context to agents.
- Execute agent actions within root-scoped territory.

### Phase 5: Receipts & Memory Reinforcement
- Capture outputs in structured logs.
- Update MUTHUR memory, Atlas entities/relations, workflow traces.
- Apply reinforcement: confidence increments, dependency updates, store recovery strategies.

### Phase 6: Live Lookup / Verification
- Trigger live inspection when memory incomplete, Atlas suggests gaps, runtime ambiguity detected.
- Query: source files, runtime states, env variables, logs, worktrees, persisted session data.
- Merge results into Context Assembly Layer → feed back to agents.

### Phase 7: Continuous Monitoring & Drift Prevention
- Monitor memory decay, semantic drift, workflow inconsistencies, stale caches.
- Maintain Area Map boundaries.
- Periodically consolidate memory (dream mode) → reinforce high-confidence relations.

### Phase 8: Testing & Validation
- Unit test Fusion orchestration, memory retrieval, Atlas query routing, context assembly.
- Integration test agent task execution, Area Map enforcement, receipts/log verification.
- Stress test multiple agents, large workflow graphs, live lookup under memory load.

### Phase 9: Deployment / Operational Handoff
- Confirm guards for disabled features.
- Ensure logging and receipts available for audit.
- Verify MUTHUR restores continuity after restart.
- Document final operational map.

---

## ASCII Gantt Representation

```text
Phase 0 |█████                         | Env Prep
Phase 1 |█████                         | Card Table Gating
Phase 2 |██████████                   | Fusion Runtime Integration
        |  ███ Multi-Root Scoping
Phase 3 |█████████                    | MUTHUR + Semantic Atlas Integration
Phase 4 |██████████                   | Context Assembly + Runtime Cognition
Phase 5 |█████                         | Receipts & Memory Reinforcement
Phase 6 |█████                         | Live Lookup / Verification
Phase 7 |█████                         | Continuous Monitoring / Drift Prevention
Phase 8 |█████                         | Testing & Validation
Phase 9 |█████                         | Deployment / Operational Handoff
```

This Gantt integrates Multi-Root Scoping into Phase 2 and shows downstream phases implicitly aware of project root scoping, ensuring scoped memory, Atlas, and Area Map enforcement.

