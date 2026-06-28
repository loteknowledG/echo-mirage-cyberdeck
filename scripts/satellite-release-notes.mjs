/** GitHub release notes for Echo Satellite CI workflow. */
export function satelliteReleaseNotes(version) {
  return `## Echo Satellite ${version}

Minimal capture drone for the **Echo** screenshot machine — tray-only, screenshot on PowerFist signal, relay to Mirage.

### macOS (Apple Silicon)
- **Echo-Satellite-${version}.dmg**

Grant **Screen Recording** during first launch (Arm phase), then pair with Mirage Echo QR on port **3050**.

\`\`\`bash
xattr -cr ~/Downloads/Echo-Satellite-${version}.dmg
hdiutil attach ~/Downloads/Echo-Satellite-${version}.dmg
cp -R "/Volumes/Echo Satellite/Echo Satellite.app" /Applications/
xattr -cr "/Applications/Echo Satellite.app"
codesign --force --deep --sign - "/Applications/Echo Satellite.app"
\`\`\`

### Windows (x64)
- **Echo-Satellite-${version}-setup.exe**

### Pairing
Mirage Spy → Echo QR → use this machine's LAN IP and port **3050** (\`/powerfist/capture-pair\`).

Built from [\`satellite-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/satellite-installer.yml).
`;
}
