# Step-by-step Mechanicus Cursor afterAgentResponse TTS probe.
# Run: pnpm run voice:cursor:debug
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$HookDir = Join-Path $Root ".cursor\hooks"
$HookJson = Join-Path $Root ".cursor\hooks.json"
$HookPy = Join-Path $HookDir "speak_last_sentence_mechanicus.py"
$SpeakPy = Join-Path $HookDir "speak_last_sentence_mechanicus.py"
$SampleJson = Join-Path $HookDir "sample-after-agent.json"
$HookLog = Join-Path $HookDir "mechanicus-hook.log"
$TtsLog = Join-Path $HookDir "mechanicus-tts-stderr.log"

$pass = 0
$fail = 0
$warn = 0

function Step([string]$Num, [string]$Label, [scriptblock]$Test) {
  Write-Host ""
  Write-Host "=== STEP $Num - $Label ===" -ForegroundColor Cyan
  try {
    $result = & $Test
    if ($result -eq $true) {
      $script:pass++
      Write-Host "PASS" -ForegroundColor Green
    } elseif ($result -eq $null -or $result -eq "warn") {
      $script:warn++
      Write-Host "WARN" -ForegroundColor Yellow
    } else {
      $script:fail++
      Write-Host "FAIL: $result" -ForegroundColor Red
    }
  } catch {
    $script:fail++
    Write-Host "FAIL: $_" -ForegroundColor Red
  }
}

Write-Host "Mechanicus Cursor voice - step debug"
Write-Host "Repo: $Root"

Step "1" "hooks.json afterAgentResponse" {
  if (-not (Test-Path $HookJson)) { return "missing $HookJson" }
  $j = Get-Content -Raw $HookJson | ConvertFrom-Json
  $hook = $j.hooks.afterAgentResponse[0].command
  Write-Host "  command: $hook"
  if ($hook -notmatch "run-speak-last-mechanicus") { return "unexpected hook command" }
  $true
}

Step "2" "Hook launcher + Python pin" {
  $launcher = Join-Path $HookDir "run-speak-last-mechanicus.ps1"
  if (-not (Test-Path $launcher)) { return "missing launcher" }
  $pin = Join-Path $HookDir "cursor-hook-python.txt"
  $py = $null
  if (Test-Path $pin) { $py = (Get-Content -Raw $pin).Trim() }
  if (-not $py) { $py = $env:CURSOR_HOOK_PYTHON }
  if (-not $py -or -not (Test-Path $py)) { return "no pinned Python (run pnpm run voice:cursor:enable-mechanicus)" }
  Write-Host "  python: $py"
  $ver = & $py --version 2>&1
  Write-Host "  version: $ver"
  if ($py -match "hermes") { return "Hermes python pinned - no pygame" }
  $true
}

Step "3" "pygame on pinned Python" {
  $py = (Get-Content -Raw (Join-Path $HookDir "cursor-hook-python.txt")).Trim()
  $out = & $py -c 'import pygame; print("pygame", pygame.version.ver)' 2>&1
  Write-Host "  $out"
  if ($LASTEXITCODE -ne 0) { return "pygame missing - run: $py -m pip install pygame" }
  $true
}

Step "4" "Samus voice_profile + mechanicus profile" {
  $samus = if ($env:SAMUS_MANUS_ROOT) { $env:SAMUS_MANUS_ROOT } else { "C:\dev\samus-manus" }
  $vp = Join-Path $samus "tools\voice_profile.py"
  if (-not (Test-Path $vp)) { return "missing $vp" }
  Write-Host "  voice_profile: $vp"
  $py = (Get-Content -Raw (Join-Path $HookDir "cursor-hook-python.txt")).Trim()
  $list = & $py $vp list 2>&1 | Out-String
  if ($list -notmatch "mechanicus-voice") { return "mechanicus-voice not in profile list" }
  Write-Host "  mechanicus-voice: registered"
  $true
}

Step "5" "Mute flag" {
  $mute = Join-Path $HookDir "mechanicus-cursor.muted"
  if (-not (Test-Path $mute)) {
    Write-Host "  no mute file (hook enabled)"
    return $true
  }
  $v = (Get-Content -Raw $mute).Trim()
  Write-Host "  mechanicus-cursor.muted = '$v'"
  if ($v -eq "1") { return "hook muted - delete file or set 0" }
  $true
}

Step "6" "plan-speak (extract last sentence)" {
  $py = (Get-Content -Raw (Join-Path $HookDir "cursor-hook-python.txt")).Trim()
  $env:CURSOR_HOOK_MECHANICUS_EXTRACT = "sentence"
  $payload = '{"text":"Alpha sentence. Beta sentence. Gamma wins."}'
  $planJson = $payload | & $py -u $SpeakPy --plan-speak
  if ($LASTEXITCODE -ne 0) { return "plan-speak exit $LASTEXITCODE" }
  $plan = $planJson | ConvertFrom-Json
  Write-Host "  skip: $($plan.skip) reason: $($plan.reason)"
  Write-Host "  snippet: $($plan.snippet)"
  if ($plan.skip) { return "plan skipped: $($plan.reason)" }
  if ($plan.snippet -ne "Gamma wins.") { return "expected 'Gamma wins.' got '$($plan.snippet)'" }
  $true
}

Step "7" "Windows SAPI speak (Cursor hook default)" {
  Write-Host "  Speaking: 'Debug step seven. You should hear this.'" -ForegroundColor Yellow
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.Volume = 100
  $s.Rate = -2
  foreach ($v in $s.GetInstalledVoices()) {
    if ($v.VoiceInfo.Name -match "David|Mark") { $s.SelectVoice($v.VoiceInfo.Name); break }
  }
  Write-Host "  voice: $($s.Voice.Name)"
  $s.Speak("Debug step seven. You should hear this.")
  $true
}

Step "7b" "Samus mechanicus + pygame (optional FX path)" {
  Write-Host "  mode=samus only; often silent when pygame/WASAPI fails" -ForegroundColor DarkYellow
  $py = (Get-Content -Raw (Join-Path $HookDir "cursor-hook-python.txt")).Trim()
  $samus = if ($env:SAMUS_MANUS_ROOT) { $env:SAMUS_MANUS_ROOT } else { "C:\dev\samus-manus" }
  $vp = Join-Path $samus "tools\voice_profile.py"
  Push-Location $samus
  & $py -u $vp speak mechanicus-voice -- "Samus pygame path. May be silent on this PC."
  $rc = $LASTEXITCODE
  Pop-Location
  Write-Host "  exit: $rc (audible only if pygame routes to your speakers)"
  "warn"
}

Step "8" "Full hook pipeline (sample JSON to launcher)" {
  if (-not (Test-Path $SampleJson)) { return "missing sample JSON" }
  Write-Host "  hook TTS mode: $($env:CURSOR_HOOK_TTS_MODE) (sapi=audible, samus=mechanicus FX via pygame)"
  Get-Content -Raw $SampleJson | powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $HookDir "run-speak-last-mechanicus.ps1")
  $rc = $LASTEXITCODE
  Write-Host "  hook exit: $rc"
  if ($rc -ne 0) { return "hook launcher exit $rc" }
  $true
}

Step "9" "Recent hook log tail" {
  if (-not (Test-Path $HookLog)) { return "warn"; "no hook log yet" }
  Write-Host "  --- mechanicus-hook.log (last 8 lines) ---"
  Get-Content $HookLog -Tail 8 | ForEach-Object { Write-Host "  $_" }
  "warn"
}

Write-Host ""
Write-Host "SUMMARY: $pass pass, $fail fail, $warn warn" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
if ($fail -eq 0) {
  Write-Host "If step 7/8 were audible but Cursor chat is not, the hook IS running - check Cursor project root is this repo."
} else {
  Write-Host "Fix FAIL steps above, then re-run: pnpm run voice:cursor:debug"
}
exit $(if ($fail -eq 0) { 0 } else { 1 })
