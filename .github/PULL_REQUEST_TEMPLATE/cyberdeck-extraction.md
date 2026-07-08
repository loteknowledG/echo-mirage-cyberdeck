---
name: L-CYBERDECK-001 extraction
about: PR Queue slice — cyberdeck-app extraction program
title: "refactor: "
---

## L-CYBERDECK-001 — Extraction PR

| Field | Value |
|-------|-------|
| **Slice** | P?.? |
| **Queue position** | HEAD / queued |
| **Work order** | [L-CYBERDECK-001](docs/work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) |
| **Conductor** | [L-CYBERDECK-001-CONDUCTOR](docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md) |
| **Verify brief** | `docs/verifications/VERIFY-L-CYBERDECK-001-P?.?.md` |
| **Judicial receipt** | `docs/verifications/JP-L-CYBERDECK-001-P?.?.md` |

### Baseline (branch from `main`)

| Metric | Before slice | After slice | Ceiling |
|--------|-------------:|------------:|--------:|
| `cyberdeck-app.tsx` lines | | | |
| Import lines | | | |

### Deliverables

- [ ] _new module path_
- [ ] `cyberdeck-app.tsx` delegates (no duplicate logic)

### Out of scope (FAIL if touched)

- _list slices / files that must NOT change_

---

## Summary

_What moved and why. One paragraph._

---

## Developer checklist

- [ ] Branched from **fresh `main`** (not off previous extraction branch)
- [ ] `pnpm exec tsc --noEmit` — exit 0
- [ ] `pnpm probe:cyberdeck-compile-scope` — exit 0
- [ ] Phase probes (if P2+): `pnpm probe:muthur-command-console`, `pnpm probe:muthur-response-visibility`
- [ ] Probe ceiling lowered only if lines actually dropped
- [ ] `git diff main...HEAD --stat` — scope matches slice only

---

## Tester / judicial checklist

- [ ] Independent verify per VERIFY brief (all check IDs)
- [ ] `JP-L-CYBERDECK-001-P?.?.md` written with PASS/FAIL + evidence
- [ ] Manual smoke (P2+): `muthur help`, reload persistence, clear chat

---

## Merge gate (human / tech lead)

- [ ] Judicial **PASS**
- [ ] This is the **only open extraction PR** (queue invariant through P2)
- [ ] Merge = **pop queue** → update CONDUCTOR → next slice branches from new `main`

---

## FAIL rework

If judicial FAIL: push fixes to **this branch**; queue does not advance. Reference check ID + log in PR comment.
