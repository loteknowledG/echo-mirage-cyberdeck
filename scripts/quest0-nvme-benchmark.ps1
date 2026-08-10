# Quest 0 — NVMe controlled cold/warm benchmark
# Diagnostic only. Preserves copy at $NvmeRoot until manually removed.
# Does NOT use robocopy /MIR.

param(
  [ValidateSet("setup", "cold", "warm", "all")]
  [string]$Phase = "all"
)

$ErrorActionPreference = "Continue"
$SourceRepo = "F:\dev\echo-mirage-cyberdeck"
$SourceRealmorphism = "F:\dev\realmorphism"
$ExpectedCommit = "b219c91a99667c62361349d54a03cec5fc557da4"
$NvmeRoot = "C:\temp\quest0-nvme-echo-mirage-b219c91"
$NvmeRepo = Join-Path $NvmeRoot "echo-mirage-cyberdeck"
$NvmeRealmorphism = Join-Path $NvmeRoot "realmorphism"
$ManifestPath = Join-Path $NvmeRoot "quest0-nvme-manifest.json"
$DefenderLog = Join-Path $NvmeRoot "quest0-nvme-defender.txt"

function Write-Step([string]$msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  $line | Out-File (Join-Path $NvmeRoot "quest0-nvme-orchestrator.log") -Append -Encoding utf8
}

function Get-FileSha256([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-SourceManifest() {
  $files = @(
    "pnpm-lock.yaml",
    "package.json",
    "next.config.mjs",
    "tsconfig.json",
    "vercel.json"
  )
  $hashes = @{}
  foreach ($f in $files) {
    $p = Join-Path $SourceRepo $f
    if (Test-Path $p) { $hashes[$f] = Get-FileSha256 $p }
  }
  $hashes["git_head"] = (git -C $SourceRepo rev-parse HEAD).Trim()
  $hashes["git_short"] = (git -C $SourceRepo rev-parse --short HEAD).Trim()
  $hashes
}

function Record-DefenderState([string]$Label, [string]$Path) {
  $mp = Get-MpComputerStatus
  @(
    "=== Defender snapshot: $Label ===",
    "Timestamp: $(Get-Date -Format o)",
    "Path context: $Path",
    "RealTimeProtectionEnabled: $($mp.RealTimeProtectionEnabled)",
    "AntivirusEnabled: $($mp.AntivirusEnabled)",
    "AMServiceEnabled: $($mp.AMServiceEnabled)",
    "NISEnabled: $($mp.NISEnabled)",
    "ExclusionPath: (admin required - not readable without elevation)",
    ""
  ) | Out-File $DefenderLog -Append -Encoding utf8
}

function Assert-NoConcurrentBuilds() {
  $heavy = Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*nodejs*" -and $_.WorkingSet64 -gt 200MB }
  if ($heavy) {
    $n = @($heavy).Count
    throw "Concurrent Node build detected ($n node processes over 200MB WS). Stop other builds first."
  }
}

function Invoke-NvmeSetup {
  Assert-NoConcurrentBuilds
  New-Item -ItemType Directory -Force -Path $NvmeRoot | Out-Null
  "" | Out-File (Join-Path $NvmeRoot "quest0-nvme-orchestrator.log") -Encoding utf8

  $head = (git -C $SourceRepo rev-parse HEAD).Trim()
  if ($head -ne $ExpectedCommit) {
    throw "Source HEAD is $head; expected $ExpectedCommit"
  }

  Write-Step "Recording Defender state (F: source + C: NVMe target)"
  Record-DefenderState "F-source-before-copy" $SourceRepo
  Record-DefenderState "C-nvme-before-copy" $NvmeRoot

  $manifest = @{
    created_at = (Get-Date).ToString("o")
    expected_commit = $ExpectedCommit
    source_repo = $SourceRepo
    nvme_root = $NvmeRoot
    nvme_repo = $NvmeRepo
    toolchain = @{
      node = (node -v)
      node_path = (Get-Command node).Source
      pnpm = (pnpm -C $SourceRepo --version 2>&1 | Select-Object -Last 1)
      pnpm_launcher = (Get-Command pnpm).Source
    }
    source_hashes = Get-SourceManifest
    copy_policy = @{
      node_modules = "copied from F: (not reinstalled)"
      dot_next = "excluded - cold build will create"
      env_local = "copied if present"
      realmorphism = "copied src+package.json only (sibling layout preserved)"
      robocopy_mir = $false
    }
  }

  Write-Step "Copying echo-mirage-cyberdeck to NVMe (excluding .next, .tmp) - no /MIR"
  New-Item -ItemType Directory -Force -Path $NvmeRepo | Out-Null
  $robolog = Join-Path $NvmeRoot "quest0-nvme-robocopy-repo.log"
  & robocopy $SourceRepo $NvmeRepo /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XD .next .tmp /NP /NDL /NFL /LOG:$robolog | Out-Null
  $rc = $LASTEXITCODE
  if ($rc -ge 8) { throw "robocopy repo failed with exit $rc" }
  Write-Step "robocopy repo exit=$rc (0-7 success/partial)"

  Write-Step "Copying realmorphism sibling (src + package manifests only)"
  New-Item -ItemType Directory -Force -Path $NvmeRealmorphism | Out-Null
  foreach ($item in @("package.json", "tsconfig.json", "tsconfig.build.json")) {
    $sp = Join-Path $SourceRealmorphism $item
    if (Test-Path $sp) { Copy-Item $sp (Join-Path $NvmeRealmorphism $item) -Force }
  }
  if (Test-Path (Join-Path $SourceRealmorphism "src")) {
    & robocopy (Join-Path $SourceRealmorphism "src") (Join-Path $NvmeRealmorphism "src") /E /COPY:DAT /R:2 /W:2 /NP /NDL /NFL | Out-Null
  }

  $envSrc = Join-Path $SourceRepo ".env.local"
  if (Test-Path $envSrc) {
    Copy-Item $envSrc (Join-Path $NvmeRepo ".env.local") -Force
    $manifest.copy_policy.env_local = "copied from source"
    Write-Step "Copied .env.local"
  } else {
    $manifest.copy_policy.env_local = "absent on source - none copied"
    Write-Step "No .env.local on source"
  }

  if (Test-Path (Join-Path $NvmeRepo ".next")) {
    Remove-Item (Join-Path $NvmeRepo ".next") -Recurse -Force
    Write-Step "Removed any copied .next - cold start enforced"
  }

  Write-Step "Verifying lockfile and config hashes on NVMe copy"
  $destHashes = @{}
  foreach ($f in $manifest.source_hashes.Keys) {
    if ($f -match "^git_") { continue }
    $dp = Join-Path $NvmeRepo $f
    $destHashes[$f] = Get-FileSha256 $dp
    if ($manifest.source_hashes[$f] -ne $destHashes[$f]) {
      throw "Hash mismatch for $f"
    }
  }
  $manifest.dest_hashes = $destHashes
  $manifest.nvme_head = (git -C $NvmeRepo rev-parse HEAD 2>$null)
  if ($manifest.nvme_head -ne $ExpectedCommit) {
    Write-Step "WARN: NVMe git HEAD $($manifest.nvme_head) - verifying file hashes instead"
  }

  $manifest | ConvertTo-Json -Depth 6 | Out-File $ManifestPath -Encoding utf8
  Write-Step "Manifest written: $ManifestPath"
  Write-Step "Setup complete. node_modules=copied .next=absent realmorphism=sibling"
}

function Invoke-NvmeBuild {
  param(
    [Parameter(Mandatory)][ValidateSet("cold", "warm")][string]$Mode
  )

  Assert-NoConcurrentBuilds
  if (-not (Test-Path $NvmeRepo)) { throw "NVMe copy missing - run -Phase setup first" }

  $log = Join-Path $NvmeRepo ".tmp\quest0-nvme-${Mode}-build.log"
  $util = Join-Path $NvmeRepo ".tmp\quest0-nvme-${Mode}-util.csv"
  $traceCopy = Join-Path $NvmeRoot "quest0-nvme-${Mode}-trace-build.json"
  New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

  function Write-Log([string]$line) {
    $line | Out-File $log -Append -Encoding utf8
    Write-Host $line
  }

  if ($Mode -eq "cold" -and (Test-Path (Join-Path $NvmeRepo ".next"))) {
    Remove-Item (Join-Path $NvmeRepo ".next") -Recurse -Force
    Write-Log "Removed .next for cold run"
  }
  if ($Mode -eq "warm" -and -not (Test-Path (Join-Path $NvmeRepo ".next"))) {
    throw "Warm run requires .next from prior cold build"
  }

  Record-DefenderState "C-nvme-before-$Mode-build" $NvmeRepo

  "" | Out-File $log -Encoding utf8
  Write-Log "=== Quest 0 NVMe $Mode build $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
  Write-Log "NVMe root: $NvmeRoot"
  Write-Log "Repo: $NvmeRepo"
  Write-Log "Commit expected: $ExpectedCommit"
  Write-Log "Commit actual: $(git -C $NvmeRepo rev-parse HEAD 2>$null)"
  Write-Log "Node: $(node -v) at $(Get-Command node).Source"
  Write-Log "pnpm: $(pnpm -C $NvmeRepo --version 2>&1 | Select-Object -Last 1)"
  Write-Log "Drive: C: NVMe MSI M371 1TB"
  Write-Log "Defender RealTime: $((Get-MpComputerStatus).RealTimeProtectionEnabled)"
  Write-Log "node_modules: copied (not reinstalled)"
  Write-Log ".next before: $(if (Test-Path (Join-Path $NvmeRepo '.next/BUILD_ID')) { Get-Content (Join-Path $NvmeRepo '.next/BUILD_ID') } else { 'none' })"
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
        $ts = (Get-Date).ToString("o")
        "$ts,$count,$([math]::Round($cpu,2)),$([math]::Round($peak/1MB,1))" | Out-File $utilPath -Append -Encoding utf8
      }
      Start-Sleep -Seconds 15
    }
  } -ArgumentList $util

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Write-Log "[next-build-nvme-$Mode] START $(Get-Date -Format o)"

  Push-Location $NvmeRepo
  pnpm exec next build --webpack 2>&1 | Tee-Object -FilePath $log -Append
  $exit = $LASTEXITCODE
  Pop-Location

  $sw.Stop()
  Stop-Job $sampler -ErrorAction SilentlyContinue
  Remove-Job $sampler -Force -ErrorAction SilentlyContinue

  $sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  Write-Log "[next-build-nvme-$Mode] END ${sec}s exit=$exit"
  Write-Log "BUILD_ID after: $(if (Test-Path (Join-Path $NvmeRepo '.next/BUILD_ID')) { Get-Content (Join-Path $NvmeRepo '.next/BUILD_ID') } else { 'none' })"

  $utilRows = Import-Csv $util -ErrorAction SilentlyContinue
  $maxWs = 0; $maxNodes = 0
  if ($utilRows) {
    $maxWs = ($utilRows | ForEach-Object { [double]$_.PeakWorkingSetMB } | Measure-Object -Maximum).Maximum
    $maxNodes = ($utilRows | ForEach-Object { [int]$_.NodeCount } | Measure-Object -Maximum).Maximum
    Write-Log "Utilization peak WorkingSet: ${maxWs} MB"
    Write-Log "Utilization max node count: $maxNodes"
  }

  $tracePath = Join-Path $NvmeRepo ".next/trace-build"
  $phases = @{}
  if (Test-Path $tracePath) {
    Copy-Item $tracePath $traceCopy -Force
    $trace = Get-Content $tracePath -Raw | ConvertFrom-Json
    foreach ($entry in $trace) {
      $phases[$entry.name] = [math]::Round($entry.duration / 1000000, 1)
    }
    Write-Log "Trace run-webpack: $($phases['run-webpack'])s"
    Write-Log "Trace run-typescript: $($phases['run-typescript'])s"
    Write-Log "Trace collect-build-traces: $($phases['collect-build-traces'])s"
    Write-Log "Trace next-build: $($phases['next-build'])s"
  }

  $summary = Join-Path $NvmeRoot "quest0-nvme-${Mode}-summary.json"
  @{
    mode = $Mode
    wall_seconds = $sec
    exit_code = $exit
    peak_working_set_mb = $maxWs
    max_node_count = $maxNodes
    build_id_after = if (Test-Path (Join-Path $NvmeRepo ".next/BUILD_ID")) { Get-Content (Join-Path $NvmeRepo ".next/BUILD_ID") } else { $null }
    phases = $phases
    log = $log
    util = $util
    trace_copy = $traceCopy
  } | ConvertTo-Json -Depth 4 | Out-File $summary -Encoding utf8

  Write-Log "=== NVMe $Mode SUMMARY next_build=${sec}s exit=$exit ==="
  if ($exit -ne 0) { throw "Build failed with exit $exit" }
}

switch ($Phase) {
  "setup" { Invoke-NvmeSetup }
  "cold"  { Invoke-NvmeBuild -Mode cold }
  "warm"  { Invoke-NvmeBuild -Mode warm }
  "all" {
    Invoke-NvmeSetup
    Invoke-NvmeBuild -Mode cold
    Invoke-NvmeBuild -Mode warm
    Write-Step "NVMe benchmark complete. Copy preserved at $NvmeRoot"
  }
}
