# CALYX Experience Domain (L-CALYX-110)

## Slice 1 — ingest → verify → candidate

* experience domain models
* signed trace envelope verification (HMAC at Calyx ingest boundary)
* deterministic `ExperienceCandidateID`
* local persistence of reviewable `DRAFT` candidates
* trace artifact retention for provenance

## Slice 2 — replay safety

Explicit ingest replay outcomes:

| Condition | Outcome |
|---|---|
| same identity + same content | `existing` |
| same identity + changed content | `conflict` |
| same traceId + mutation, no matching candidate | rejected (`TRACE_ARTIFACT_MUTATION`) |
| new valid identity | `created` |

Rules:

* trace artifacts under `traces/{traceId}.json` are immutable
* conflicting replays never overwrite candidates or trace artifacts
* conflict records are persisted in `conflicts.json` with incoming envelopes in `conflict-incoming/{conflictId}.json`

Deferred to later slices: lesson promotion, review UI, Career cross-links, live Synapse streaming.

## Slice 3 — review workflow

Explicit review transitions (no lesson promotion):

| From | Allowed actions |
|---|---|
| `DRAFT` | reject → `REJECTED`, dispute → `DISPUTED`, archive → `ARCHIVED` |
| `DISPUTED` | reject → `REJECTED`, archive → `ARCHIVED` |
| `REJECTED`, `ARCHIVED`, `VERIFIED` | none |

Rules:

* append-only `review-audit.json` (actor, timestamp, reason, previous/next status)
* invalid transitions return `INVALID_REVIEW_TRANSITION` (409)
* idempotent review via optional `reviewCommandId` or already-at-target status
* signed trace artifacts remain immutable; open ingest conflicts stay `OPEN`

## Core invariant

> **No experience record may exist without a verifiable source trace.**

Candidates are created only from envelopes that pass contract validation and HMAC verification. Raw envelopes are stored under `traces/{traceId}.json` per owner.

## Trace contract

Contract version: `synapse-trace-envelope/v1`

Synapse MCP does **not** yet emit native cryptographic signatures. Slice 1 uses an **ingest HMAC boundary**:

* Envelope fields are canonicalized to JSON (excluding `signature`)
* `signature = HMAC-SHA256(CALYX_EXPERIENCE_INGEST_HMAC_SECRET, canonical_payload)` hex-encoded
* Verification uses timing-safe comparison

When Synapse exposes native signed exports (L-CALYX-114), the contract version can advance without breaking stored trace references.

## Experience candidate identity

```text
ExperienceCandidateID =
  SHA-256(
    signed_trace_id +
    "\n" +
    action_hash +
    "\n" +
    actor +
    "\n" +
    policy_version +
    "\n" +
    observation_window
  )
```

`action_hash = SHA-256(canonical JSON of action.tool, action.target, sorted action.parameters)`.

Persisted candidate `id` and `dedupeKey` both equal `ExperienceCandidateID`.

## Persistence layout

```text
<CALYX_HOME>/echo-mirage-domains/experience/<ownerId>/
  candidates.json
  conflicts.json
  review-audit.json
  traces/<traceId>.json
  conflict-incoming/<conflictId>.json
```

## API

* `POST /api/calyx/experience/ingest` — returns `{ outcome, candidate, conflict? }`
* `GET /api/calyx/experience/candidates`
* `GET /api/calyx/experience/conflicts`
* `GET /api/calyx/experience/status`
* `POST /api/calyx/experience/candidates/[id]/review` — returns `{ outcome, candidate, auditEntry }`
* `GET /api/calyx/experience/candidates/[id]/audit` — returns `{ audit }`

## Configuration

* `CALYX_EXPERIENCE_STORAGE=local|calyx` (default `local`)
* `CALYX_EXPERIENCE_INGEST_HMAC_SECRET` — required for ingest; not exposed via API

## Verification

```bash
pnpm probe:calyx-experience
```
