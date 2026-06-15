# ADR-MEM-002 -- Project Continuity Graph

## Status

Accepted

## Date

2026-06-15

## Related Work

* L-MEM-006 -- Entity & Relationship Atlas
* L-MEM-005 -- Memory Atlas Retrieval Pipeline
* ADR-MEM-001 -- Deterministic Memory Atlas Routing Before Provider Uplink
* JP-L-MEM-006 -- Entity & Relationship Atlas Verification

---

## Context

Project continuity was represented by work orders, verification reports, ADRs, subsystem names, and provider decisions. Those artifacts were retrievable as documents, but relationship questions still needed a graph-shaped answer.

Questions such as:

```text
What verifies folder creation?
What governs workspace mutation?
What is related to L-FS-001?
What is related to provider authentication?
```

need deterministic navigation across project entities and relationships. They should not require provider reasoning, provider credentials, or a successful external model call.

---

## Decision

Echo Mirage shall treat project continuity as a local entity graph.

Entity Atlas is the deterministic graph retrieval layer for relationship-oriented continuity questions. When entity intent is detected, Cyberdeck routes the query to:

```text
POST /api/muthur/entity-query
```

before provider uplink.

The graph is allowed to answer relationship, governance, verification, subsystem, and provider-continuity questions directly from local project memory.

---

## Rationale

Continuity is not only a collection of isolated documents.

The useful shape of project memory includes edges:

* work order verifies verification report
* work order governed by ADR
* work order belongs to subsystem
* provider hardening references provider

When those edges are known, graph retrieval is more correct than provider inference.

---

## Consequences

### Positive

* relationship questions are reproducible
* graph answers do not require provider access
* invalid provider credentials do not block continuity retrieval
* MUTHUR can surface governance and verification lineage in the live UI
* future agents can traverse project memory through stable entity IDs

### Negative

* the graph must be maintained as new work orders, verifications, and ADRs are created
* entity aliases and relationship labels need governance as the atlas grows
* relationship retrieval must remain visibly separate from provider chat routing

---

## Verification

Verified by:

```text
JP-L-MEM-006
```

Acceptance evidence:

```text
What verifies folder creation? -> JP-L-FS-001
What governs workspace mutation? -> ADR-FS-001
What is related to L-FS-001? -> L-FS-001, JP-L-FS-001, ADR-FS-001, Workspace
What is related to provider authentication? -> L-CONN-001, JP-L-CONN-001, ADR-CONN-001, OpenRouter
```

All accepted prompts routed through:

```text
POST /api/muthur/entity-query
```

and did not use:

```text
POST /api/cyberdeck-chat
```

Provider-independence was verified with an invalid OpenRouter key. Entity Atlas still returned the expected graph response and reached:

```text
MUTHUR complete
```

---

## Doctrine

Project memory is a graph.

Documents preserve the record. Entity Atlas preserves the relationships that make the record navigable.
