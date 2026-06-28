/** Shared GitHub release notes for desktop installer workflow. */
export function desktopReleaseNotes(version) {
  return `## Echo Mirage Desktop ${version}

### macOS (Apple Silicon — M1/M2/M3/M4)
- **Echo-Mirage-Cyberdeck-${version}.dmg**
- Spy / Echo silent capture requires **Screen Recording** permission in System Settings.
- First launch: if macOS blocks the app, **right-click → Open** (unsigned CI build).

### Windows (x64)
- **Echo-Mirage-Cyberdeck-Setup-${version}.exe**

### Features
- Silent Mode and system tray
- Local disk operator folders and in-place save
- Desktop IPC bridges (clipboard, operator folders, capture)
- Auto-update via Settings when \`latest-mac.yml\` / \`latest.yml\` are published

Built from [\`desktop-installer\`](https://github.com/loteknowledG/echo-mirage-cyberdeck/actions/workflows/desktop-installer.yml) workflow.
`;
}
