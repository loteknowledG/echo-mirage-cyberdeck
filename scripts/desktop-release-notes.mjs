/** Shared GitHub release notes for desktop installer workflow. */
export function desktopReleaseNotes(version) {
  return `## Echo Mirage Desktop ${version}

### macOS (Apple Silicon — M1/M2/M3/M4)
- **Echo-Mirage-Cyberdeck-${version}.dmg**

#### Install (read this if macOS says "damaged")
Chrome and Safari tag downloaded files with a quarantine flag. On unsigned CI builds, macOS often shows **"Echo Mirage Cyberdeck is damaged and can't be opened"** — the app is not corrupt.

**Terminal (recommended):**
\`\`\`bash
xattr -cr ~/Downloads/Echo-Mirage-Cyberdeck-${version}.dmg
\`\`\`
Open the DMG, drag **Echo Mirage Cyberdeck** to **Applications**, then:
\`\`\`bash
xattr -cr "/Applications/Echo Mirage Cyberdeck.app"
\`\`\`

**First launch:** right-click the app → **Open** (or **System Settings → Privacy & Security → Open Anyway**).

Spy / Echo silent capture requires **Screen Recording** permission in System Settings.

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
