# macOS code signing & notarization (Echo Probe)

The **"Apple could not verify Echo-Probe is free of malware"** dialog is macOS Gatekeeper. The only way to remove it for users downloading from GitHub is:

1. Sign the `.app` with **Developer ID Application**
2. Sign the `.pkg` with **Developer ID Installer**
3. Notarize both with App Store Connect API
4. Staple the notarization ticket

## Certificates needed

1. In Apple Developer → Certificates:
   - **Developer ID Application** (for `Echo-Probe.app`)
   - **Developer ID Installer** (for `Echo-Probe_*.pkg`)

2. Export as `.p12` for CI (`APPLE_CERTIFICATE` secret)

## Local ad-hoc sign (dev only)

```bash
codesign --force --deep --sign - "apps/echo-probe/src-tauri/target/release/bundle/macos/Echo-Probe.app"
```

## CI

Tag a new release, e.g. `probe-v0.1.10`. When a probe installer workflow is wired, it will sign, notarize, and staple the `.app`, `.pkg`, and `.dmg`. Users double-click install with no Gatekeeper warning.

Verify after install:

```bash
spctl -a -vv -t install /path/to/Echo-Probe_0.1.10_aarch64.pkg
codesign -dv --verbose=4 /Applications/Echo-Probe.app
```
