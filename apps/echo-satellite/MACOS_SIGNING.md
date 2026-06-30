# macOS code signing & notarization (Echo Satellite)

The **"Apple could not verify Echo-Satellite is free of malware"** dialog is macOS Gatekeeper. The only way to remove it for users downloading from GitHub is:

1. **Apple Developer Program** membership ($99/year)
2. **Developer ID Application** certificate (signs the `.app`)
3. **Developer ID Installer** certificate (signs the `.pkg`)
4. **Notarization** via App Store Connect API
5. GitHub Actions secrets below

CI is wired in `.github/workflows/satellite-installer.yml`. When secrets are set, releases are signed + notarized automatically. When secrets are missing, builds stay ad-hoc signed and users must right-click → Open once.

## One-time Apple setup

1. Enroll at [Apple Developer](https://developer.apple.com/programs/).
2. In **Certificates, Identifiers & Profiles**, create:
   - **Developer ID Application** (for `Echo-Satellite.app`)
   - **Developer ID Installer** (for `Echo-Satellite_*.pkg`)
3. Export both certs as a single `.p12` from Keychain Access (or separate `.p12` files).
4. In [App Store Connect → Users and Access → Integrations → Keys](https://appstoreconnect.apple.com/access/integrations/api), create an API key with **Developer** access. Download the `.p8` file once.

## GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `APPLE_CERTIFICATE` | Base64 of `.p12`: `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_INSTALLER_SIGNING_IDENTITY` | e.g. `Developer ID Installer: Your Name (TEAMID)` |
| `APPLE_TEAM_ID` | 10-character Team ID from Apple Developer membership |
| `APPLE_API_KEY` | Key ID from App Store Connect API key |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect API page |
| `APPLE_API_KEY_BASE64` | Base64 of `AuthKey_XXXXX.p8` |
| `KEYCHAIN_PASSWORD` | Any random string (CI keychain unlock) |

## After secrets are added

Tag a new release, e.g. `satellite-v0.1.10`. The workflow will sign, notarize, and staple the `.app`, `.pkg`, and `.dmg`. Users double-click install with no Gatekeeper warning.

## Verify a build locally

```bash
spctl -a -vv -t install /path/to/Echo-Satellite_0.1.10_aarch64.pkg
codesign -dv --verbose=4 /Applications/Echo-Satellite.app
```

Expected: `source=Notarized Developer ID`.
