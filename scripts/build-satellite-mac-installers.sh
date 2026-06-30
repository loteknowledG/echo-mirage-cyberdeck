#!/usr/bin/env bash
# Build a standard macOS .pkg from the Tauri-produced .app (double-click install + in-place upgrade).
# Tauri's own .dmg is left untouched as a drag-to-Applications fallback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/apps/echo-satellite/package.json').version")"
BUNDLE_ROOT="$ROOT/apps/echo-satellite/src-tauri/target/release/bundle"
APP="$(find "$BUNDLE_ROOT/macos" -maxdepth 1 -name 'Echo-Satellite.app' 2>/dev/null | head -1)"

if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "Echo-Satellite.app not found under $BUNDLE_ROOT/macos"
  find "$BUNDLE_ROOT" -maxdepth 4 -type d 2>/dev/null || true
  exit 1
fi

OUT_DIR="$BUNDLE_ROOT/macos"
PKG="$OUT_DIR/Echo-Satellite_${VERSION}_aarch64.pkg"
STAGING="$(mktemp -d)"
PKG_SCRIPTS="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGING" "$PKG_SCRIPTS"
}
trap cleanup EXIT

echo "Building PKG for Echo Satellite $VERSION"
echo "Source app: $APP"

cp "$ROOT/scripts/satellite-mac-preinstall.sh" "$PKG_SCRIPTS/preinstall"
cp "$ROOT/scripts/satellite-mac-postinstall.sh" "$PKG_SCRIPTS/postinstall"
chmod +x "$PKG_SCRIPTS/preinstall" "$PKG_SCRIPTS/postinstall"

mkdir -p "$STAGING/payload"
ditto "$APP" "$STAGING/payload/Echo-Satellite.app"

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
else
  echo "APPLE_INSTALLER_SIGNING_IDENTITY not set — PKG is unsigned."
fi

bash "$ROOT/scripts/notarize-mac-artifact.sh" "$PKG"

echo "Created PKG: $PKG"
