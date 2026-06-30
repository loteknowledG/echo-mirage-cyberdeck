#!/bin/bash
# pkg postinstall — must NEVER exit non-zero or macOS marks the whole install failed.
# Do NOT re-sign the app here: ad-hoc re-signing invalidates Screen Recording TCC entries.
APP="/Applications/Echo-Satellite.app"
LEGACY="/Applications/Echo Satellite.app"

for target in "$APP" "$LEGACY"; do
  if [ ! -d "$target" ]; then
    continue
  fi
  xattr -cr "$target" 2>/dev/null || true
  echo "Echo Satellite installed at $target (quarantine cleared; signature unchanged for TCC)"
  exit 0
done

echo "Warning: Echo Satellite.app not found after install — files may still have copied."
exit 0
