# L-MEM-006 — Entity & Relationship Atlas

**Status:** Proposed  
**Owner:** MUTHUR / Cadre  
**Era:** Memory  
**Priority:** P1 Continuity

## Summary

Transform project memory into a navigable continuity graph. MUTHUR answers relationship-oriented questions across work orders, verifications, ADRs, foundations, subsystems, and providers without treating artifacts as isolated records.

## Keywords

entity atlas, continuity graph, relationships, work orders, verifications, ADR, subsystem, provider

## Depends on

L-MEM-005 — Memory Atlas Retrieval Pipeline

## ADR

ADR-MEM-001 — Deterministic routing before provider uplink (extended for entity graph)

## Verification

JP-L-MEM-006 (pending)

## API

`POST /api/muthur/entity-query`

## Modules

- `src/lib/entity-atlas/entity-atlas-query.ts`
- `src/lib/entity-atlas/entity-atlas-index.ts`
- `src/lib/entity-atlas/entity-atlas-retrieval.server.ts`
- `src/lib/entity-atlas/entity-atlas-types.ts`
