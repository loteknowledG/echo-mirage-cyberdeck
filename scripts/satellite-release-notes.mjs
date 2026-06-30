/** GitHub release notes for Echo Satellite CI workflow. */
export function satelliteReleaseNotes(version) {
  return `## Echo Satellite ${version}

Minimal capture drone for the **Echo** screenshot machine — tray-only, screenshot on PowerFist signal, relay to Mirage.

### macOS (Apple Silicon)

1. Download **Echo-Satellite_${version}_aarch64.pkg**
2. Double-click it and click through the installer

**Updates in place** — replaces any older Echo Satellite in Applications. No uninstall, no Terminal.

If macOS warns about an unidentified developer, right-click the \`.pkg\` → **Open** once (unsigned open-source build).

Grant **Screen Recording** on first launch, then pair from Mirage Spy → Echo QR on port **3050**.

**macOS 15+:** Window/Dock app (no menu-bar tray). Diagnostics panel shows startup log if anything fails.

### Windows (x64)

Double-click **Echo-Satellite_${version}_x64-setup.exe** (NOT "Source code zip"). Upgrades in place — the installer closes any running Echo Satellite automatically. No uninstall needed.

If you still see a "app is running" prompt, choose **OK** to let the installer close it and continue (Cancel aborts the whole install).

Requires **Microsoft Edge WebView2 Runtime** on some PCs.

### Pairing

Mirage Spy → Echo QR → this machine's LAN IP and port **3050** (\`/powerfist/capture-pair\`).

Built from [\`satellite-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/satellite-installer.yml).
`;
}
