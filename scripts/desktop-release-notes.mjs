/** Shared GitHub release notes for desktop installer workflow. */
export function desktopReleaseNotes(version) {
  return `## Echo Mirage Desktop ${version}

### macOS (Apple Silicon — M1/M2/M3/M4)
- **Echo-Mirage-Cyberdeck-${version}.dmg**

#### Install (read this if macOS says "damaged")
Chrome tags downloads with a quarantine flag. CI builds are not Apple-notarized, so macOS may show **"Echo Mirage Cyberdeck is damaged and can't be opened"**. The file is not corrupt.

**Do not double-click the app inside the DMG.** Copy to Applications first, then clear quarantine on the \`.app\` bundle.

**One-liner install script (from repo clone):**
\`\`\`bash
bash scripts/mac-install-from-dmg.sh ~/Downloads/Echo-Mirage-Cyberdeck-${version}.dmg
\`\`\`

**Manual Terminal steps:**
\`\`\`bash
xattr -cr ~/Downloads/Echo-Mirage-Cyberdeck-${version}.dmg
hdiutil attach ~/Downloads/Echo-Mirage-Cyberdeck-${version}.dmg
cp -R "/Volumes/Echo Mirage Cyberdeck ${version}/Echo Mirage Cyberdeck.app" /Applications/
xattr -cr "/Applications/Echo Mirage Cyberdeck.app"
codesign --force --deep --sign - "/Applications/Echo Mirage Cyberdeck.app"
open "/Applications/Echo Mirage Cyberdeck.app"
\`\`\`

**First launch:** right-click the app → **Open** (or **System Settings → Privacy & Security → Open Anyway**).

Echo capture requires **Screen Recording** permission in System Settings.

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
