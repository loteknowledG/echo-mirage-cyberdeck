# Echo Satellite

Minimal **Tauri** capture drone for Echo Mirage espionage — replaces the 1.4 GB cyberdeck on the screenshot machine.

## What it does

1. **Arm** (setup window): Screen Recording permission + pair with Mirage via Echo QR URL
2. **Idle** (tray-only): WebSocket connected as `capture-deck`
3. **On PowerFist signal**: one-shot primary monitor screenshot → POST PNG to Mirage ingest
4. **No UI** during missions — no popups, no mission feedback

Compatible with the existing Mirage hub protocol (`silent-capture-solve`).

## Pairing

Mirage Spy generates an Echo QR like:

```text
http://{echo-lan-ip}:3050/powerfist/capture-pair?pairId=...&pairSecret=...&mirageHost=...&mirageHttpPort=...
```

The satellite listens on **`0.0.0.0:3050`** for that path (same as the full cyberdeck route).

You can also paste the full URL into the setup UI.

## CI release

Push tag `satellite-v0.1.0` (or run **Satellite installer** workflow) to publish:

- `Echo-Satellite-{version}-setup.exe` (Windows)
- `Echo-Satellite-{version}.dmg` (macOS Apple Silicon)

Spy tab **Echo** pane links to `/api/satellite-install` for platform-correct downloads.

## Development

Prerequisites: [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
cd apps/echo-satellite
pnpm install
pnpm tauri:dev
```

From repo root:

```bash
pnpm satellite:dev
pnpm satellite:build
```

## Build artifacts

```bash
pnpm tauri:build
```

Outputs under `apps/echo-satellite/src-tauri/target/release/bundle/`:

- Windows: `.exe` / NSIS installer
- macOS: `.dmg` (Apple Silicon when built on macOS)

## Architecture

```text
apps/echo-satellite/
  src/                 # Setup UI only (Arm phase)
  src-tauri/src/
    capture.rs         # xcap primary monitor → PNG base64
    pair.rs            # POST /api/powerfist/pair/capture
    mission.rs         # POST ingest URL
    ws_client.rs       # capture-deck WebSocket loop
    pair_server.rs     # GET /powerfist/capture-pair
    config.rs          # Persist credentials
```

## macOS notes

- Grant **Screen Recording** during Arm (before missions).
- Ad-hoc or signed builds avoid Gatekeeper “damaged” errors (same as cyberdeck DMG).
- Apple may show a **brief** system indicator per capture — not suppressible on supported APIs.

## Related

Full cyberdeck remains on Mirage. PowerFist phone/PWA unchanged.
