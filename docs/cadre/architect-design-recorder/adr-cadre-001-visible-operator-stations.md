# ADR-CADRE-001 -- Cadre Runtimes Are Hosted As Visible Operator Stations

## Status

Accepted

## Date

2026-06-15

## Related Work

* L-CADRE-001 -- Terminal Host Framework
* JP-L-CADRE-001 -- Live UI Terminal Host Verification
* L-MEM-005 -- Memory Atlas Retrieval Pipeline
* L-MEM-006 -- Entity & Relationship Atlas
* ADR-MEM-001 -- Deterministic Memory Atlas Routing Before Provider Uplink
* ADR-MEM-002 -- Project Continuity Graph

---

## Context

Echo Mirage needs local, inspectable stations for multiple AI runtimes.

The first Cadre host phase is observation-only. It must let the operator see runtime slots, start and stop local host processes, observe terminal output, and confirm state without asking a provider to reason about runtime status.

The initial visible stations are:

```text
CODEX
CURSOR
OPENCODE
PI
```

MUTHUR remains the always-online orchestrator station in the pane.

---

## Decision

Cadre runtimes shall be hosted as visible operator stations in Cyberdeck.

The Cadre pane is the operator-facing control surface. It retrieves runtime registry state from:

```text
GET /api/cadre/runtimes
```

starts local runtime hosts through:

```text
POST /api/cadre/start
```

stops local runtime hosts through:

```text
POST /api/cadre/stop
```

and receives terminal output through:

```text
GET /api/cadre/stream
```

These controls are local infrastructure and do not require provider uplink.

---

## Rationale

Runtime state should be visible before runtime intelligence is delegated.

The operator needs to see:

* which stations exist
* which station is running
* process identity
* terminal output
* lifecycle transitions

This makes future Cadre integration auditable. Later runtime integrations can replace the current host stub, but the station contract remains stable.

---

## Consequences

### Positive

* Cadre station state is visible in the live Cyberdeck UI
* runtime lifecycle is local and provider-independent
* terminal output gives an inspectable operator trace
* registry state persists across Cadre pane refresh
* future integrations have a stable host surface

### Negative

* local process lifecycle now needs cleanup discipline
* long-running runtimes must be bounded by stop and restart controls
* future real integrations must preserve the same visible station contract

---

## Verification

Verified by:

```text
JP-L-CADRE-001
```

Acceptance evidence:

```text
CADRE HOST READY
CODEX RUNNING
[CODEX] CADRE HOST STUB ONLINE
[CODEX] heartbeat
CODEX STOPPED
```

The live UI used:

```text
GET /api/cadre/runtimes
GET /api/cadre/stream
POST /api/cadre/start
POST /api/cadre/stop
```

and did not require:

```text
POST /api/cyberdeck-chat
```

Provider independence was verified with an invalid OpenRouter key. Cadre host state and terminal output remained available.

---

## Doctrine

Cadre runtimes are stations before they are delegates.

A station must be visible, local, startable, stoppable, and inspectable before it can be trusted as part of the wider project cognition loop.
