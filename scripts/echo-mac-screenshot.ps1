<#
.SYNOPSIS
  Capture primary display on Echo Mac Satellite over Tailscale.
#>
param(
  [string]$EchoHost = "100.70.46.6",
  [int]$Port = 3050,
  [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutPath) {
  $OutPath = Join-Path $root "echo-mac-screenshot.png"
}

$health = Invoke-WebRequest "http://${EchoHost}:${Port}/health" -UseBasicParsing -TimeoutSec 5
if ($health.StatusCode -ne 200) {
  throw "Echo health failed HTTP $($health.StatusCode) at ${EchoHost}:${Port}"
}

$r = Invoke-RestMethod `
  -Uri "http://${EchoHost}:${Port}/api/survey/echo/command" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"action":"echo.screenshot"}' `
  -TimeoutSec 90

if (-not $r.ok -or -not $r.pngBase64) {
  throw ("screenshot failed: " + ($r | ConvertTo-Json -Compress -Depth 6))
}

[IO.File]::WriteAllBytes($OutPath, [Convert]::FromBase64String($r.pngBase64))
Write-Host "OK $($r.width)x$($r.height) -> $OutPath ($((Get-Item $OutPath).Length) bytes)"
