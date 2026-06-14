# Stop in-flight Cursor hook TTS (Samus/ffplay, SAPI, or long full-reply reads).
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$HookDir = Join-Path $Root ".cursor\hooks"
$PidFile = Join-Path $HookDir "mechanicus-tts.pid"
$HookLog = Join-Path $HookDir "mechanicus-hook.log"

function Write-HookLog([string]$Message) {
  $line = "{0} stop: {1}" -f (Get-Date -Format "yyyy-MM-ddTHH:mm:ss"), $Message
  try {
    Add-Content -Path $HookLog -Value $line -Encoding utf8
  } catch {
    Write-Host $line
  }
}

function Stop-ProcessTree([int]$ProcessId, [string]$Label) {
  if ($ProcessId -le 4) { return $false }
  $out = & taskkill.exe /PID $ProcessId /T /F 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  stopped $Label pid=$ProcessId"
    return $true
  }
  return $false
}

$stopped = @()

if (Test-Path $PidFile) {
  $rawPid = (Get-Content -Raw $PidFile -ErrorAction SilentlyContinue).Trim()
  if ($rawPid -match '^\d+$') {
    if (Stop-ProcessTree ([int]$rawPid) "hook-speak-tree") {
      $stopped += "tree:$rawPid"
    }
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

foreach ($proc in Get-Process -Name ffplay -ErrorAction SilentlyContinue) {
  try {
    Stop-Process -Id $proc.Id -Force -ErrorAction Stop
    $stopped += "ffplay:$($proc.Id)"
    Write-Host "  stopped ffplay pid=$($proc.Id)"
  } catch {
    Write-Host "  ffplay pid=$($proc.Id): $_"
  }
}

foreach ($proc in Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue) {
  $cmd = [string]$proc.CommandLine
  if ($cmd -notmatch 'voice_profile\.py' -and $cmd -notmatch 'say_bootup_voice\.py') { continue }
  if ($cmd -match 'voice_profile\.py' -and $cmd -notmatch '\sspeak\s') { continue }
  if (Stop-ProcessTree ([int]$proc.ProcessId) "python-tts") {
    $stopped += "python:$($proc.ProcessId)"
  }
}

foreach ($proc in Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue) {
  $cmd = [string]$proc.CommandLine
  if ($cmd -notmatch 'run-speak-snippet\.ps1' -and $cmd -notmatch 'run-speak-last-mechanicus\.ps1') { continue }
  if ($cmd -notmatch $HookDir) { continue }
  if (Stop-ProcessTree ([int]$proc.ProcessId) "hook-powershell") {
    $stopped += "powershell:$($proc.ProcessId)"
  }
}

if ($stopped.Count -eq 0) {
  Write-Host "No active Cursor hook voice processes found."
  Write-HookLog "stop: nothing running"
  exit 0
}

Write-Host "Voice stop complete ($($stopped.Count) target(s))."
Write-HookLog "stop: $($stopped -join ', ')"
exit 0
