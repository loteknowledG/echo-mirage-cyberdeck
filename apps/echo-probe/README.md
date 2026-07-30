# Echo Probe

Minimal **Tauri (Rust)** capture drone for Echo Mirage espionage — the lightweight screenshot path on the capture machine.

> **Echo Satellite** (`apps/echo-satellite-electron`) is the Electron tray app used for Survey today (extension bridge, pairing, `:3050`). **Echo Probe** is the Rust/Tauri alternative.

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

The probe listens on **`0.0.0.0:3050`** for that path (same as the full cyberdeck route).

You can also paste the full URL into the setup UI.

## CI release

Push tag `probe-v0.1.0` (when a probe installer workflow is wired) to publish Tauri bundles, e.g.:

- `Echo-Probe-{version}-setup.exe` (Windows)
- `Echo-Probe-{version}.dmg` (macOS Apple Silicon)

Survey tab **Echo** pane links to `/api/satellite-install` for **Echo Satellite (Electron)** downloads.

## Development

Prerequisites: [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
cd apps/echo-probe
pnpm install
pnpm tauri:dev
```

From repo root:

```bash
pnpm probe:dev
pnpm probe:build
```

## Build artifacts

```bash
pnpm tauri:build
```

Outputs under `apps/echo-probe/src-tauri/target/release/bundle/`:

- Windows: `.exe` / NSIS installer
- macOS: `.app` / `.dmg`

## Layout

```text
apps/echo-probe/
├── src/           # Vite setup UI
├── src-tauri/     # Rust (axum pair server, capture, WS client)
└── README.md
```

See [`DEBUG.md`](DEBUG.md) for macOS tray crash notes and [`MACOS_SIGNING.md`](MACOS_SIGNING.md) for signing.
