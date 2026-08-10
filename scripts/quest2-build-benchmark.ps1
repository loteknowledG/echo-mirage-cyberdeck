# Quest 2 — standardized production build benchmark (NVMe only)
# One variable per run. Records wall time, trace phases, utilization, cache size.

param(
  [Parameter(Mandatory)][string]$Label,
  [switch]$ClearDotNext,
  [switch]$ClearWebpackCacheOnly
)

$ErrorActionPreference = "Continue"
$root = "C:/dev/echo-mirage-cyberdeck"
$repo = $root
$resultsDir = Join-Path $root "docs/engineering/quest2-results"
$log = Join-Path $resultsDir "$Label.log"
$util = Join-Path $resultsDir "$Label-util.csv"
$summaryPath = Join-Path $resultsDir "$Label-summary.json"

New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

function Get-CacheBytes {
  $paths = @(
    (Join-Path $repo ".next/cache"),
    (Join-Path $repo ".next/cache/webpack"),
    (Join-Path $repo "node_modules/.cache")
  )
  $total = 0
  foreach ($p in $paths) {
    if (Test-Path $p) {
      $total += (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    }
  }
  [math]::Round($total / 1MB, 1)
}

function Write-Log([string]$line) {
  $line | Out-File $log -Append -Encoding utf8
  Write-Host $line
}

if ($ClearDotNext -and (Test-Path (Join-Path $repo ".next"))) {
  Remove-Item (Join-Path $repo ".next") -Recurse -Force
  Write-Host "Cleared .next"
}
if ($ClearWebpackCacheOnly) {
  $wp = Join-Path $repo ".next/cache/webpack"
  if (Test-Path $wp) { Remove-Item $wp -Recurse -Force; Write-Host "Cleared webpack cache dir" }
}

"" | Out-File $log -Encoding utf8
Write-Log "=== Quest 2 benchmark: $Label $(Get-Date -Format o) ==="
Write-Log "Branch: $(git -C $repo branch --show-current)"
Write-Log "Commit: $(git -C $repo rev-parse --short HEAD)"
Write-Log "Node: $(node -v)"
Write-Log "Cache MB before: $(Get-CacheBytes)"
Write-Log "Command: pnpm exec next build --webpack"

"Timestamp,NodeCount,NodeCpuSum,PeakWorkingSetMB" | Out-File $util -Encoding utf8

$sampler = Start-Job -ScriptBlock {
  param($utilPath)
  while ($true) {
    $nodes = Get-Process node -ErrorAction SilentlyContinue
    if ($nodes) {
      $peak = ($nodes | Measure-Object WorkingSet64 -Maximum).Maximum
      $cpu = ($nodes | Measure-Object CPU -Sum).Sum
      $count = @($nodes).Count
      "$((Get-Date).ToString('o')),$count,$([math]::Round($cpu,2)),$([math]::Round($peak/1MB,1))" | Out-File $utilPath -Append -Encoding utf8
    }
    Start-Sleep -Seconds 15
  }
} -ArgumentList $util

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location $repo
pnpm exec next build --webpack 2>&1 | Tee-Object -FilePath $log -Append
$exit = $LASTEXITCODE
Pop-Location
$sw.Stop()

Stop-Job $sampler -ErrorAction SilentlyContinue
Remove-Job $sampler -Force -ErrorAction SilentlyContinue

$sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
$phases = @{}
$tracePath = Join-Path $repo ".next/trace-build"
if (Test-Path $tracePath) {
  $trace = Get-Content $tracePath -Raw | ConvertFrom-Json
  foreach ($entry in $trace) { $phases[$entry.name] = [math]::Round($entry.duration / 1000000, 1) }
}

$utilRows = Import-Csv $util -ErrorAction SilentlyContinue
$maxWs = 0; $maxNodes = 0
if ($utilRows) {
  $maxWs = ($utilRows | ForEach-Object { [double]$_.PeakWorkingSetMB } | Measure-Object -Maximum).Maximum
  $maxNodes = ($utilRows | ForEach-Object { [int]$_.NodeCount } | Measure-Object -Maximum).Maximum
}

$summary = [ordered]@{
  label = $Label
  wall_seconds = $sec
  exit_code = $exit
  cache_mb_after = (Get-CacheBytes)
  peak_working_set_mb = $maxWs
  max_node_count = $maxNodes
  build_id = if (Test-Path (Join-Path $repo ".next/BUILD_ID")) { (Get-Content (Join-Path $repo ".next/BUILD_ID") -Raw).Trim() } else { $null }
  phases = $phases
  log = $log
  util = $util
}

($summary | ConvertTo-Json -Depth 4) | Out-File $summaryPath -Encoding utf8
Write-Log "=== SUMMARY $Label wall=${sec}s exit=$exit cache_mb=$($summary.cache_mb_after) ==="
if ($exit -ne 0) { exit $exit }
