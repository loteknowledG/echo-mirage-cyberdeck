# Turn on Cursor speak-last-response with Samus mechanicus-voice for local dev.
# Also locks Python 3.12 (pygame) so Hermes/other venv `python` on PATH cannot hijack TTS.
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

function Resolve-HookPython {
  if ($env:CURSOR_HOOK_PYTHON -and (Test-Path $env:CURSOR_HOOK_PYTHON)) {
    return $env:CURSOR_HOOK_PYTHON
  }
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "C:\Python312\python.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }
  return $null
}

$hookPy = Resolve-HookPython
if (-not $hookPy) {
  Write-Error "No Python 3.12+ found. Install Python 3.12 or set CURSOR_HOOK_PYTHON."
  exit 1
}

& $hookPy -c "import pygame" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Installing pygame on $hookPy ..."
  & $hookPy -m pip install pygame
  if ($LASTEXITCODE -ne 0) {
    Write-Error "pygame install failed on $hookPy"
    exit 1
  }
}

$ffplay = Get-Command ffplay -ErrorAction SilentlyContinue
if (-not $ffplay) {
  Write-Warning "ffplay not on PATH — hook will fall back to silent pygame or set CURSOR_HOOK_TTS_MODE=sapi"
} else {
  Write-Host "  ffplay: $($ffplay.Source)"
}

[System.Environment]::SetEnvironmentVariable("CURSOR_HOOK_PYTHON", $hookPy, "User")
$env:CURSOR_HOOK_PYTHON = $hookPy
Set-Content -Path (Join-Path $HookDir "cursor-hook-python.txt") -Value $hookPy -NoNewline

Set-Content -Path (Join-Path $HookDir "cursor-tts-voice.txt") -Value "mechanicus-voice" -NoNewline
$mutePath = Join-Path $HookDir "mechanicus-cursor.muted"
if (Test-Path $mutePath) {
  Set-Content -Path $mutePath -Value "0"
}

Write-Host "Mechanicus Cursor voice locked in."
Write-Host "  voice profile: mechanicus-voice"
Write-Host "  hook extract: full last reply (override: `$env:CURSOR_HOOK_MECHANICUS_EXTRACT='sentence')"
Write-Host "  hook TTS mode: samus (Coderobo + mechanicus FX + ffplay playback)"
Write-Host "  playback: BOOTUP_PLAYBACK=ffplay (override: `$env:CURSOR_HOOK_BOOTUP_PLAYBACK='pygame'|'auto')"
Write-Host "  fallback SAPI: set `$env:CURSOR_HOOK_TTS_MODE='sapi' if ffplay missing"
Write-Host "  hook: .cursor/hooks.json -> run-speak-last-mechanicus.ps1"
Write-Host "  extract: full last assistant reply"
Write-Host "  samus: $env:SAMUS_MANUS_ROOT"
Write-Host "  python (user env + hook pin): $hookPy"
Write-Host "  pygame: ok (generation deps; playback uses ffplay)"
Write-Host ""
Write-Host "Restart Cursor so hooks inherit CURSOR_HOOK_PYTHON (pin file works immediately)."
Write-Host "Smoke: pnpm run voice:cursor:read-last-response"
Write-Host "Stop:  pnpm run voice:cursor:stop"
Write-Host "Dry:   pnpm run voice:cursor:read-last-response:dry"
