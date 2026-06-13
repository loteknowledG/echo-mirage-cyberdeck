# Cursor afterAgentResponse — speak full last reply via Samus mechanicus-voice.
$ErrorActionPreference = "Stop"
$HookDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $env:SAMUS_MANUS_ROOT) {
  $env:SAMUS_MANUS_ROOT = "C:\dev\samus-manus"
}
$env:CURSOR_HOOK_MECHANICUS_EXTRACT = "full"
$env:CURSOR_HOOK_MECHANICUS_LAST_SENTENCE = "1"
$env:CURSOR_HOOK_MECHANICUS_WAIT = "1"

Set-Content -Path (Join-Path $HookDir "cursor-tts-voice.txt") -Value "mechanicus-voice" -NoNewline
$mutePath = Join-Path $HookDir "mechanicus-cursor.muted"
if (Test-Path $mutePath) {
  Set-Content -Path $mutePath -Value "0"
}

$stdin = [Console]::In.ReadToEnd()
$stdin | python -u (Join-Path $HookDir "speak_last_sentence_mechanicus.py")
exit $LASTEXITCODE
