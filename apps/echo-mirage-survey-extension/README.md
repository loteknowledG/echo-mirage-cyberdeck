# echo-extension

Chrome MV3 agent that **copies tab text** for Survey. Talks to **echo-electron** (Echo Satellite) on `127.0.0.1:3050`.

## Titles

- Chrome UI name: **echo-extension**
- Bridge peer: **echo-electron**
- Commander UI: **mirage-browser** (Zen / Chrome) or **mirage-electron**

## Install

1. `chrome://extensions` → Developer mode → Load unpacked
2. Select `apps/echo-mirage-survey-extension`
3. Confirm version **0.2.1** and name **echo-extension**
4. Reload after pulls

## Operator tests

Full Phase 0 / Phase 1 checklist (resume-friendly): [`docs/survey-network-tests.md`](../../docs/survey-network-tests.md)

## Phase 1 flow (same machine, cross browser / profile)

1. Start **echo-electron** (Echo Satellite) — pair HTTP on `:3050`
2. Keep **echo-extension** loaded in **capture** Chrome
3. Open **mirage-browser** on **local HTTP** cyberdeck in Zen (same URL family as cyberdeck-electron — not Vercel HTTPS)
4. Focus a normal page in capture Chrome
5. Mirage Survey → **Capture active tab**
6. MUTHUR shows `ECHO-EXTENSION // RECEIVED`

Optional: **Refresh tabs** → link title+#n → **Capture linked tab** (Phase 1.1).

## Phase 0 fallback

Popup **Send active tab** delivers only to a Mirage tab in the **same Chrome profile** (dev). Does not reach Zen or another Chrome login.
