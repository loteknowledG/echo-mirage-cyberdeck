#!/usr/bin/env bash
# Build a standard macOS .pkg from the Electron-produced .app (double-click install + in-place upgrade).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/apps/echo-satellite-electron/package.json').version")"

APP=""
for candidate in \
  "$ROOT/apps/echo-satellite-electron/release/mac-arm64/Echo Satellite.app" \
  "$ROOT/apps/echo-satellite-electron/release/mac/Echo Satellite.app" \
  "$ROOT/apps/echo-satellite/src-tauri/target/release/bundle/macos/Echo-Satellite.app"; do
  if [ -d "$candidate" ]; then
    APP="$candidate"
    break
  fi
done

if [ -z "$APP" ]; then
  APP="$(find "$ROOT/apps/echo-satellite-electron/release" -maxdepth 3 -name 'Echo Satellite.app' 2>/dev/null | head -1)"
fi

if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "Echo Satellite.app not found under apps/echo-satellite-electron/release"
  find "$ROOT/apps/echo-satellite-electron/release" -maxdepth 4 -type d 2>/dev/null || true
  exit 1
fi

OUT_DIR="$ROOT/apps/echo-satellite-electron/release/mac-pkg"
mkdir -p "$OUT_DIR"
PKG="$OUT_DIR/Echo-Satellite_${VERSION}_aarch64.pkg"
STAGING="$(mktemp -d)"
PKG_SCRIPTS="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGING" "$PKG_SCRIPTS"
}
trap cleanup EXIT

echo "Building PKG for Echo Satellite $VERSION (Electron)"
echo "Source app: $APP"

cp "$ROOT/scripts/satellite-mac-preinstall.sh" "$PKG_SCRIPTS/preinstall"
cp "$ROOT/scripts/satellite-mac-postinstall.sh" "$PKG_SCRIPTS/postinstall"
chmod +x "$PKG_SCRIPTS/preinstall" "$PKG_SCRIPTS/postinstall"

mkdir -p "$STAGING/payload"
ditto "$APP" "$STAGING/payload/Echo Satellite.app"

pkgbuild \
  --root "$STAGING/payload" \
  --install-location /Applications \
  --scripts "$PKG_SCRIPTS" \
  --identifier com.craftwerk.echo-satellite \
  --version "$VERSION" \
  "$PKG"

if [ -n "${APPLE_INSTALLER_SIGNING_IDENTITY:-}" ]; then
  SIGNED_PKG="${PKG%.pkg}-signed.pkg"
  echo "Signing PKG with ${APPLE_INSTALLER_SIGNING_IDENTITY}"
  productsign --sign "$APPLE_INSTALLER_SIGNING_IDENTITY" "$PKG" "$SIGNED_PKG"
  mv "$SIGNED_PKG" "$PKG"
fi

bash "$ROOT/scripts/notarize-mac-artifact.sh" "$PKG"

echo "Created PKG: $PKG"
