# Quest 0 — warm build under portable Node 22.13.1 with utilization sampling
# Diagnostic only. Keeps .next/ intact.

$ErrorActionPreference = "Continue"
$root = "f:/dev/echo-mirage-cyberdeck"
$node22 = Join-Path $root ".tmp/quest0-node22/node-v22.13.1-win-x64/node.exe"
$log = Join-Path $root ".tmp/quest0-node22-warm-build.log"
$util = Join-Path $root ".tmp/quest0-node22-warm-util.csv"
$repo = $root

if (-not (Test-Path $node22)) {
  Write-Error "Missing portable Node 22 at $node22"
  exit 1
}

function Write-Log([string]$line) {
  $line | Out-File $log -Append -Encoding utf8
  Write-Host $line
}

"" | Out-File $log -Encoding utf8
Write-Log "=== Quest 0 NODE22 WARM baseline started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
Write-Log "Branch: $(git -C $repo branch --show-current)"
Write-Log "Commit: $(git -C $repo rev-parse --short HEAD)"
Write-Log "Shell node: $(node -v) at $(Get-Command node | Select-Object -ExpandProperty Source)"
Write-Log "Build node: $(& $node22 -v) at $node22"
Write-Log "pnpm (shell): $(pnpm -C $repo --version 2>&1 | Select-Object -Last 1)"
Write-Log "pnpm launcher: $(Get-Command pnpm | Select-Object -ExpandProperty Source)"
Write-Log ".next present: $(Test-Path (Join-Path $repo '.next'))"
Write-Log "BUILD_ID before: $(if (Test-Path (Join-Path $repo '.next/BUILD_ID')) { Get-Content (Join-Path $repo '.next/BUILD_ID') } else { 'none' })"
Write-Log "F: drive: USB HDD PRO X Avolusion (see build-baseline.md)"
Write-Log "Command: pnpm exec next build --webpack (PATH prepends portable Node 22 dir)"

"Timestamp,NodeCount,NodeCpuSum,PeakWorkingSetMB,Node22Count" | Out-File $util -Encoding utf8

$sampler = Start-Job -ScriptBlock {
  param($utilPath, $node22Path)
  while ($true) {
    $nodes = Get-Process node -ErrorAction SilentlyContinue
    if ($nodes) {
      $peak = ($nodes | Measure-Object WorkingSet64 -Maximum).Maximum
      $cpu = ($nodes | Measure-Object CPU -Sum).Sum
      $count = @($nodes).Count
      $n22 = @($nodes | Where-Object { $_.Path -eq $node22Path }).Count
      $ts = (Get-Date).ToString("o")
      "$ts,$count,$([math]::Round($cpu,2)),$([math]::Round($peak/1MB,1)),$n22" | Out-File $utilPath -Append -Encoding utf8
    }
    Start-Sleep -Seconds 15
  }
} -ArgumentList $util, $node22

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Log "[next-build-node22-warm] START $(Get-Date -Format o)"

Push-Location $repo
$node22Dir = Split-Path $node22 -Parent
$oldPath = $env:PATH
$env:PATH = "$node22Dir;$oldPath"
Write-Log "Effective node on PATH: $(Get-Command node | Select-Object -ExpandProperty Source) ($(& (Get-Command node).Source -v))"
pnpm exec next build --webpack 2>&1 | Tee-Object -FilePath $log -Append
$exit = $LASTEXITCODE
$env:PATH = $oldPath
Pop-Location

$sw.Stop()
Stop-Job $sampler -ErrorAction SilentlyContinue
Remove-Job $sampler -Force -ErrorAction SilentlyContinue

$sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
Write-Log "[next-build-node22-warm] END ${sec}s exit=$exit"
Write-Log "BUILD_ID after: $(if (Test-Path (Join-Path $repo '.next/BUILD_ID')) { Get-Content (Join-Path $repo '.next/BUILD_ID') } else { 'none' })"

$utilRows = Import-Csv $util -ErrorAction SilentlyContinue
if ($utilRows) {
  $maxWs = ($utilRows | ForEach-Object { [double]$_.PeakWorkingSetMB } | Measure-Object -Maximum).Maximum
  $maxNodes = ($utilRows | ForEach-Object { [int]$_.NodeCount } | Measure-Object -Maximum).Maximum
  $maxN22 = ($utilRows | ForEach-Object { [int]$_.Node22Count } | Measure-Object -Maximum).Maximum
  Write-Log "Utilization peak WorkingSet (sampled nodes): ${maxWs} MB"
  Write-Log "Utilization max node process count: $maxNodes"
  Write-Log "Utilization max Node22 process count: $maxN22"
}

Write-Log "=== NODE22 WARM SUMMARY next_build=${sec}s exit=$exit ==="
