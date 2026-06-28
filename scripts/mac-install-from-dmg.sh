#!/usr/bin/env bash
# Install Echo Mirage Cyberdeck from a downloaded .dmg on macOS.
# Fixes Gatekeeper "damaged and can't be opened" (quarantine + unsigned CI builds).
set -euo pipefail

dmg="${1:-}"
if [ -z "$dmg" ]; then
  echo "Usage: $0 ~/Downloads/Echo-Mirage-Cyberdeck-VERSION.dmg"
  exit 1
fi
if [ ! -f "$dmg" ]; then
  echo "DMG not found: $dmg"
  exit 1
fi

echo "Clearing quarantine on DMG…"
xattr -cr "$dmg"

mount_out="$(hdiutil attach -nobrowse -readonly "$dmg")"
vol="$(echo "$mount_out" | awk '/\/Volumes\// {print $NF; exit}')"
if [ -z "$vol" ] || [ ! -d "$vol" ]; then
  echo "Could not mount DMG or find volume path"
  exit 1
fi

app_src="$(find "$vol" -maxdepth 1 -name '*.app' | head -1)"
if [ -z "$app_src" ]; then
  hdiutil detach "$vol" >/dev/null 2>&1 || true
  echo "No .app found on mounted volume: $vol"
  exit 1
fi

app_name="$(basename "$app_src")"
app_dest="/Applications/$app_name"

echo "Mounted: $vol"
echo "Source app: $app_src"

cleanup() {
  hdiutil detach "$vol" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Copying to Applications…"
rm -rf "$app_dest"
ditto "$app_src" "$app_dest"

echo "Clearing quarantine and ad-hoc signing…"
xattr -cr "$app_dest"
codesign --force --deep --sign - "$app_dest"
codesign --verify --deep --strict "$app_dest"

echo ""
echo "Installed: $app_dest"
echo "Launch: open \"$app_dest\""
echo "If blocked on first run: right-click the app → Open"
