#!/bin/bash
# pkg postinstall — clear quarantine + ad-hoc sign (unsigned CI builds).
set -e
APP="/Applications/Echo-Satellite.app"
if [ ! -d "$APP" ]; then
  echo "Echo-Satellite.app not found at $APP"
  exit 1
fi
xattr -cr "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP"
echo "Echo Satellite installed at $APP"
