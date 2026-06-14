# Cursor afterAgentResponse — speak last reply via Samus mechanicus-voice.
# Windows: plan in Python, speak via Start-Process (breaks out of Cursor's silent audio session).
$ErrorActionPreference = "Stop"
$HookDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HookPy = Join-Path $HookDir "speak_last_sentence_mechanicus.py"
$TtsLog = Join-Path $HookDir "mechanicus-tts-stderr.log"
$HookLog = Join-Path $HookDir "mechanicus-hook.log"

function Write-HookLog([string]$Message) {
  $line = "{0} ps1: {1}" -f (Get-Date -Format "yyyy-MM-ddTHH:mm:ss"), $Message
  Add-Content -Path $HookLog -Value $line -Encoding utf8
}

if (-not $env:SAMUS_MANUS_ROOT) {
  $env:SAMUS_MANUS_ROOT = "C:\dev\samus-manus"
}

function Resolve-MuthurHookPython {
  if ($env:CURSOR_HOOK_PYTHON -and (Test-Path $env:CURSOR_HOOK_PYTHON)) {
    return $env:CURSOR_HOOK_PYTHON
  }
  $pinFile = Join-Path $HookDir "cursor-hook-python.txt"
  if (Test-Path $pinFile) {
    $pinned = (Get-Content -Raw $pinFile).Trim()
    if ($pinned -and (Test-Path $pinned)) {
      return $pinned
    }
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
  return "python"
}

$HookPython = Resolve-MuthurHookPython
$env:CURSOR_HOOK_PYTHON = $HookPython
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

if (-not $env:CURSOR_HOOK_MECHANICUS_EXTRACT) {
  $env:CURSOR_HOOK_MECHANICUS_EXTRACT = "full"
}
if (-not $env:CURSOR_HOOK_TTS_MODE) {
  $env:CURSOR_HOOK_TTS_MODE = "samus"
}
if (-not $env:CURSOR_HOOK_BOOTUP_PLAYBACK) {
  $env:CURSOR_HOOK_BOOTUP_PLAYBACK = "ffplay"
}
$env:CURSOR_HOOK_MECHANICUS_LAST_SENTENCE = "1"
$env:CURSOR_HOOK_MECHANICUS_WAIT = "1"

Set-Content -Path (Join-Path $HookDir "cursor-tts-voice.txt") -Value "mechanicus-voice" -NoNewline
$mutePath = Join-Path $HookDir "mechanicus-cursor.muted"
if (Test-Path $mutePath) {
  Set-Content -Path $mutePath -Value "0"
}

$stdin = [Console]::In.ReadToEnd()
if (-not $stdin.Trim()) {
  Write-HookLog "empty stdin"
  exit 0
}

$planJson = $stdin | & $HookPython -u $HookPy --plan-speak
if ($LASTEXITCODE -ne 0) {
  Write-HookLog "plan-speak failed exit=$LASTEXITCODE"
  exit $LASTEXITCODE
}

try {
  $plan = $planJson | ConvertFrom-Json
} catch {
  Write-HookLog "plan JSON parse failed: $_"
  exit 0
}

if ($plan.skip) {
  Write-HookLog "skip reason=$($plan.reason)"
  exit 0
}

$snippet = [string]$plan.snippet
$profile = [string]$plan.profile
$voiceProfilePath = [string]$plan.voiceProfilePath
$samusRoot = [string]$plan.samusRoot
if (-not $samusRoot) { $samusRoot = $env:SAMUS_MANUS_ROOT }

if ($plan.env) {
  foreach ($prop in $plan.env.PSObject.Properties) {
    Set-Item -Path ("env:{0}" -f $prop.Name) -Value ([string]$prop.Value)
  }
}

$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$planPath = Join-Path $HookDir ("tts-plan-{0}.json" -f (Get-Date -Format "yyyyMMddHHmmss"))
$planFile = [ordered]@{
  skip           = $false
  snippet        = $snippet
  profile        = $profile
  voiceProfilePath = $voiceProfilePath
  samusRoot      = $samusRoot
  python         = $HookPython
  env            = $plan.env
}
$planFile | ConvertTo-Json -Depth 6 | Set-Content -Path $planPath -Encoding utf8

$outLog = Join-Path $HookDir ("mechanicus-tts-out-{0}.log" -f (Get-Date -Format "yyyyMMddHHmmss"))
$errLog = Join-Path $HookDir ("mechanicus-tts-err-{0}.log" -f (Get-Date -Format "yyyyMMddHHmmss"))
try {
  Add-Content -Path $TtsLog -Value "`n--- TTS start-process $stamp ---" -Encoding utf8 -ErrorAction Stop
} catch {
  Write-HookLog "tts log busy; continuing with per-run logs only"
}

Write-HookLog "speak extract=$($env:CURSOR_HOOK_MECHANICUS_EXTRACT) profile=$profile snippet_len=$($snippet.Length) snippet=$($snippet.Substring(0, [Math]::Min(120, $snippet.Length))) python=$HookPython"

$speakScript = Join-Path $HookDir "run-speak-snippet.ps1"
$pidFile = Join-Path $HookDir "mechanicus-tts.pid"

try {
  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", $speakScript,
      "-PlanPath", $planPath
    ) `
    -WorkingDirectory $HookDir `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog
  Set-Content -Path $pidFile -Value $proc.Id -NoNewline -Encoding ascii
  $proc.WaitForExit()
  $rc = $proc.ExitCode
} catch {
  Write-HookLog "Start-Process failed: $_"
  exit 1
} finally {
  Remove-Item $planPath -Force -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $outLog) {
  $outTail = Get-Content -Raw $outLog -ErrorAction SilentlyContinue
  if ($outTail -and $outTail.Trim()) {
    $preview = $outTail.Trim().Replace("`r", " ").Replace("`n", " | ")
    if ($preview.Length -gt 240) { $preview = $preview.Substring(0, 240) + "…" }
    Write-HookLog "tts stdout: $preview"
  }
  try {
    Get-Content -Raw $outLog | Add-Content -Path $TtsLog -Encoding utf8 -ErrorAction Stop
  } catch {
    Write-HookLog "skipped merging stdout log (file busy)"
  }
  Remove-Item $outLog -Force -ErrorAction SilentlyContinue
}
if (Test-Path $errLog) {
  $errTail = Get-Content -Raw $errLog -ErrorAction SilentlyContinue
  if ($errTail -and $errTail.Trim()) {
    try {
      Add-Content -Path $TtsLog -Value $errTail -Encoding utf8 -ErrorAction Stop
    } catch {
      Write-HookLog "skipped merging stderr log (file busy)"
    }
  }
  Remove-Item $errLog -Force -ErrorAction SilentlyContinue
}

Write-HookLog "speak exit=$rc"
exit $rc
