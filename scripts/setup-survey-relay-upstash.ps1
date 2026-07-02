# Survey cloud relay — push Upstash + SURVEY_RELAY_SECRET to Vercel and .env.local
#
# Usage:
#   1. Create Upstash DB: https://console.upstash.com/redis
#   2. Copy REST URL + token from the database "REST API" tab
#   3. Run:
#        .\scripts\setup-survey-relay-upstash.ps1 `
#          -UpstashUrl "https://xxxx.upstash.io" `
#          -UpstashToken "AXxxxx"
#
# Or open Upstash first:
#        .\scripts\setup-survey-relay-upstash.ps1 -OpenConsole

param(
  [string]$UpstashUrl = "",
  [string]$UpstashToken = "",
  [string]$RelaySecret = "",
  [switch]$OpenConsole,
  [switch]$SkipVercel
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env.local"

function Read-DotEnvValue([string]$Name) {
  if (-not (Test-Path $EnvFile)) { return "" }
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)\s*$") {
      return $Matches[1].Trim().Trim('"')
    }
  }
  return ""
}

function Set-DotEnvValue([string]$Name, [string]$Value) {
  $lines = @()
  $found = $false
  if (Test-Path $EnvFile) {
    $lines = Get-Content $EnvFile
    $lines = $lines | ForEach-Object {
      if ($_ -match "^\s*$([regex]::Escape($Name))\s*=") {
        $found = $true
        "$Name=$Value"
      } else {
        $_
      }
    }
  }
  if (-not $found) {
    $lines += "$Name=$Value"
  }
  Set-Content -Path $EnvFile -Value $lines -Encoding utf8
}

function Push-VercelEnv([string]$Name, [string]$Value, [switch]$Sensitive) {
  foreach ($envName in @("production", "preview", "development")) {
    Write-Host "  vercel env add $Name $envName"
    $args = @("env", "add", $Name, $envName, "--yes")
    if ($Sensitive) { $args += "--sensitive" }
    $Value | vercel @args
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  retry with --force"
      $args = @("env", "add", $Name, $envName, "--yes", "--force")
      if ($Sensitive) { $args += "--sensitive" }
      $Value | vercel @args
    }
  }
}

if ($OpenConsole) {
  Start-Process "https://console.upstash.com/redis"
  Write-Host @"

Upstash setup (2 minutes)
-------------------------
1. Sign in / create account
2. Create Database → name: echo-mirage-survey-relay
3. Region: pick one near your Vercel app (e.g. US East)
4. Open the database → REST API tab
5. Copy:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN

Then run:
  .\scripts\setup-survey-relay-upstash.ps1 `
    -UpstashUrl "https://....upstash.io" `
    -UpstashToken "AX...."

"@
  exit 0
}

if (-not $UpstashUrl) { $UpstashUrl = Read-DotEnvValue "UPSTASH_REDIS_REST_URL" }
if (-not $UpstashToken) { $UpstashToken = Read-DotEnvValue "UPSTASH_REDIS_REST_TOKEN" }
if (-not $RelaySecret) { $RelaySecret = Read-DotEnvValue "SURVEY_RELAY_SECRET" }

if (-not $RelaySecret) {
  $RelaySecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  Write-Host "Generated SURVEY_RELAY_SECRET"
}

if (-not $UpstashUrl -or -not $UpstashToken) {
  Write-Host "Missing Upstash credentials."
  Write-Host "Run: .\scripts\setup-survey-relay-upstash.ps1 -OpenConsole"
  exit 1
}

Set-Location $Root
Set-DotEnvValue "UPSTASH_REDIS_REST_URL" $UpstashUrl
Set-DotEnvValue "UPSTASH_REDIS_REST_TOKEN" $UpstashToken
Set-DotEnvValue "SURVEY_RELAY_SECRET" $RelaySecret
Write-Host "Updated .env.local"

if (-not $SkipVercel) {
  Write-Host "Pushing to Vercel (loteknowledgs-projects/echo-mirage-cyberdeck)..."
  Push-VercelEnv "UPSTASH_REDIS_REST_URL" $UpstashUrl -Sensitive
  Push-VercelEnv "UPSTASH_REDIS_REST_TOKEN" $UpstashToken -Sensitive
  Push-VercelEnv "SURVEY_RELAY_SECRET" $RelaySecret -Sensitive
  Write-Host "Done. Redeploy Vercel: vercel --prod"
}

Write-Host @"

Echo Mac (Echo Satellite) — set the same relay secret when launching:
  `$env:SURVEY_RELAY_SECRET="$RelaySecret"

Then restart Echo Satellite and tap Send to Mirage.

"@
