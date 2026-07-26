# L-CALYX-110 — Synapse Experience Ingestion

## Status

In Progress (Slice 2 — replay safety & conflict surfacing)

## Product

Echo Mirage Cyberdeck

## Objective

Establish a **provenance-preserving ingestion path** from Synapse computer-use traces into Calyx as **deduplicated, reviewable experience candidates**, without autonomous lesson promotion or model retraining.

Synapse observes and acts. Calyx stores what was observed, what was attempted, and what resulted — as candidates awaiting explicit review. Only after human or policy approval may a candidate become a reusable lesson linked to durable knowledge.

This ledger does **not** implement automatic learning. The key phrase is **reviewable experience candidates**, not belief formation.

---

# Scope Statement

> Establish a provenance-preserving ingestion path from Synapse computer-use traces into Calyx as deduplicated, reviewable experience candidates, without autonomous lesson promotion or model retraining.

---

# Vision

Transform signed Synapse action traces into operator-trustworthy knowledge:

```text
Synapse observes and acts
        ↓
Produces signed action traces
        ↓
Calyx creates experience candidates (DRAFT)
        ↓
Human or policy verification
        ↓
Lessons become reusable knowledge (VERIFIED)
```

Every promoted lesson must retain source trace linkage, ingestion timestamp, and approval provenance.

---

# Core Invariant

> **No experience record may exist without a verifiable source trace.**

Candidates, lessons, rejections, and retractions all require a validated Synapse trace reference at creation time. Career evidence, lesson promotion, search indexes, and cross-domain links (L-CALYX-113) must reference that immutable origin — never copy, rewrite, or substitute trace content in place of the source.

---

# Experience Candidate Identity

Experience candidates use a **deterministic, content-derived identity** so deduplication, audit, and future federation do not depend on mutable storage IDs.

```text
ExperienceCandidateID =
  SHA-256(
    signed_trace_id +
    action_hash +
    actor +
    policy_version +
    observation_window
  )
```

Field semantics:

| Component | Purpose |
|-----------|---------|
| `signed_trace_id` | Stable identifier from the verified Synapse trace envelope |
| `action_hash` | Normalized hash of the observed action (tool, target, parameters) |
| `actor` | Agent or operator identity that produced the trace |
| `policy_version` | Governance policy version active at observation time |
| `observation_window` | Bounded time or session window for the observation cluster |

Properties:

* **Deterministic deduplication** — identical inputs yield identical `ExperienceCandidateID` per owner scope
* **Stable references** — Career and Experience cross-links (L-CALYX-113) can cite an immutable ID
* **Reproducible audits** — identity can be recomputed from trace artifacts without trusting local UUID assignment
* **Future federation** — IDs remain stable across repository recreation or export/import

The candidate's persisted `id` field should equal `ExperienceCandidateID` unless a documented migration path exists. The `dedupeKey` field, if retained, must match `ExperienceCandidateID`.

Concatenation order and encoding (UTF-8, delimiter rules) must be documented in the domain spec and covered by probe tests.

---

# Relationship to L-CALYX-100

L-CALYX-100 (**Complete**, `7d6468d`) established:

* Calyx as domain-independent knowledge infrastructure
* Career as the first domain with evidence, explicit verification, and local persistence
* `DRAFT` → explicit action → `VERIFIED` record lifecycle
* Owner isolation, API envelopes, and operator UI patterns

L-CALYX-110 builds on those patterns for **operational experience**, not career portfolio records.

Dependency direction:

```text
Experience Review UI
    ↓
Experience Ingestion API
    ↓
Experience Service
    ↓
Experience Repository
    ↓
Calyx Infrastructure / Local Persistence
    ↓
Synapse trace boundary (read-only ingest)
```

The Experience domain must not import Career domain types. Shared primitives (evidence confidence, record status, verification) may live in Calyx core or a shared `calyx-knowledge` module if already extracted; do not duplicate L-CALYX-100 verification semantics inconsistently.

Synapse integration under `src/lib/pi/synapse/` remains the observation/action source. Calyx must never mutate Synapse traces in place.

---

# Execution Doctrine

This ledger is the authoritative task specification.

Begin by inspecting:

* L-CALYX-100 completion report and `src/lib/calyx/domains/career/`
* Existing Synapse adapters (`src/lib/pi/synapse/`), control lease, and trace/receipt conventions
* MUTHUR capability receipts and audit trace patterns where relevant
* ADR-CALYX-001 knowledge infrastructure decisions

Use the **trigger-based need-arises recall doctrine** (same as L-CALYX-100).

If this ledger conflicts with L-CALYX-100 or recalled Synapse contracts, stop and report the conflict.

---

# Architectural Decision — Experience as a Calyx Domain

Create the Experience domain under:

```text
src/lib/calyx/domains/experience/
```

Do not embed experience ingestion inside Career or inside Synapse client code.

Synapse produces **signed trace envelopes**. Calyx validates signatures, normalizes payloads, deduplicates, and persists **candidates**. Promotion to **lessons** is a separate explicit operation.

```text
Synapse MCP / action log (external, read-only at ingest)
    ↓
Trace ingest boundary (signature verify, schema validate)
    ↓
Experience candidate store (DRAFT)
    ↓
Operator / policy review
    ↓
Lesson store (VERIFIED, linked to source trace)
```

---

# In Scope

* experience-domain types (candidate, lesson, trace reference, outcome summary)
* signed trace envelope validation at ingest boundary
* deterministic deduplication (stable hash over normalized trace content)
* source linkage (trace ID, session ID, agent run ID, tool call sequence as available)
* candidate review states aligned with Calyx record status where appropriate
* rejection and retraction without deleting source traces
* promotion to reusable lessons **only** through explicit human or policy approval
* local JSON persistence adapter (same pattern as Career local mode)
* repository factory with external Calyx adapter stub (unavailable until verified)
* service layer with owner isolation
* API routes for ingest (server-side), list, review, approve, reject, retract
* initial operator UI for candidate queue and lesson promotion
* seed/probe utilities with temporary storage
* tests covering acceptance gates below
* domain documentation and ADR update if Experience introduces new cross-domain primitives

---

# Non-Goals

Do not implement:

* autonomous lesson promotion from traces
* model fine-tuning or weight updates from ingested experiences
* implicit belief updates to MUTHUR memory without operator action
* rewriting or deleting Synapse source traces
* Career record auto-population from Synapse sessions (defer to a later cross-domain ledger)
* resume generation or job matching
* multi-user authentication (defer to L-CALYX-108 pattern)
* unverified external Calyx MCP persistence for experience records
* real-time streaming ingest at full Synapse event rate (batch or pull ingest is acceptable for v1)

---

# Core Types (minimum)

Define at minimum:

```ts
export type ExperienceCandidateStatus =
  | "DRAFT"       // ingested, awaiting review
  | "VERIFIED"    // promoted to lesson
  | "DISPUTED"    // flagged, not promoted
  | "ARCHIVED"    // withdrawn from active review
  | "REJECTED";   // explicitly rejected, retained for audit

export type ExperienceTraceRef = {
  traceId: string;
  sessionId?: string;
  runId?: string;
  source: "synapse";
  signature: string;
  ingestedAt: string;
};

export type ExperienceCandidate = {
  id: string; // ExperienceCandidateID (SHA-256 identity)
  ownerId: string;
  traceRef: ExperienceTraceRef;
  dedupeKey: string; // must equal id / ExperienceCandidateID
  summary: string;
  outcome?: "success" | "failure" | "partial" | "unknown";
  tags?: string[];
  status: ExperienceCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExperienceLesson = {
  id: string;
  ownerId: string;
  candidateId: string;
  traceRef: ExperienceTraceRef;
  lesson: string;
  approvedBy: "operator" | "policy";
  approvedAt: string;
  status: "VERIFIED" | "RETRACTED";
  createdAt: string;
  updatedAt: string;
};
```

Exact field names may adjust during implementation; semantics must not weaken provenance or review requirements.

---

# Deliverable 1 — Trace Ingest Boundary

Create a server-side ingest boundary that:

1. Accepts only **signed** Synapse trace envelopes (format to be verified against existing Synapse receipt/trace exports — do not invent signatures).
2. Validates schema, required identifiers, and signature before persistence.
3. Rejects replayed or tampered envelopes with explicit error codes.
4. Never exposes Synapse bearer tokens, MCP paths, or raw filesystem paths in API responses.

If Synapse does not yet expose a stable signed export format, stop and document the blocking contract rather than inventing one.

---

# Deliverable 2 — Deterministic Deduplication

* Compute `ExperienceCandidateID` using the identity formula above.
* Ingest of an identical `ExperienceCandidateID` for the same owner must be idempotent or surfaced as a conflict, not create duplicate candidates silently.
* Deduplication must be deterministic across process restarts and repository recreation.
* Probe tests must verify recomputation of `ExperienceCandidateID` from stored trace inputs matches persisted candidate `id`.

---

# Deliverable 3 — Source Linkage

Every candidate and promoted lesson must retain:

* original `traceId`
* optional session/run identifiers when present
* ingest timestamp
* link to raw trace artifact storage location (owner-scoped, not exposed in UI beyond opaque ID)

Retraction or rejection must not orphan provenance; source linkage remains queryable for audit.

---

# Deliverable 4 — Review and Promotion

* Candidates enter as `DRAFT`.
* Operator UI lists pending candidates with summary, outcome, tags, and trace reference.
* Explicit actions: **Approve** (promote to lesson), **Reject**, **Dispute**, **Archive**.
* **Approve** creates an `ExperienceLesson` with `approvedBy: "operator"` unless a policy engine hook is explicitly configured.
* No background job may auto-approve.
* **Retract** marks a verified lesson `RETRACTED` without deleting the candidate or trace reference.

---

# Deliverable 5 — Persistence and API

Follow L-CALYX-100 conventions:

* local JSON under `<CALYX_HOME>/echo-mirage-domains/experience/<ownerId>/`
* atomic writes, per-owner locks
* owner isolation and traversal prevention
* API envelopes `{ ok, data } | { ok: false, error }`
* routes under `/api/calyx/experience/*` (exact list finalized during implementation)

Minimum routes:

* `POST /api/calyx/experience/ingest` — server-side ingest (not browser-direct to Synapse secrets)
* `GET /api/calyx/experience/candidates`
* `GET /api/calyx/experience/lessons`
* `POST /api/calyx/experience/candidates/[id]/approve`
* `POST /api/calyx/experience/candidates/[id]/reject`
* `POST /api/calyx/experience/lessons/[id]/retract`
* `GET /api/calyx/experience/status`

---

# Deliverable 6 — Operator UI

Add a Cyberdeck pane or route (e.g. `/cyberdeck/experience`) showing:

* ingest status and repository mode
* candidate queue (DRAFT / DISPUTED)
* lesson list (VERIFIED / RETRACTED)
* explicit approve / reject / retract controls
* no auto-promotion indicators or "AI learned this" language

Follow existing Cyberdeck visual language.

---

# Deliverable 7 — Tests

Add durable probe or unit/integration tests for:

* signed trace validation (valid, invalid signature, tampered payload)
* deterministic deduplication
* source linkage retention after reject and retract
* candidate review state transitions
* promotion only via explicit approve action
* rejection without deletion of trace reference
* owner isolation
* API envelope and path-leak prevention
* persistence after repository recreation
* unavailable external Calyx adapter behavior

Use temporary directories. Never write tests into the operator's real Calyx home or live Synapse session store.

---

# Acceptance Criteria

The work is complete only when:

* L-CALYX-100 remains unchanged in scope and behavior unless a verified shared-primitive extraction is required and documented.
* Signed trace validation rejects tampered and unsigned envelopes.
* No candidate or lesson is persisted without a verifiable source trace reference.
* Duplicate traces dedupe deterministically via `ExperienceCandidateID` per owner.
* Every candidate and lesson links back to its source trace reference.
* Candidates start as reviewable `DRAFT`; no autonomous promotion occurs.
* Rejection and retraction are supported without destroying provenance.
* Lessons become reusable knowledge only through explicit operator or policy approval.
* Local persistence survives restart.
* Operations are owner-scoped; traversal is prevented.
* Career domain is not required to import Experience domain code (and vice versa).
* Typecheck, lint, and probe/smoke gates pass per completion report.
* External Calyx experience adapter remains unavailable until verified MCP contracts exist.

---

# Stop Conditions

Stop and report when:

* Synapse does not expose a verifiable signed trace export — document required contract.
* Ingest would require inventing MCP tools not present in Synapse.
* Promotion logic cannot be kept strictly explicit (any auto-approve path discovered).
* Shared verification primitives would force a breaking change to L-CALYX-100 without ADR.

---

# Follow-Up Ledgers

Clean capability evolution — each ledger adds one responsibility without blurring Synapse (observation) and Calyx (governed knowledge):

```text
L-CALYX-100   Career records
        ↓
L-CALYX-110   Experience candidates
        ↓
L-CALYX-111   Search & retrieval
        ↓
L-CALYX-112   Policy promotion
        ↓
L-CALYX-113   Career cross-links
        ↓
L-CALYX-114   Live Synapse ingestion
```

Ledger summaries:

```text
L-CALYX-111 — Experience Search and Lesson Retrieval
L-CALYX-112 — Policy-Driven Experience Promotion
L-CALYX-113 — Career ↔ Experience Cross-Linking
L-CALYX-114 — Synapse Real-Time Ingest Stream
```

---

# Required Completion Report

Cursor must return the standard completion report block (Summary, Architecture, Cognosys recall, Files added/modified, API routes, Persistence, UI, Tests, Commands, Verification results, Known limitations, Deviations, Follow-up recommendations).

Do not claim completion unless verification commands were actually executed successfully.

Record the Synapse trace contract version used for signature validation.

Document explicitly if ingest remains pull/batch-only in v1.

---

# Predecessor

| Ledger | Status | Commit |
|--------|--------|--------|
| L-CALYX-100 Career Intelligence Foundation | Complete | `7d6468d` |
