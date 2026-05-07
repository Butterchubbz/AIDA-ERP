$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$pbExe = Join-Path $scriptRoot 'pocketbase.exe'
$pbUrl = 'http://localhost:8090'
$pbPort = 8090

function Test-PortListening {
    param(
        [int]$Port
    )

    try {
        if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
            return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        }

        return [bool](netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING")
    }
    catch {
        return $false
    }
}

Write-Host '================================================='
Write-Host '  AIDA - PocketBase Launcher'
Write-Host '================================================='
Write-Host ''
Write-Host 'Starting AIDA...'

if (-not (Test-Path $pbExe)) {
    Write-Host 'ERROR: pocketbase.exe was not found in the project root.'
    exit 1
}

Write-Host 'Found PocketBase.'

if (Test-PortListening -Port $pbPort) {
    Write-Host "Opening default browser to $pbUrl ..."
    Start-Process $pbUrl | Out-Null
    Write-Host 'Server is already running. Press Ctrl+C in the existing server window to stop the app.'
    exit 0
}

Write-Host "Opening default browser to $pbUrl ..."
Start-Process $pbUrl | Out-Null

try {
    Write-Host 'Starting server.'
    Start-Process -FilePath $pbExe -ArgumentList @('serve', '--dir', './pb_data', '--publicDir', './pb_public') -WorkingDirectory $scriptRoot -NoNewWindow | Out-Null
    Write-Host 'PocketBase is running. Press Ctrl+C to stop.'
    while ($true) {
        Start-Sleep -Seconds 5
    }
}
catch {
    Write-Host 'Stopping...'
    Stop-Process -Name 'pocketbase' -Force -ErrorAction SilentlyContinue
}