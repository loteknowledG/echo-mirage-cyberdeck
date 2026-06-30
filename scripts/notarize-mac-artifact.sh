#!/usr/bin/env bash
# Notarize and staple a macOS .pkg or .dmg when App Store Connect API credentials are set.
set -euo pipefail

artifact="${1:-}"
if [ -z "$artifact" ] || [ ! -f "$artifact" ]; then
  echo "Usage: $0 path/to/installer.pkg|dmg"
  exit 1
fi

if [ -z "${APPLE_API_KEY:-}" ] || [ -z "${APPLE_API_ISSUER:-}" ] || [ -z "${APPLE_API_KEY_PATH:-}" ]; then
  echo "Skipping notarization for $(basename "$artifact") — set APPLE_API_KEY, APPLE_API_ISSUER, APPLE_API_KEY_PATH in CI."
  exit 0
fi

if [ ! -f "$APPLE_API_KEY_PATH" ]; then
  echo "APPLE_API_KEY_PATH not found: $APPLE_API_KEY_PATH"
  exit 1
fi

echo "Notarizing $(basename "$artifact")…"
xcrun notarytool submit "$artifact" \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY" \
  --issuer "$APPLE_API_ISSUER" \
  --wait

echo "Stapling $(basename "$artifact")…"
xcrun stapler staple "$artifact"
xcrun stapler validate "$artifact"
echo "Notarization complete: $artifact"
