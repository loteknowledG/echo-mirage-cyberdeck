# Turn on Cursor speak-last-response with Samus mechanicus-voice for local dev.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$HookDir = Join-Path $Root ".cursor\hooks"

if (-not $env:SAMUS_MANUS_ROOT) {
  $env:SAMUS_MANUS_ROOT = "C:\dev\samus-manus"
}

$samusVoice = Join-Path $env:SAMUS_MANUS_ROOT "tools\voice_profile.py"
if (-not (Test-Path $samusVoice)) {
  Write-Error "Samus voice helper not found: $samusVoice (set SAMUS_MANUS_ROOT)"
  exit 1
}

Set-Content -Path (Join-Path $HookDir "cursor-tts-voice.txt") -Value "mechanicus-voice" -NoNewline
$mutePath = Join-Path $HookDir "mechanicus-cursor.muted"
if (Test-Path $mutePath) {
  Set-Content -Path $mutePath -Value "0"
}

Write-Host "Mechanicus Cursor voice enabled."
Write-Host "  voice profile: mechanicus-voice"
Write-Host "  hook: .cursor/hooks.json -> run-speak-last-mechanicus.ps1"
Write-Host "  extract: full last assistant reply"
Write-Host "  samus: $env:SAMUS_MANUS_ROOT"
Write-Host ""
Write-Host "Smoke: pnpm run voice:cursor:read-last-response"
Write-Host "Dry:   pnpm run voice:cursor:read-last-response:dry"
