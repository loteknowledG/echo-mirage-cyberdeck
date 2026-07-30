/** GitHub release notes for Echo Probe CI workflow. */
export function probeReleaseNotes(version) {
  return `## Echo Probe ${version} (Tauri)

Lightweight **Echo** capture drone — Rust/Tauri instead of Electron Satellite. Same Survey HTTP surface on port **3050**: pairing codes, extension bridge, and remote commands.

### What's new in ${version}

- **Survey HTTP parity (P0)** — \`/api/survey/echo/codes\`, \`/api/survey/pair/enter\`, \`/api/survey/echo/command\`, echo-extension poll/result/status, \`/spy/status\`
- **Screenshot** — primary display capture on \`echo.screenshot\`
- **PowerFist pairing** — \`/powerfist/capture-pair\` QR flow unchanged

Not yet on Probe: clipboard/Codex/STT, cloud relay secret UI, Survey team hub Socket.IO (use Echo Satellite Electron for those).

### macOS (Apple Silicon)

1. Download **Echo-Probe_${version}_aarch64.dmg** (or \`.pkg\` when published)
2. If macOS blocks it: right-click → **Open** → **Open**
3. Grant **Screen Recording**, then pair from Mirage Spy → Echo QR on port **3050**

### Windows (x64)

Double-click **Echo-Probe_${version}_x64-setup.exe**. System tray on Windows builds.

### Pairing

Mirage Spy → Echo QR → this machine's LAN IP and port **3050**.

Built from [\`probe-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/probe-installer.yml).
`;
}
