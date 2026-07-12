# Echo Mac Screenshot

Take a remote screenshot of the Echo Mac Satellite over Tailscale and open it.

## Steps

1. Run this PowerShell from the repo root (do not invent another path):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/echo-mac-screenshot.ps1
```

2. After it succeeds, open `echo-mac-screenshot.png` in the editor so the preview shows the new capture.
3. Reply with one short line: resolution + that the file was updated. Do not dump a long image description unless asked.
