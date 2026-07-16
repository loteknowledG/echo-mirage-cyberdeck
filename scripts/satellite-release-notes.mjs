/** GitHub release notes for Echo Satellite CI workflow. */
export function satelliteReleaseNotes(version) {
  return `## Echo Satellite ${version} (Electron)

Minimal capture drone for the **Echo** screenshot machine — tray on Windows, small window on Mac. Screenshots fire only when PowerFist signals Mirage.

### What's new in ${version}

- **Screenshot over cloud relay** — HTTPS Mirage PWA can enqueue \`echo.screenshot\` via Next/Upstash middlebox; Satellite polls, captures locally, and returns JPEG (no Electron Mirage desktop required for capture)
- **JPEG captures** — primary display encode at quality ~72 for smaller relay payloads under Upstash size limits
- Set \`SURVEY_RELAY_SECRET\` to match the cyberdeck Vercel env when using authenticated relay
- Earlier: remote screenshot over HTTP, Survey command API, echo-extension bridge, 6-digit pairing, Check for updates

### macOS (Apple Silicon)

1. Download **Echo-Satellite_${version}_aarch64.pkg**
2. If macOS blocks it: right-click the \`.pkg\` → **Open** → **Open**
3. Click through the installer — updates in place, no uninstall

If macOS still warns about an unidentified developer, the release was built without Apple signing secrets — see [\`MACOS_SIGNING.md\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/blob/main/apps/echo-satellite/MACOS_SIGNING.md).

Grant **Screen Recording** on first launch, then pair from Mirage Spy → Echo QR on port **3050**.

### Pairing

Mirage Spy → Echo QR → this machine's LAN IP and port **3050** (\`/powerfist/capture-pair\`).

### Windows (x64)

Double-click **Echo-Satellite_${version}_x64-setup.exe**. Upgrades in place — installer closes any running Echo Satellite automatically.

Built from [\`satellite-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/satellite-installer.yml).
`;
}
