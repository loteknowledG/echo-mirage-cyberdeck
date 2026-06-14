# ADR-MEM-001 — Deterministic Memory Atlas Routing Before Provider Uplink

## Status

Accepted

## Date

2026-06-14

## Related Work

* L-MEM-005 — Memory Atlas Retrieval Pipeline
* JP-L-MEM-005 — Memory Atlas Verification
* L-CONN-001 — Provider Authentication and Model Availability Hardening
* Foundation Retrieval Architecture

---

## Context

Prior to L-MEM-005, MUTHUR answered most continuity-oriented questions through provider uplink.

Questions such as:

* What work order created this?
* What verified this?
* Why was this decision made?
* What are our active threads?

required either:

1. provider reasoning over available context
2. manual document inspection by the operator

This produced several problems:

* provider cost
* provider latency
* inconsistent answers
* dependency on external availability
* inability to guarantee continuity correctness

Project continuity existed inside work orders, verifier reports, ADRs, and foundations, but was not available through a unified retrieval layer.

---

## Decision

MUTHUR shall resolve continuity questions through deterministic project memory before provider uplink.

Routing order is:

```text
Foundation Retrieval
        ↓
Memory Atlas Retrieval
        ↓
Document Open Retrieval
        ↓
Provider Uplink
```

Memory Atlas becomes the authoritative retrieval mechanism for project continuity.

Provider reasoning is reserved for questions that cannot be answered from structured project memory.

---

## Rationale

Project continuity is a local truth source.

Work orders, verifier reports, ADRs, and foundations represent canonical project knowledge.

When these artifacts already contain the answer, provider inference introduces unnecessary uncertainty.

Example:

```text
What work order created folder creation?
```

Should return:

```text
L-FS-001
```

from project memory.

Not:

```text
Provider-generated interpretation
```

---

## Consequences

### Positive

#### Deterministic Continuity

Project history becomes queryable and reproducible.

The same question produces the same answer.

---

#### Reduced Provider Dependence

Continuity queries succeed without:

* API keys
* provider availability
* model selection

---

#### Faster Responses

Local retrieval is significantly faster than provider uplink.

---

#### Cadre Readiness

Future agents may retrieve:

* work orders
* verifier reports
* ADRs
* foundations

without external inference.

This supports future MUTHUR orchestration and continuity sharing.

---

#### Lower Cost

Project continuity no longer consumes provider tokens.

---

### Negative

#### Index Maintenance

Memory Atlas indexes must remain synchronized with project artifacts.

---

#### Retrieval Scope Growth

Additional memory sources will require indexing strategy and ownership.

Future candidates include:

```text
Entity Atlas
Relationship Atlas
Operator Journal
Cadre Reports
Memory Receipts
```

---

## Doctrine

Memory is not passive storage.

Memory is navigable project continuity.

MUTHUR should retrieve known project truth before asking an external model to reason about it.

---

## Verification

Verified by:

```text
JP-L-MEM-005
```

Acceptance criteria:

```text
What ADR decided provider authentication?
What work order created folder creation?
What are our active threads?
```

must resolve through Memory Atlas and reach:

```text
MUTHUR complete
```

without provider dependency.

---

## Future Work

* L-MEM-006 — Entity & Relationship Atlas
* L-MEM-007 — Work Order Continuity Tracking
* L-MEM-008 — ADR Relationship Graph
* L-MEM-009 — Memory Receipt System

These systems will expand Memory Atlas from document retrieval into continuity navigation.