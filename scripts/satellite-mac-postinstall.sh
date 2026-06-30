#!/bin/bash
# pkg postinstall — must NEVER exit non-zero or macOS marks the whole install failed.
APP="/Applications/Echo-Satellite.app"
LEGACY="/Applications/Echo Satellite.app"

for target in "$APP" "$LEGACY"; do
  if [ ! -d "$target" ]; then
    continue
  fi
  xattr -cr "$target" 2>/dev/null || true
  if codesign --verify --deep --strict "$target" 2>/dev/null; then
    echo "Echo Satellite installed (signed) at $target"
  else
    codesign --force --deep --sign - "$target" 2>/dev/null || true
    echo "Echo Satellite installed (ad-hoc signed) at $target"
  fi
  exit 0
done

echo "Warning: Echo Satellite.app not found after install — files may still have copied."
exit 0
