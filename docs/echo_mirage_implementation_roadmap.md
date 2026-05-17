# Echo Mirage Cyberdeck Implementation Roadmap

This document provides a step-by-step coding and integration checklist to implement the Echo Mirage system with MUTHUR, Fusion, Semantic Atlas, and Multi-Root Scoping.

---

## Step 0: Environment Preparation
- Confirm C: and F: drive stability.
- Verify all dev dependencies: Node, pnpm, Python, Docker, VSCode extensions.
- Ensure MUTHUR SQLite backend operational.
- Ensure Semantic Atlas database exists and accessible.

---

## Step 1: Card Table Gating
- Implement `safeSetServer()` function in `page.tsx` or relevant module.
- Replace all direct `setServer("ct")` calls with `safeSetServer()`.
- Sanitize persisted restore state:
  - `localStorage.currentServer`
  - session JSON restore paths
- Remove "ct" from `allServerIds` when `ENABLE_CARD_TABLE=false`.
- Test: Confirm Card Table is hidden and unreachable.

---

## Step 2: Fusion Runtime Integration
- Define task/event types and metadata for Fusion orchestrator.
- Integrate Memory + Semantic Atlas lookup into task resolution pipeline.
- Implement Multi-Root Scoping:
  - Define project root(s) in configuration
  - Map each root to scoped Area Maps
  - Update Fusion to respect root boundaries for task dispatch and retrieval
- Implement multi-agent supervision:
  - Cursor = coding
  - Codex = review
  - ChatGPT = reasoning / guidance
- Enable Fusion logging for receipts and task traces.

---

## Step 3: MUTHUR + Semantic Atlas Integration
- Confirm memory retrieval API works within scoped roots:
  - Canonical docs
  - Receipts
  - Operational context
- Implement Semantic Atlas API with multi-root awareness:
  - Entities, relations, workflows, dependencies, tags, validation rules, recovery strategies
- Connect Fusion → Atlas routing for runtime queries per active root
- Implement fallbacks if data is stale or incomplete

---

## Step 4: Context Assembly & Runtime Cognition
- Build Context Assembly Layer per root:
  - Merge memory + Atlas + live lookup
  - Generate scoped Area Maps for agents
- Inject context into agents
- Execute agent tasks; log outputs to receipts
- Validate that agents remain within root-scoped territory

---

## Step 5: Reinforcement & Verification
- Capture agent outputs in structured JSONL logs
- Update MUTHUR memory, Atlas entities/relations, workflow traces
- Apply reinforcement:
  - Increment confidence
  - Update dependencies
  - Store recovery strategies
- Trigger live lookup when memory incomplete or ambiguous

---

## Step 6: Monitoring & Drift Prevention
- Monitor:
  - Memory decay
  - Semantic drift
  - Workflow inconsistencies
  - Stale caches
- Maintain Area Map boundaries per root
- Schedule periodic memory consolidation (dream mode)

---

## Notes
- Multi-Root Scoping is critical to prevent context bleed and maintain operational coherence.
- All retrievals and lookups must respect root boundaries unless explicitly authorized.
- Area Maps define scoped operational territories for agents.
- Logs and receipts must be structured and feed back into MUTHUR and Atlas.
- Each phase should be tested incrementally before proceeding to the next.

---

This roadmap functions as a **step-by-step coding checklist** for implementing MUTHUR, Fusion, Semantic Atlas, and Multi-Root Scoping in Echo Mirage.

