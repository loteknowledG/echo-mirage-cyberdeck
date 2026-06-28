# Echo Satellite — startup debug notes

## Verified root causes (not guesses)

### 1. macOS 15 + `tray-icon` feature → instant crash

- **Symptom:** macOS dialog *"Echo-Satellite quit unexpectedly"* on double-click
- **Evidence:** [tao #1205](https://github.com/tauri-apps/tao/issues/1205) — crash in `applicationDidFinishLaunching` when `tauri` is built with `features = ["tray-icon"]`
- **Our code:** v0.1.3–0.1.5 had `tauri = { features = ["tray-icon"] }` on all platforms
- **Fix (v0.1.6+):** macOS builds **without** `system-tray` feature; Windows builds with it
- **CI proof:** macOS job runs a 4-second launch smoke test after build

### 2. v0.1.3 `tokio::spawn` in `.setup()` → panic (all platforms)

- **Symptom:** Instant exit / flash
- **Evidence:** git tag `satellite-v0.1.3` called `ensure_pair_server()` → `tokio::spawn` inside `.setup()`
- **Fix:** v0.1.4+ uses `tauri::async_runtime::spawn` after `RunEvent::Ready`

## Startup log (after v0.1.6)

**macOS:** `~/Library/Logs/Echo-Satellite/startup.log`

**Windows:** `%APPDATA%\Echo-Satellite\logs\startup.log`

Launch from Terminal to also print logs to stderr:

```bash
"/Applications/Echo-Satellite.app/Contents/MacOS/Echo-Satellite"
```

## macOS install (unsigned build)

```bash
xattr -cr "/Applications/Echo-Satellite.app"
codesign --force --deep --sign - "/Applications/Echo-Satellite.app"
```
