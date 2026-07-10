# JP-L-CYBERDECK-001-P9.4 — Keyboard Routing (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P9.4 — Extract keyboard routing / gateway nav effects  
**Branch:** `cursor/extract-p9.4-cyberdeck-keyboard-nav`  
**Base:** `main` (P9.1–P9.3 via #63 + #66)

---

## Verdict

**PASS** — Tab/arrow/Escape routing, chat highlight scroll, rail focus, and deck keyboard SFX bootstrap moved to `use-cyberdeck-keyboard-nav.ts`; probes green.

---

## Metrics

| Metric | P9.3 (baseline) | P9.4 actual | Δ |
|--------|----------------:|------------:|--:|
| `cyberdeck-app.tsx` lines | 2,577 | **2,115** | **−462** |
| `cyberdeck-app.tsx` imports | 92 | **92** | **0** |

New module:

- `src/features/cyberdeck/keyboard/use-cyberdeck-keyboard-nav.ts`

---

## Checklist

| ID | Check | Result |
|----|-------|--------|
| V-P9.4-01 | Layout effect moves focus to rail when leaving gateway | PASS |
| V-P9.4-02 | focusin demotes rail → gateway when editable steals focus | PASS |
| V-P9.4-03 | Column-scoped keydown (Tab cycle, Escape, arrows, Enter) | PASS |
| V-P9.4-04 | Chat keyboard highlight index + scroll-into-view | PASS |
| V-P9.4-05 | Deck keyboard SFX unlock + bind on first interaction | PASS |
| V-P9.4-06 | `tsc` + probes + ratchet | PASS |

---

## Evidence

```text
cyberdeck-app.tsx: 2115 lines, 92 imports (was 2577 / 92)
tsc --noEmit exit 0
probe:cyberdeck-compile-scope PASS (ceilings 2150 / 92)
probe:muthur-command-console PASS
```

---

## Sign-off

- [x] Judicial PASS
- [ ] Merge to `main`
- [ ] **P9.5 HEAD** (glyph channel subsystem)
