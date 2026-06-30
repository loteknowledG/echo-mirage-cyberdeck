#!/usr/bin/env bash
# Import Apple Developer certificates into a CI keychain (no-op when secrets are absent).
set -euo pipefail

if [ -z "${APPLE_CERTIFICATE:-}" ]; then
  echo "APPLE_CERTIFICATE not set — macOS build will be ad-hoc signed (Gatekeeper will warn users)."
  exit 0
fi

if [ -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]; then
  echo "APPLE_CERTIFICATE_PASSWORD is required when APPLE_CERTIFICATE is set."
  exit 1
fi

KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-build-keychain-password}"
CERT_PATH="${RUNNER_TEMP:-/tmp}/echo-satellite-cert.p12"
KEYCHAIN_PATH="${RUNNER_TEMP:-/tmp}/echo-satellite-signing.keychain-db"

echo "$APPLE_CERTIFICATE" | base64 --decode > "$CERT_PATH"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$CERT_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security list-keychains -d user -s "$KEYCHAIN_PATH" login.keychain
security default-keychain -s "$KEYCHAIN_PATH"
echo "Apple signing certificate imported."
