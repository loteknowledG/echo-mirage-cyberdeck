# echo-extension

Chrome MV3 agent that **copies tab text** for Survey. Talks to **echo-electron** (Echo Satellite) on `127.0.0.1:3050`.

## Titles

- Chrome UI name: **echo-extension**
- Bridge peer: **echo-electron**
- Commander UI: **mirage-browser** (Zen) — Refresh tabs / Link / Capture text

## Install

1. `chrome://extensions` → Developer mode → Load unpacked
2. Select `apps/echo-mirage-survey-extension`
3. Confirm version **0.2.0** and name **echo-extension**
4. Reload after pulls

## Phase 1 flow

1. Start **echo-electron** (Echo Satellite) — pair HTTP on `:3050`
2. Keep **echo-extension** loaded in Chrome (target tabs here)
3. Open **mirage-browser** in Zen (`http://127.0.0.1:<next-port>/cyberdeck` → Survey → Mirage)
4. Mirage: **Refresh tabs** → link title+#n → **Capture text**
5. MUTHUR shows `ECHO-EXTENSION // RECEIVED`

## Phase 0 fallback

Popup **Send active tab** still delivers to a same-browser mirage tab (dev only).
