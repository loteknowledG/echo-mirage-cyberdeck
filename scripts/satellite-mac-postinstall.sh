#!/bin/bash
# pkg postinstall — clear quarantine. Must never fail the installer (exit 0 always).

APP=""
for candidate in \
  "/Applications/Echo Satellite.app" \
  "${HOME}/Applications/Echo Satellite.app" \
  "${2:-}/Applications/Echo Satellite.app"; do
  if [ -d "$candidate" ]; then
    APP="$candidate"
    break
  fi
done

if [ -z "$APP" ]; then
  echo "Echo Satellite postinstall: app bundle not found at expected paths (install may still be OK)."
  exit 0
fi

xattr -dr com.apple.quarantine "$APP" 2>/dev/null || xattr -cr "$APP" 2>/dev/null || true

if codesign --verify --deep --strict --verbose=0 "$APP" 2>/dev/null; then
  echo "Echo Satellite installed (signature verified) at $APP"
else
  echo "Echo Satellite installed at $APP"
fi

exit 0
