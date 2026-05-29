# scripts/dev-reset.ps1

Write-Host ""
Write-Host "================================="
Write-Host "MU / TH / RESET"
Write-Host "================================="
Write-Host ""

$ports = @(3000, 3001, 3050, 3051)
$killed = @{}

foreach ($port in $ports) {
    $connections = netstat -ano | findstr ":$port"

    if ($connections) {
        foreach ($line in $connections) {
            $parts = $line -split '\s+'
            $processId = $parts[-1]

            if ($processId -match '^\d+$' -and -not $killed.ContainsKey($processId)) {
                Write-Host "Killing PID $processId on port $port..."
                taskkill /PID $processId /F | Out-Null
                $killed[$processId] = $true
            }
        }
    }
}

Write-Host ""

if ($killed.Count -eq 0) {
    Write-Host "No dev server processes found."
} else {
    Write-Host "Killed $($killed.Count) process(es)."
}

Write-Host ""
Write-Host "MUTHUR RESET COMPLETE"
Write-Host "continuity restored"
Write-Host ""