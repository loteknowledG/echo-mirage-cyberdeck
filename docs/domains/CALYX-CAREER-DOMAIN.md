# Calyx Career Domain

## Purpose

Career Intelligence is Echo Mirage’s first Calyx domain module. It maintains a structured, evidence-backed career portfolio for the local operator.

## Boundaries

```text
Career UI (/cyberdeck/career, Cyberdeck pane)
    ↓
Career API (/api/calyx/career/*)
    ↓
Career Service (validation, IDs, verification policy)
    ↓
Career Repository (local JSON or future Calyx adapter)
    ↓
Calyx Infrastructure / Local Persistence
```

Core Calyx files under `src/lib/calyx/` do not import this domain.

## Persistence

Local mode stores data under:

```text
<CALYX_HOME>/echo-mirage-domains/career/<ownerId>/
```

Storage mode is selected with `CALYX_CAREER_STORAGE=local|calyx` (default: `local`).

## Trust model

- All created career records begin as `DRAFT`.
- Only explicit operator verification may set `VERIFIED`.
- Metrics and accomplishment statements are user-supplied plain text; the system does not invent facts or metrics.

## Operator surfaces

- Cyberdeck pane kind: `career`
- Standalone route: `/cyberdeck/career`
- Status endpoint: `GET /api/calyx/career/status`

## Verification

```bash
pnpm probe:calyx-career
pnpm probe:calyx-smoke
```

## Follow-up ledgers

See `docs/ledgers/L-CALYX-100-career-intelligence-foundation.md` for L-CALYX-101 through L-CALYX-108.
