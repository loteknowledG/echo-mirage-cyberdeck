/** GitHub release notes for Echo Satellite CI workflow. */
export function satelliteReleaseNotes(version) {
  return `## Echo Satellite ${version} (Electron)

Minimal capture drone for the **Echo** screenshot machine — tray on Windows, small window on Mac. Screenshots fire only when PowerFist signals Mirage.

### What's new in ${version}

- **Remote screenshot over HTTP** — \`POST /api/survey/echo/command\` with \`{"action":"echo.screenshot"}\` returns PNG from Mirage / Tailscale (no local \`pnpm satellite:dev\` required)
- **Survey command API** — screenshot, clipboard, listening, and echo-extension tab capture on the Satellite pair server
- Spy → Survey route rename (\`/api/survey/...\`) for pairing codes and PIN enter
- Echo-extension bridge for Mirage browser tab capture
- **Mirage pairing feedback** — Pair with ECHO shows searching, linked, or error; Satellite updates linked Mirages immediately
- **6-digit pairing codes in the app** — Mirage/PowerFist enter PIN only; no URL paste for team link
- **Test capture preview** — Test capture now shows a thumbnail of what was captured
- **Check for updates** in the app — one-click download and install from GitHub releases

### macOS (Apple Silicon)

1. Download **Echo-Satellite_${version}_aarch64.pkg**
2. If macOS blocks it: right-click the \`.pkg\` → **Open** → **Open**
3. Click through the installer — updates in place, no uninstall

If macOS still warns about an unidentified developer, the release was built without Apple signing secrets — see [\`MACOS_SIGNING.md\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/blob/main/apps/echo-satellite/MACOS_SIGNING.md).

Grant **Screen Recording** on first launch, then pair from Mirage Spy → Echo QR on port **3050**.

### Windows (x64)

Double-click **Echo-Satellite_${version}_x64-setup.exe**. Upgrades in place — installer closes any running Echo Satellite automatically.

### Pairing

Mirage Spy → Echo QR → this machine's LAN IP and port **3050** (\`/powerfist/capture-pair\`).

Built from [\`satellite-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/satellite-installer.yml).
`;
}
