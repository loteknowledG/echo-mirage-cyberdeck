# ADR-CALYX-001 — Calyx Knowledge Infrastructure

## Status

Accepted

## Context

Echo Mirage Cyberdeck integrates Calyx as local knowledge infrastructure: vault configuration, MCP client discovery, readiness probing, and ingest/search tooling. Domain-specific product features must not collapse into this core layer.

## Decision

1. **Calyx core remains domain-independent.** Files under `src/lib/calyx/` provide shared infrastructure only.
2. **Career Intelligence is the first domain module** implemented on Calyx, isolated under `src/lib/calyx/domains/career/`.
3. **Dependency direction is one-way.** Career may depend on Calyx core; Calyx core must never import Career code.
4. **Local JSON persistence is an adapter**, not the final domain architecture. It enables offline operator workflows while external Calyx persistence contracts are verified separately.
5. **External Calyx MCP integration for domain persistence must use verified capabilities only.** Unverified tool contracts must not be invented or silently assumed.
6. **Evidence and explicit verification are foundational trust requirements.** Records start as `DRAFT` and require explicit operator action to become `VERIFIED`.

## Consequences

- New Calyx-backed domains should follow the Career pattern: types, validation, repository contract, local adapter, service, API, operator UI, probes.
- Resume generation, document extraction, ATS scoring, and AI-generated career facts remain out of scope for the foundation ledger (L-CALYX-100).
