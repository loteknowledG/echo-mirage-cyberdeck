#!/usr/bin/env bash
# pkg postinstall — clear download quarantine only. Never ad-hoc re-sign a notarized app.
set -e
APP="/Applications/Echo-Satellite.app"
if [ ! -d "$APP" ]; then
  echo "Echo-Satellite.app not found at $APP"
  exit 1
fi
xattr -cr "$APP" 2>/dev/null || true
if codesign --verify --deep --strict --verbose=0 "$APP" 2>/dev/null; then
  echo "Echo Satellite installed (signature verified) at $APP"
else
  echo "Echo Satellite installed at $APP (unsigned build — right-click → Open once if macOS blocks launch)"
fi
