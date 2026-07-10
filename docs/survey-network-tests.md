# Survey network tests — Phase 0 / Phase 1

Resume checklist for **echo-extension** tab-text capture. Not unit tests — operator paths across browsers and Echo Satellite.

**Branch (in progress):** `cursor/phase-1-ext-capture-active`  
**Extension version:** `0.2.1`  
**Last updated:** 2026-07-10

---

## Players

| ID | Runtime | Job |
|----|---------|-----|
| **echo-extension** | Chrome MV3 (`apps/echo-mirage-survey-extension`) | Capture tab text in the **capture** Chrome profile |
| **Echo Satellite** | Electron tray (`apps/echo-satellite-electron`, aka echo-electron) | Local HTTP server `:3050` + extension bridge |
| **mirage-browser** | Cyberdeck in Zen / Chrome / etc. | Survey UI + ingest / MUTHUR |
| **mirage-electron** | Desktop shell | Same Survey UI — Phase 1 path works here too |

**Not required for Phase 0/1:** PowerFist, Tauri satellite, title+#n picker (Phase 1.1).

---

## Phase 0 — same Chrome profile only

**Path:** extension popup → Chrome Mirage tab (content script / MAIN world). No Echo Satellite.

| Step | Do |
|------|-----|
| 1 | Load echo-extension in Chrome |
| 2 | Open cyberdeck Mirage in **another tab of the same Chrome profile** |
| 3 | Focus a normal page (not Mirage) |
| 4 | Extension popup → **Send active tab** |
| 5 | Mirage / MUTHUR → `ECHO-EXTENSION // RECEIVED` |

| Topology | Works? |
|----------|--------|
| Same Chrome profile | Yes |
| Different Chrome profile / login | **No** |
| Chrome → Zen | **No** |

---

## Phase 1 — same machine, cross profile / cross browser

**Path:** Mirage button → Next proxy → Echo Satellite `:3050` → echo-extension poll → active tab snapshot → Mirage ingest.

Same outcome as Phase 0, but works when Mirage is in **Zen** or another **Chrome session** on the **same PC**.

### Prerequisites

1. **Echo Satellite** running (restart after pulling Phase 1 code)
2. **echo-extension 0.2.1** loaded / reloaded in **capture** Chrome
3. **Mirage on local HTTP** (same machine as Echo Satellite)
   - **Works:** cyberdeck-electron; Zen/Chrome on `http://127.0.0.1:<next-port>/cyberdeck`
   - **Fails:** Vercel / HTTPS PWA — browser blocks `http://127.0.0.1:3050` (mixed content); cloud Next cannot see your Echo
   - Zen must open the **local** cyberdeck URL, not `*.vercel.app`

### Why cyberdeck-electron works but Zen “doesn’t”

| Mirage surface | Reaches Echo `:3050`? |
|----------------|----------------------|
| cyberdeck-electron | Yes — local process / local HTTP |
| Zen → `http://127.0.0.1:…/cyberdeck` | Yes — browser calls Echo directly (CORS) |
| Zen → Vercel HTTPS | **No** — mixed content + server-side localhost is Vercel’s, not yours |

### Steps (N0)

| ID | Action | Expect | Status |
|----|--------|--------|--------|
| N0.1 | Satellite up; extension polling | Bridge alive (capture works; no “did not respond”) | **PASSED** (same PC) |
| N0.2 | Mirage Survey → **Capture active tab** | Current capture-Chrome active tab → `ECHO-EXTENSION // RECEIVED` | **PASSED** (cyberdeck-electron) |
| N0.3 | Switch tab in capture Chrome; click again | **New** page text (not frozen Phase 0 snapshot) | optional recheck |
| N0.4 | Mirage in Zen; capture in Chrome | Same as N0.2 — use **local HTTP** Mirage, not Vercel | pending |
| N0.5 | Mirage in other Chrome profile | Same as N0.2 | pending |
| N0.6 | PowerFist unlinked | N0.2–N0.5 still work | pending |

**Operator note (2026-07-10):** Part 1 same-PC Phase 1 verified via **cyberdeck-electron** + Echo Satellite + echo-extension 0.2.1.

### Optional Phase 1.1 (already in UI)

Refresh tabs → link title+#n → **Capture linked tab** — pick-by-id, not required for Phase 1 gate.

---

## Resume if interrupted

1. Checkout `cursor/phase-1-ext-capture-active` (or merge PR if landed).
2. Confirm code has `echo.ext-capture-active` / extension `capture-active` / Mirage **Capture active tab**.
3. Restart Echo Satellite; reload extension → **0.2.1**.
4. Run **N0.2** then **N0.4** (Chrome → Zen).
5. If stuck: Satellite `:3050` health, extension poll, Mirage on localhost, Echo host hint in panel (`127.0.0.1` or TEAM LINKS).

### Code map

| Piece | Path |
|-------|------|
| Extension bridge handler | `apps/echo-mirage-survey-extension/background.js` |
| Satellite command | `apps/echo-satellite-electron/electron/echo-commands.mjs` |
| Bridge queue | `apps/echo-satellite-electron/electron/echo-extension-bridge.mjs` |
| Mirage client | `src/lib/cyberdeck/survey-echo-extension.client.ts` |
| Mirage UI | `src/components/cyberdeck/survey-mirage-ext-capture-panel.tsx` |
| Proxy | `src/app/api/survey/echo/remote-command/route.ts` |

---

## Out of scope (later)

- Cross-machine / Vercel Mirage without Tailscale Echo IP
- PowerFist-triggered capture
- Network probe script automation
- Tauri Echo Satellite
