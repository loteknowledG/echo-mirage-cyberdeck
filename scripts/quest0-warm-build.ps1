# Quest 0 — warm build with utilization sampling
# Diagnostic only. Keeps .next/ intact.

$ErrorActionPreference = "Continue"
$root = "f:/dev/echo-mirage-cyberdeck"
$log = Join-Path $root ".tmp/quest0-warm-build.log"
$util = Join-Path $root ".tmp/quest0-warm-util.csv"
$repo = $root

function Write-Log([string]$line) {
  $line | Out-File $log -Append -Encoding utf8
  Write-Host $line
}

function Get-BuildStats {
  $nodes = Get-Process node -ErrorAction SilentlyContinue
  $peak = ($nodes | Measure-Object WorkingSet64 -Maximum).Maximum
  $cpu = ($nodes | Measure-Object CPU -Sum).Sum
  $count = @($nodes).Count
  [pscustomobject]@{
    Timestamp = (Get-Date).ToString("o")
    NodeCount = $count
    NodeCpuSum = [math]::Round($cpu, 2)
    PeakWorkingSetMB = if ($peak) { [math]::Round($peak / 1MB, 1) } else { 0 }
  }
}

"" | Out-File $log -Encoding utf8
Write-Log "=== Quest 0 WARM baseline started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Write-Log "Branch: $(git -C $repo branch --show-current)"
Write-Log "Commit: $(git -C $repo rev-parse --short HEAD)"
Write-Log "Node: $(node -v)"
Write-Log "pnpm (shell): $(pnpm -C $repo --version 2>&1 | Select-Object -Last 1)"
Write-Log "pnpm launcher: $(Get-Command pnpm | Select-Object -ExpandProperty Source)"
Write-Log ".next present: $(Test-Path (Join-Path $repo '.next'))"
Write-Log "BUILD_ID before: $(if (Test-Path (Join-Path $repo '.next/BUILD_ID')) { Get-Content (Join-Path $repo '.next/BUILD_ID') } else { 'none' })"
Write-Log "Command: pnpm exec next build --webpack"
Write-Log "webpack config.cache: false (production, per next.config.mjs)"

"Timestamp,NodeCount,NodeCpuSum,PeakWorkingSetMB" | Out-File $util -Encoding utf8

$sampler = Start-Job -ScriptBlock {
  param($utilPath)
  while ($true) {
    $nodes = Get-Process node -ErrorAction SilentlyContinue
    if ($nodes) {
      $peak = ($nodes | Measure-Object WorkingSet64 -Maximum).Maximum
      $cpu = ($nodes | Measure-Object CPU -Sum).Sum
      $count = @($nodes).Count
      $ts = (Get-Date).ToString("o")
      "$ts,$count,$([math]::Round($cpu,2)),$([math]::Round($peak/1MB,1))" | Out-File $utilPath -Append -Encoding utf8
    }
    Start-Sleep -Seconds 15
  }
} -ArgumentList $util

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Log "[next-build-warm] START $(Get-Date -Format o)"

Push-Location $repo
pnpm exec next build --webpack 2>&1 | Tee-Object -FilePath $log -Append
$exit = $LASTEXITCODE
Pop-Location

$sw.Stop()
Stop-Job $sampler -ErrorAction SilentlyContinue
Remove-Job $sampler -Force -ErrorAction SilentlyContinue

$sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
Write-Log "[next-build-warm] END ${sec}s exit=$exit"
Write-Log "BUILD_ID after: $(if (Test-Path (Join-Path $repo '.next/BUILD_ID')) { Get-Content (Join-Path $repo '.next/BUILD_ID') } else { 'none' })"

$utilRows = Import-Csv $util -ErrorAction SilentlyContinue
if ($utilRows) {
  $maxWs = ($utilRows | ForEach-Object { [double]$_.PeakWorkingSetMB } | Measure-Object -Maximum).Maximum
  $maxNodes = ($utilRows | ForEach-Object { [int]$_.NodeCount } | Measure-Object -Maximum).Maximum
  Write-Log "Utilization peak WorkingSet (sampled nodes): ${maxWs} MB"
  Write-Log "Utilization max node process count: $maxNodes"
}

Write-Log "=== WARM SUMMARY next_build=${sec}s exit=$exit ==="
