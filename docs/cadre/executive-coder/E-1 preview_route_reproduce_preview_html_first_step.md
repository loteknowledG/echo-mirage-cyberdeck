# EXEC-BUILD DIRECTIVE: REPRODUCE POWERFIST PREVIEW.HTML IN /preview

## OBJECTIVE
Make the Next.js `/preview` route reproduce the existing `public/preview.html` PowerFist screen as closely as possible.

This is a first-step reproduction task only.

Do not add new interaction modes yet.
Do not redesign the screen.
Do not invent a new visual language.

The goal is:

`/preview` should look and feel like `preview.html`.

---

## CANONICAL REFERENCE

Use this file as the design authority:

`public/preview.html`

Deployed reference when available:

`https://echo-mirage-cyberdeck.vercel.app/preview.html`

The current `/preview` route is not acceptable if it looks like a generic centered React dashboard/card.

---

## TARGET FILE

Primary implementation target:

`src/app/preview/page.tsx`

You may create supporting local components/styles if needed, but keep the scope minimal.

---

## STRICT DESIGN REQUIREMENTS

Reproduce the existing PowerFist look:

- dark CRT/cyberdeck background
- green terminal glow
- tactical console framing
- PowerFist Matrix identity
- card carousel/deck feel
- visible cropped side cards
- focused center card
- control buttons consistent with prototype
- compact operational monitor vibe

Do not replace with:

- generic SaaS dashboard UI
- centered marketing card
- unrelated Tailwind demo layout
- soft rounded corporate app style
- new design system

---

## IMPORTANT LAYOUT REQUIREMENT

The current `preview.html` composition where side cards are partially visible and cropped offscreen is good.

Preserve that feel.

The side cards should imply deck continuity and neighboring context.

Do not fully hide side cards in normal desktop width.
Do not make all cards fully visible if that destroys the cropped carousel feeling.

Center card = operational focus.
Side cards = peripheral previews/context echoes.

---

## FIRST STEP ONLY

For this task, only reproduce the current prototype in `/preview`.

Do NOT implement yet:

- compact mode
- closed mode
- fullscreen mode
- cross-pad navigation
- joystick navigation
- diagonal movement
- real markdown file loading
- Electrobun integration
- watcher integration

Those come after the visual reproduction is correct.

---

## ACCEPTABLE IMPLEMENTATION APPROACH

Because this is reproduction-first, it is acceptable to:

- port the HTML/CSS structure from `public/preview.html` into React
- preserve class names/visual structure where practical
- use static/mock card data
- use inline styles or CSS module/local CSS if simplest
- avoid over-abstracting components

Prefer faithful reproduction over clever refactoring.

---

## MINIMUM BEHAVIOR

The `/preview` route should render:

- PowerFist title/header area
- active deck/card area
- focused center card
- partially cropped side cards
- existing-style action/control buttons
- standby/readout/status text if present in prototype

Buttons do not need full final behavior yet.

If interaction is simple to preserve from prototype, preserve it.
Otherwise keep it visually present and mark TODO in code comments.

---

## PRESERVE ORIGINAL

Do not modify:

`public/preview.html`

That file is the prototype/reference artifact.

The productionized reproduction belongs in:

`src/app/preview/page.tsx`

---

## SUCCESS CONDITIONS

1. `/preview` closely resembles `preview.html` visually.
2. `public/preview.html` remains untouched.
3. Center card is dominant.
4. Side cards remain visible as cropped/peripheral previews.
5. The screen no longer looks like a generic centered React card.
6. No advanced modes are added yet.
7. Build passes.

---

## VALIDATION

Run:

`pnpm exec tsc --noEmit`

`pnpm build`

Also manually inspect:

`http://localhost:3000/preview`

or the local dev port in use.

Compare it against:

`public/preview.html`

---

## COMPLETION REPORT REQUIREMENT

When complete, create a markdown handoff artifact at:

`docs/cadre/exec-build/outbox/<timestamp>-preview-route-reproduction-completion.md`

The report must include:

- files changed
- whether `public/preview.html` was untouched
- summary of reproduction approach
- validation commands/results
- notes on visual fidelity
- risks/TODOs for future modes

Do not only respond in chat.

The saved markdown artifact is the official handoff.

