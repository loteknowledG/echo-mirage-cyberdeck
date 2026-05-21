# Preview Route Reproduction — Completion Handoff

**Date:** 2026-05-20  
**Directive:** EXEC-BUILD — reproduce `public/preview.html` at `/preview`  
**Status:** Complete

---

## Files changed

| File | Action |
|------|--------|
| `src/app/preview/page.tsx` | Replaced generic centered placeholder with `PreviewMatrix` |
| `src/app/preview/preview-matrix.tsx` | New client component — Embla deck/card carousel + controls |
| `src/app/preview/preview-matrix.css` | Ported prototype CSS (scoped under `.powerfist-preview-root`) |
| `src/app/preview/preview-data.ts` | Static deck/card data mirrored from `preview.html` |
| `src/app/preview/layout.tsx` | Minimal full-viewport layout wrapper |

## Reference artifact

| File | Status |
|------|--------|
| `public/preview.html` | **Untouched** (canonical prototype preserved) |

---

## Reproduction approach

1. Copied visual structure and class names from `public/preview.html` into React markup.
2. Scoped CSS from the prototype into `preview-matrix.css` (no global `body` rules; root uses `.powerfist-preview-root`).
3. Reused `embla-carousel` (already in repo) with the same options as the prototype:
   - Vertical deck axis (`y`, loop, center)
   - Horizontal hand axis (`x`, loop, center, dragFree)
4. Preserved card slide sizing (`flex: 0 0 42%`) and selected/unselected transforms (scale, opacity, grayscale blur on side cards).
5. Kept prototype interactions: deck/card buttons, keyboard arrows, Enter to play, per-card Play buttons, stack log readout.
6. Static mock data only — no markdown loading, Electrobun, watchers, or new modes.

---

## Validation

| Command | Result |
|---------|--------|
| `pnpm exec tsc --noEmit` | Pass locally after `pnpm build` (note: mixed `.next/dev` vs `.next` route types if `next dev` was run; production build regenerates `.next/types`) |
| `pnpm build` | **Pass** — `/preview` listed as static route |

**Manual inspect (local):**

- Dev URL: `http://127.0.0.1:3050/preview` (project uses port **3050**, not 3000)
- Compare against: `public/preview.html` or `http://127.0.0.1:3050/preview.html`

---

## Visual fidelity notes

- **Matched:** CRT green palette, status bar, matrix frame, deck headers/badges, card typography, risk chips, Play buttons, control row, stack log, cropped side cards at 42% slide width, centered focus scaling.
- **Expected differences:** Root layout still wraps in Next `ThemeProvider` / `app-min-width-wrapper` (Geist font may apply outside scoped monospace root); no CDN script tag — Embla via npm import.
- **Preserved carousel feel:** Side cards remain partially visible, scaled down, and desaturated; center card is dominant.

---

## Out of scope (deferred)

- Compact / closed / fullscreen modes
- Cross-pad / joystick / diagonal navigation
- Real markdown file loading
- Electrobun integration
- Watcher integration
- New design system or SaaS-style dashboard layout

---

## Risks / TODOs

1. **Hand carousel init:** Uses `useLayoutEffect` after ref assignment; if decks are ever dynamic, re-init logic will be needed.
2. **Stack log:** Uses `dangerouslySetInnerHTML` to match prototype emphasis tags — acceptable for static strings only.
3. **App shell bleed:** Parent `bg-background` may show at edges on very wide viewports; optional future `preview` layout override for full bleed.
4. **next-env.d.ts:** Local `tsc` can conflict when both `.next/dev/types` and `.next/types` exist; production/Vercel build uses post-build `.next/types`.

---

## Operator check

1. `pnpm dev`
2. Open `http://127.0.0.1:3050/preview`
3. Confirm it reads as PowerFist Matrix (not centered “STANDBY” card)
4. Arrow keys and Deck/Card buttons move focus; Enter / Play updates stack log
