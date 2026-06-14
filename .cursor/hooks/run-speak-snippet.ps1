# Spawned by run-speak-last-mechanicus.ps1 — speak snippet audibly on Windows.
param(
  [Parameter(Mandatory = $true)]
  [string]$PlanPath
)

$ErrorActionPreference = "Stop"
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json

$HookPython = [string]$plan.python
$voiceProfilePath = [string]$plan.voiceProfilePath
$profile = [string]$plan.profile
$snippet = [string]$plan.snippet
$samusRoot = [string]$plan.samusRoot

if ($plan.env) {
  foreach ($prop in $plan.env.PSObject.Properties) {
    Set-Item -Path ("env:{0}" -f $prop.Name) -Value ([string]$prop.Value)
  }
}

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$mode = ($env:CURSOR_HOOK_TTS_MODE | ForEach-Object { "$_".Trim().ToLower() })
if (-not $mode) {
  $mode = "samus"
}

if (-not $env:BOOTUP_PLAYBACK) {
  $env:BOOTUP_PLAYBACK = if ($env:CURSOR_HOOK_BOOTUP_PLAYBACK) {
    $env:CURSOR_HOOK_BOOTUP_PLAYBACK
  } else {
    "ffplay"
  }
}

function Invoke-CursorHookSapiSpeak {
  param(
    [string]$Text,
    [string]$ProfileId
  )
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.Volume = 100
  $synth.Rate = -2

  $prefer = switch -Regex ($ProfileId) {
    "mechanicus" { "David|Mark|Guy" }
    "warp" { "Guy|David|Mark" }
    "codex" { "David|Mark|Zira" }
    default { "David|Zira|Mark" }
  }

  foreach ($voice in $synth.GetInstalledVoices()) {
    $name = $voice.VoiceInfo.Name
    if ($name -match $prefer) {
      $synth.SelectVoice($name)
      break
    }
  }

  Write-Host "[CURSOR-HOOK] SAPI voice: $($synth.Voice.Name)"
  Write-Host "[CURSOR-HOOK] Speaking: $Text"
  $synth.Speak($Text)
}

if ($mode -eq "sapi") {
  Invoke-CursorHookSapiSpeak -Text $snippet -ProfileId $profile
  exit 0
}

Set-Location $samusRoot
& $HookPython -u $voiceProfilePath speak $profile -- $snippet
$rc = $LASTEXITCODE

if ($rc -ne 0 -and $mode -ne "samus") {
  Write-Host "[CURSOR-HOOK] Samus speak failed (exit $rc); falling back to SAPI"
  Invoke-CursorHookSapiSpeak -Text $snippet -ProfileId $profile
  exit 0
}

if ($mode -eq "samus-then-sapi") {
  Invoke-CursorHookSapiSpeak -Text $snippet -ProfileId $profile
}

exit $rc
