# Echo Satellite — bug tracker (fix one by one)

| # | Bug | Symptom | Status | Fixed in |
|---|-----|---------|--------|----------|
| 1 | `tokio::spawn` in Tauri `.setup()` | Instant exit all platforms | ✅ Fixed | 0.1.4+ |
| 2 | macOS 15 + `tray-icon` Cargo feature (tao #1205) | "quit unexpectedly" on double-click | ✅ Fixed | 0.1.6+ (Mac = window-only) |
| 3 | `JoinHandle` type mismatch after async_runtime change | CI compile fail | ✅ Fixed | 0.1.7 |
| 4 | Window hides with no tray if tray init fails | Flash then gone | ✅ Fixed | 0.1.5+ |
| 5 | Windows release upload PowerShell `@assets` bug | No `.exe` on GitHub | ✅ Fixed | 0.1.6+ |
| 6 | Invalid Tauri 2.11 bundle keys in CI | No installers published | ✅ Fixed | 0.1.2+ |

## How to report the next bug

1. Install **satellite-v0.1.7** (or latest)
2. If it crashes, **reopen** the app
3. Red banner + **Diagnostics** panel → **Copy diagnostics**
4. Note the **last `[boot N/8]` line** — that's the crash phase

## Boot steps (Mac)

| Step | Meaning |
|------|---------|
| 1/8 | `run()` started |
| 2/8 | Tauri setup hook (window created) |
| 3/8 | `RunEvent::Ready` |
| 4/8 | App state ready |
| 5/8 | Pair HTTP server on :3050 |
| 6/8 | Credentials restore (or fresh) |
| 7/8 | Window-only mode (Mac — no tray) |
| 8/8 | Setup window shown → **SESSION OK** |

If crash is **before** step 2: native/Tauri crash (often old tray-icon build).
If crash **after** 8/8: runtime bug (pair, capture, WebSocket).
