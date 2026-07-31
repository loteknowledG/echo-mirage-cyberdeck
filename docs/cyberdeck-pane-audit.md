# Cyberdeck Pane Audit

**Date:** 2026-07-30  
**Scope:** Echo Mirage `/cyberdeck` surfaces — fixed server rail, MIRAGE custom tabs, and standalone routes.  
**Purpose:** Classify what is shipped vs demo vs abandoned, and recommend what to keep visible, hide, or retire.

---

## Tier definitions

| Tier | Meaning | Action |
|------|---------|--------|
| **P0 — Core** | Daily driver; product identity | Keep on rail or default tabs; maintain |
| **P1 — Niche** | Real feature, specific workflow | Keep in tab menu; document; don't default-open |
| **P2 — Demo** | UI shell, signal theater, or partial backend | Hide from default menu or mark DEMO; consolidate later |
| **P3 — Retire** | Superseded, stub-only, or unused | Stop adding tabs; migrate saved state; remove in pass |
| **P4 — Never built** | Documented intent only | Do not expose in UI until implemented |
| **Legacy** | m4trix-era routes; parallel to cyberdeck | Separate track; don't count as deck panes |

---

## Executive summary

Echo Mirage has **~3× the code volume of m4trix** largely because it accumulated **operator stations** — many panes are real UI with thin or missing runtime backing.

**Actually core (5):** Operator, MUTHUR (MAINNET-UPLINK), Glyph, Survey, Settings.

**Real but niche (8):** Career, DB8, Photoshop, Call Center, Pi, Registry/Kit, Diagnostics, Drop Bay (+ `/send` uplink).

**Demo / showroom (7):** Catalog, Operators, Cadre, Memory Atlas, Flight Log, Voice Lab, Tunes, Powerfist (rola-dex embed).

**Retire / alias (3):** `muthur-execution` → diagnostics; `catelog` typo; Card Table (flagged off).

**Never built (1):** Systems Console ([L-17](cadre/tech-lead-legislator/L-17-systems-console-placeholder-architecture.md)).

**Legacy parallel app:** removed — see `m4trix` for characters/stories/games.

---

## Fixed server rail (left column)

Default visible IDs: `m` (Operator), `s` (MUTHUR), `b` (Settings). Optional: `ct` (Card Table) when `NEXT_PUBLIC_ENABLE_CARD_TABLE=true`.

Full rail definition includes hidden/keyboard targets: `w` (Web), `c` (Connection), `h` (Diagnostic).

| Rail ID | Label | Tier | Lines (pane) | Backend / notes |
|---------|-------|------|--------------|-----------------|
| `m` | ØPERATOR | **P0** | ~1,741 | Monaco/doc viewer, convert pipeline, folder nav, MUTHUR observation source |
| `s` | μ MAINNET-UPLINK | **P0** | (chat column) | MUTHUR chat, tools, posture, provider uplink — primary AI surface |
| `b` | § SETTINGS | **P0** | ~184 | Identity, voice, SFX, deck prefs |
| `w` | WEB | **P1** | (in operator) | Operator browser mode / web tab kind — real Playwright or webview |
| `c` | CONNECTION | **P0** | (gateway UI) | Provider keys, model picker — not a separate pane body; gateway column |
| `h` | π DIAGNOSTIC | **P1** | ~178 | Memory context preview, heap count, voice health — dev/ops |
| `ct` | ◈ CARD TABLE | **P3** | — | Feature-flagged off; unclear product owner |

**Recommendation:** Keep `m` / `s` / `b` only on default rail. Leave `w`/`c`/`h` as keyboard/context-menu targets. Remove Card Table from rail until it has a spec.

---

## MIRAGE custom tabs (`CustomTabKind`)

Added via tab-rail context menu or `/tab` commands. Renderer: `custom-tab-pane-renderer.tsx`. Registry: `pane-registry.ts`.

| Tab kind | Label | Tier | UI lines | Persistence / API | Verdict |
|----------|-------|------|----------|-------------------|---------|
| `document` | Document | **P0** | (operator) | Same as Operator rail | Alias surface — keep |
| `glyph-channel` | ⟁ GLYPH | **P0** | ~942 | `/api/glyph/render`, MUTHUR apply | Core ASCII/figlet channel |
| `survey` | Survey | **P0** | ~81 shell / **~11k** survey tree | Pairing, Echo Probe/Satellite, extension bridge | Active (PR #84+); largest subsystem after operator |
| `settings` | Settings | **P0** | ~184 | localStorage / identity | Duplicate of rail `b` — OK |
| `diagnostics` | Diagnostic | **P1** | ~178 | Memory, flight log hooks | Useful for ops |
| `pi` | Pi | **P1** | ~431 | `/api/pi-chat`, pi-agent-core | Separate agent; real |
| `career` | Career | **P1** | ~952 | Calyx career domain, `/api/calyx/career/*` | Real portfolio CRUD |
| `db8` | DB8 | **P1** | ~690 | Local debate state, voice queue | Debate chamber — real UX |
| `photoshop` | Photoshop | **P1** | ~745 | GIF text API, canvas | Niche creative tool |
| `call-center` | Call Center | **P1** | ~92 shell | Property-mgmt sim + case board | Domain demo with real panels |
| `drop-bay` | Drop Bay | **P1** | ~102 | `/api/drop`, JSONL feed, SSE | Pairs with `/send` mobile uplink |
| `realmorphism-kit` / `web` (kit) | Registry / Kit | **P1** | (registry) | Live figlet + component showroom | Also at `/registry` |
| `web` | Web | **P1** | — | Embedded webview tab | Generic browser tab |
| `memory-atlas` | Memory Atlas | **P2** | ~221 | Atlas entity API | Browse tiles; limited ops |
| `cadre` | Cadre | **P2** | ~238 | Cadre runtime registry, event bus | Workforce UI; [L-CADRE-002](work-orders/L-CADRE-002-codex-runtime-adapter.md) — Codex still stub |
| `catalog` | Catalog | **P2** | ~85 | Static images + `emitSignal` | Showroom only — no configure backend |
| `operators` | Operators | **P2** | ~96 | `useOperators()` synthetic crew | Status theater, not live fleet |
| `flight-log` | Flight Log | **P2** | ~149 | Local log + signal router | Observability readout |
| `voice-lab` | Voice Lab | **P2** | ~216 | TTS presets | Voice tuning sandbox |
| `tunes` | Tunes | **P2** | ~269 | Playlist embed | Music panel |
| `rola-dex` | Powerfist / Rola-Dex | **P2** | ~10 | Embeds `/preview` matrix | Thin wrapper |
| `connection` | Connection | **P0** | (gateway) | Provider panel | Tab kind exists; same as rail `c` |
| `blank` | Blank | — | — | — | Intentional empty state |
| `catelog` | (typo) | **P3** | → catalog | Alias | Fix typo in saved state only |

**Retired kinds (migrate on load):**

| Legacy kind | Maps to | Doc |
|-------------|---------|-----|
| `muthur-execution`, `execution`, `execution-pane` | `diagnostics` | [L-17](cadre/tech-lead-legislator/L-17-systems-console-placeholder-architecture.md) |
| `install`, `desktop-install`, `spy`, `espionage` | `survey` | Survey consolidation |
| `test-pane` | `rola-dex` | Legacy rename |

---

## P4 — Never built

| Surface | Status | Reference |
|---------|--------|-----------|
| **Systems Console** | PLACEHOLDER ONLY — no pane kind | [L-17-systems-console-placeholder-architecture.md](cadre/tech-lead-legislator/L-17-systems-console-placeholder-architecture.md) |
| **MUTHUR Execution cockpit** | Retired; aliased to diagnostics | Same L-17 migration note |

Do not add a Systems Console tab until posture/capability contract is defined.

---

## Standalone routes (not custom tabs)

| Route | Tier | Notes |
|-------|------|-------|
| `/cyberdeck` | **P0** | Main deck shell |
| `/registry` | **P1** | Public registry showroom |
| `/property-manager` | **P1** | Full property workspace (separate from call-center tab) |
| `/property-manager/call-sim` | **P2** | After-hours voice demo |
| `/editor-00` | **Legacy** | Lexical editor — shared with m4trix lineage |
| `/send` | **P1** | Drop Bay mobile uplink |
| `/preview` | **P2** | Powerfist / preview matrix (embedded by rola-dex) |
| `/powerfist/capture-pair` | **P1** | Survey capture deck (blank native surface) |
| `/skunkworx` | **Legacy** | Vercel AI chatbot demo shell |

---

**Removed 2026-07-30:** Legacy `(site)/` m4trix routes (`/characters`, `/stories`, `/games`, etc.) were deleted from Echo Mirage. Use the m4trix repo for that product surface.

| Route | Former tier | Notes |
|-------|-------------|-------|
| `/cyberdeck/career` | **P1** | Standalone career page (duplicate entry vs tab) |

---

## Code size signal (pane-body TSX only)

| Pane | Lines | Tier |
|------|-------|------|
| operator-pane-body | 1,741 | P0 |
| glyph-channel-pane-body | 942 | P0 |
| career-pane-body | 952 | P1 |
| photoshop-pane-body | 745 | P1 |
| db8-pane-body | 690 | P1 |
| pi-chat-pane-body | 431 | P1 |
| tunes-pane-body | 269 | P2 |
| cadre-pane-body | 238 | P2 |
| memory-atlas-pane-body | 221 | P2 |
| voice-lab-pane-body | 216 | P2 |
| settings-pane-body | 184 | P0 |
| diagnostic-pane-body | 178 | P1 |
| flight-log-pane-body | 149 | P2 |
| heap-pane-body | 123 | Legacy |
| drop-bay-pane-body | 102 | P1 |
| operators-pane-body | 96 | P2 |
| call-center-pane-body | 92 | P1 |
| catalog-pane-body | 85 | P2 |
| survey-pane-body | 81 | P0 (shell; survey tree ~11k) |
| rola-dex-pane-body | 10 | P2 |

Large line count ≠ product priority. Survey and Operator dominate real complexity.

---

## Recommended actions

### Immediate (visibility)

1. **Split context menu** into `Core`, `Tools`, `Demo`, `Legacy` sections in `CUSTOM_TAB_CONTEXT_MENU_ACTIONS` (`custom-tab-model.ts`).
2. **Default hidden from menu (P2):** Catalog, Operators, Cadre, Memory Atlas, Flight Log, Voice Lab, Tunes, Rola-Dex — still reachable via `/tab` or search if needed.
3. **Mark DEMO in subtitle** for P2 panes (pane header or registry label suffix).

### Short term (consolidation)

4. **Merge Flight Log + Diagnostics** — both read signals/logs; one ops pane.
5. **Catalog → Registry** — catalog is static marketing cards; fold into registry or remove.
6. **Operators → Cadre** — both synthetic workforce views; one station.
7. **Document Survey as P0** — it is the second-largest subsystem; don't treat the 81-line shell as "small."

### Medium term (retirement)

8. **Systems Console** — implement under new pane kind or drop L-17 doc.
9. **Card Table** — enable flag or delete `ENABLE_CARD_TABLE` path.
10. ~~**Legacy `(site)/`**~~ — removed; RPG/content studio lives in `m4trix`.
11. **`catelog` typo kind** — migration already exists; stop emitting from UI.

### Do not retire (despite looking quiet)

- **Glyph** — MUTHUR ASCII art depends on it (PR #85).
- **Survey** — Echo Probe parity actively maintained.
- **Operator** — MUTHUR observation, docs, manifesto viewing.
- **Connection/gateway** — provider auth; not abandoned, just not a pane body.

---

## Registry cross-reference

| File | Role |
|------|------|
| `src/features/cyberdeck/pane-registry.ts` | Pane kinds + load hints |
| `src/features/cyberdeck/workspace/custom-tab-model.ts` | Tab kinds + context menu |
| `src/features/cyberdeck/workspace/server-rail-config.ts` | Fixed rail IDs |
| `src/features/cyberdeck/pane-chunks.ts` | Lazy imports + prefetch list |
| `src/features/cyberdeck/workspace/custom-tab-pane-renderer.tsx` | Tab → component routing |

**Prefetch today:** `glyph-channel`, `operator`, `rola-dex` — consider swapping `rola-dex` for `survey` on warm path.

---

## Audit checklist (for PRs touching panes)

- [ ] New pane kind added to `CYBERDECK_PANE_KINDS` **and** tier listed in this doc
- [ ] P2 demo panes not added to default context menu without `DEMO` label
- [ ] Retired kinds get alias in `pane-registry.ts` / `custom-tab-model.ts`
- [ ] Standalone route duplicated in tab? Document both entry points
- [ ] API routes exist for claims the pane makes (avoid Catalog-style signal-only)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-30 | Initial audit — tiers, rail, custom tabs, routes, recommendations |
