# ER-1.1 — Preview Route Reproduction Evidence

**Work order:** `E-1` (implementation thread)  
**Legislator directive:** `L-1` first step / EXEC-BUILD reproduce `public/preview.html` in `/preview`  
**Role:** Judge-Tester evidence packet  
**Cycle:** `ER-1.1` (initial evidence submission)  
**Date:** 2026-05-21  
**Submitter:** exec-build / operator handoff

---

## Evidence summary

| Claim | Status | Notes |
|-------|--------|-------|
| `/preview` reproduces PowerFist Matrix from `preview.html` | **READY FOR MANUAL VERIFY** | React port + Embla carousels |
| `public/preview.html` untouched | **PASS** | No pending diff on reference file |
| Center card dominant; side cards cropped | **READY FOR MANUAL VERIFY** | `flex: 0 0 42%` + scale/opacity on non-selected |
| No advanced modes (compact/fullscreen/etc.) | **PASS** | Out of scope per directive |
| Build / TypeScript | **PASS** | See automated evidence below |

---

## Constitutional linkage

| Artifact | Path |
|----------|------|
| Canonical prototype | `public/preview.html` |
| Implementation | `src/app/preview/page.tsx`, `preview-matrix.tsx`, `preview-matrix.css`, `preview-data.ts`, `layout.tsx` |
| Exec completion handoff | `docs/cadre/exec-build/outbox/2026-05-20-preview-route-reproduction-completion.md` |
| Misfiled directive copy (ignore for review) | `docs/cadre/judge-tester/E-1 preview_route_reproduce_preview_html_first_step.md` |

**Not in scope for E-1 / ER-1.1:** `L-1` three-mode viewport (`compact` / `desktop` / `fullscreen`) in `docs/cadre/executive-coder/L-1 — Preview Matrix Mode System Directive.md` — separate future work order.

---

## Automated validation evidence

**Environment:** `F:\dev\echo-mirage-cyberdeck`  
**Recorded:** 2026-05-21

```text
> pnpm exec tsc --noEmit
(exit 0)

> pnpm build
(exit 0) — route /preview listed as static ○
```

**Dependency note (Vercel):** `embla-carousel` direct dependency required for build; see commits `6677c2b` / `d920274` if CI failed earlier on `roll-a-deck.tsx`.

---

## Reference integrity

```text
git status public/preview.html
→ (clean / no modifications in working tree)

Implementation files under src/app/preview/
→ page.tsx, preview-matrix.tsx, preview-matrix.css, preview-data.ts, layout.tsx
```

Prototype must remain the design authority; production reproduction lives only under `src/app/preview/`.

---

## Judge-Tester manual checklist

Run `pnpm dev`, then compare **A** vs **B** side by side.

| ID | Check | Pass criteria |
|----|-------|----------------|
| M-1 | URL | `http://127.0.0.1:3050/preview` loads (port **3050**, not 3000) |
| M-2 | Identity | Status line shows `POWERFIST MATRIX //` with active deck + card names |
| M-3 | Not generic UI | Screen is **not** a single centered “STANDBY” / marketing card |
| M-4 | Matrix frame | Dark green CRT panel (~520px height), rounded matrix border |
| M-5 | Deck carousel | Deck ↑/↓ or Arrow Up/Down changes deck; header title/badge update |
| M-6 | Card carousel | Card ←/→ or Arrow Left/Right moves focus; center card scales up |
| M-7 | Cropped sides | Adjacent cards visible but scaled down (~0.82), dimmed, partially off-axis |
| M-8 | Card content | Type, title, purpose, risk chip, Play button on each card |
| M-9 | Play focused | “Play Focused Card” / Enter updates stack log with played card + deck |
| M-10 | Per-card Play | Card Play button scrolls focus and updates stack log |
| M-11 | Prototype parity | Open `http://127.0.0.1:3050/preview.html` — layout/behavior substantially matches |
| M-12 | Scope guard | No compact/closed/fullscreen toggles; no markdown file loader |

**Record result:** PASS only if M-1 through M-11 pass; M-12 is informational (expected absence).

---

## Success conditions traceability

| Directive success condition | Verification |
|---------------------------|--------------|
| 1. `/preview` resembles `preview.html` | M-2, M-4, M-11 |
| 2. `public/preview.html` untouched | Reference integrity section |
| 3. Center card dominant | M-6, M-7 |
| 4. Side cards cropped/peripheral | M-7 |
| 5. No generic centered React card | M-3 |
| 6. No advanced modes yet | M-12 |
| 7. Build passes | Automated validation |

---

## Known acceptable deltas

1. **Font:** Next root may apply Geist outside `.powerfist-preview-root`; monospace is set on preview root.
2. **Embla source:** npm `embla-carousel` vs CDN script in `preview.html` — behavior should match.
3. **App shell:** `ThemeProvider` / `app-min-width-wrapper` may show neutral background at extreme widths.

These are not automatic FAIL unless they break M-3, M-4, or M-7.

---

## Fail conditions (auto FAIL)

- `/preview` still shows old “POWERFIST PREVIEW / STANDBY” placeholder only
- Side cards fully hidden at desktop width (no deck continuity)
- `public/preview.html` modified as part of this work order
- `pnpm build` fails on clean install
- Compact/fullscreen/mode switch shipped under E-1 scope

---

## Tester sign-off block

```text
Reviewer: ____________________
Cycle: ER-1.1
Date: ____________________
Result: [ ] PASS  [ ] REWORK → JR-1.1
Notes:
```

---

## Next cycle

If REWORK: implement fixes, submit **ER-1.2** with delta notes.  
If PASS: judicial pass artifact **JP-1.1** (or next JP per cadre convention).
