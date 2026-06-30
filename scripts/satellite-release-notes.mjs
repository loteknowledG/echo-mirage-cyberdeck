/** GitHub release notes for Echo Satellite CI workflow. */
export function satelliteReleaseNotes(version) {
  return `## Echo Satellite ${version} (Electron)

Minimal capture drone for the **Echo** screenshot machine — tray on Windows, small window on Mac. Screenshots fire only when PowerFist signals Mirage.

### What's new in ${version}

- **macOS PKG install fix** — installer no longer fails at Summary when upgrading over a running Echo Satellite
- **Check for updates** in the app — one-click download and install from GitHub releases
- Automatic update check on startup when a newer Satellite build exists
- **Code-only pairing** — Mirage/PowerFist enter the 6-digit PIN; browser finds Echo on Wi‑Fi (no IP typing)
- **Linked Mirages** on the Status panel — Spy team connections plus capture relay hub

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
