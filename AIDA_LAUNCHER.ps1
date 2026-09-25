$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$pbExe = Join-Path $scriptRoot 'pocketbase.exe'
$pbPort = 8090
$backendPort = 3001
$backendUrl = 'http://localhost:3001'
$npmCmd = 'npm.cmd'
$backendEnvPath = Join-Path $scriptRoot 'packages\backend\.env'
$backendEnvExamplePath = Join-Path $scriptRoot 'packages\backend\.env.example'

# ── Helpers ────────────────────────────────────────────────────────────────────

function Test-PortListening {
    param([int]$Port)
    try {
        if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
            return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        }
        return [bool](netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING")
    } catch {
        return $false
    }
}

function Wait-ForPort {
    param([int]$Port, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Process)
    if ($null -eq $Process) { return }
    try {
        if (-not $Process.HasExited) {
            $null = & taskkill /T /F /PID $Process.Id 2>&1
        }
    } catch { }
}

function Get-EnvVarValue {
    param([string]$FilePath, [string]$VarName)
    if (-not (Test-Path $FilePath)) { return $null }
    $line = Get-Content -Path $FilePath -ErrorAction SilentlyContinue |
        Where-Object { $_ -match "^\s*$VarName\s*=" } |
        Select-Object -First 1
    if (-not $line) { return $null }
    $parts = $line -split '=', 2
    if ($parts.Count -lt 2) { return $null }
    return ($parts[1]).Trim()
}

function Set-EnvVarValue {
    param([string]$FilePath, [string]$VarName, [string]$VarValue)
    $content = @()
    if (Test-Path $FilePath) { $content = Get-Content -Path $FilePath }
    $updated = $false
    $newContent = $content | ForEach-Object {
        if ($_ -match "^\s*$VarName\s*=") { $updated = $true; return "$VarName=$VarValue" }
        return $_
    }
    if (-not $updated) { $newContent += "$VarName=$VarValue" }
    Set-Content -Path $FilePath -Value $newContent
}

function Read-SecretInput {
    param([string]$Prompt)
    $secureValue = Read-Host -Prompt $Prompt -AsSecureString
    if (-not $secureValue) { return '' }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function New-RandomSecret {
    param([int]$ByteLength = 32)
    $bytes = New-Object byte[] $ByteLength
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Ensure-BackendEnv {
    $createdEnv = $false
    $missingBefore = $false

    if (-not (Test-Path $backendEnvPath)) {
        $createdEnv = $true
        if (Test-Path $backendEnvExamplePath) {
            Copy-Item -Path $backendEnvExamplePath -Destination $backendEnvPath -Force
            Write-Host 'Created packages/backend/.env from .env.example.'
        } else {
            Set-Content -Path $backendEnvPath -Value @('PB_ADMIN_EMAIL=', 'PB_ADMIN_PASSWORD=', 'JWT_SECRET=')
            Write-Host 'Created packages/backend/.env.'
        }
    }

    $pbAdminEmail    = Get-EnvVarValue -FilePath $backendEnvPath -VarName 'PB_ADMIN_EMAIL'
    $pbAdminPassword = Get-EnvVarValue -FilePath $backendEnvPath -VarName 'PB_ADMIN_PASSWORD'
    $jwtSecret       = Get-EnvVarValue -FilePath $backendEnvPath -VarName 'JWT_SECRET'

    if ([string]::IsNullOrWhiteSpace($pbAdminEmail) -or [string]::IsNullOrWhiteSpace($pbAdminPassword)) {
        $missingBefore = $true
    }
    if ($createdEnv -or [string]::IsNullOrWhiteSpace($pbAdminEmail)) {
        $pbAdminEmail = Read-Host -Prompt 'Enter PocketBase superuser email'
    }
    if ($createdEnv -or [string]::IsNullOrWhiteSpace($pbAdminPassword)) {
        $pbAdminPassword = Read-SecretInput -Prompt 'Enter PocketBase superuser password'
    }
    if ($createdEnv -or [string]::IsNullOrWhiteSpace($jwtSecret)) {
        $jwtSecret = New-RandomSecret
        Write-Host 'Generated JWT_SECRET automatically.'
    }

    if ([string]::IsNullOrWhiteSpace($pbAdminEmail) -or
        [string]::IsNullOrWhiteSpace($pbAdminPassword) -or
        [string]::IsNullOrWhiteSpace($jwtSecret)) {
        Write-Host 'ERROR: PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, and JWT_SECRET are all required.'
        exit 1
    }

    Set-EnvVarValue -FilePath $backendEnvPath -VarName 'PB_ADMIN_EMAIL'    -VarValue $pbAdminEmail
    Set-EnvVarValue -FilePath $backendEnvPath -VarName 'PB_ADMIN_PASSWORD' -VarValue $pbAdminPassword
    Set-EnvVarValue -FilePath $backendEnvPath -VarName 'JWT_SECRET'        -VarValue $jwtSecret

    return @{
        Email              = $pbAdminEmail
        Password           = $pbAdminPassword
        BootstrapSuggested = ($createdEnv -or $missingBefore)
    }
}

function Ensure-PocketBaseSuperuser {
    param([string]$Email, [string]$Password)
    $choice = Read-Host -Prompt 'Bootstrap PocketBase superuser now? (Y/n)'
    if ([string]::IsNullOrWhiteSpace($choice) -or $choice -match '^[Yy]') {
        try {
            & $pbExe superuser upsert $Email $Password --dir './pb_data' | Out-Null
            Write-Host 'PocketBase superuser upsert complete.'
        } catch {
            Write-Host 'WARNING: Could not run PocketBase superuser upsert automatically.'
            Write-Host "Run manually: .\pocketbase.exe superuser upsert $Email <password> --dir ./pb_data"
        }
    }
}

# Starts the backend via cmd.exe with stdin redirected to nul.
# This suppresses "Terminate batch job (Y/N)?" on Ctrl+C because cmd.exe
# detects a non-interactive stdin and exits silently instead of prompting.
# Stdout and stderr are NOT redirected, so all backend logs appear here.
function Start-BackendProcess {
    param([string]$WorkingDirectory)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = '/c npm run start:backend'
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Close()
    return $proc
}

# ── Main ───────────────────────────────────────────────────────────────────────

Write-Host '================================================='
Write-Host '  AIDA ERP Launcher'
Write-Host '================================================='
Write-Host ''

if (-not (Test-Path $pbExe)) {
    Write-Host 'ERROR: pocketbase.exe not found in the project root.'
    exit 1
}
if (-not (Get-Command $npmCmd -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: npm not found on PATH. Install Node.js and reopen this terminal.'
    exit 1
}

$bootstrapInfo = Ensure-BackendEnv
if ($bootstrapInfo.BootstrapSuggested) {
    Ensure-PocketBaseSuperuser -Email $bootstrapInfo.Email -Password $bootstrapInfo.Password
}

$pbProcess      = $null
$backendProcess = $null

try {
    # ── PocketBase ──────────────────────────────────────────────────────────────
    if (Test-PortListening -Port $pbPort) {
        Write-Host 'PocketBase is already running.'
    } else {
        Write-Host 'Starting PocketBase...'
        $pbProcess = Start-Process `
            -FilePath $pbExe `
            -ArgumentList 'serve', '--dir', './pb_data', '--publicDir', './pb_public' `
            -WorkingDirectory $scriptRoot `
            -NoNewWindow `
            -PassThru
    }

    # ── Backend ─────────────────────────────────────────────────────────────────
    if (Test-PortListening -Port $backendPort) {
        Write-Host 'Backend API is already running.'
    } else {
        Write-Host 'Starting Backend API...'
        $backendProcess = Start-BackendProcess -WorkingDirectory $scriptRoot
    }

    # ── Wait for ready ──────────────────────────────────────────────────────────
    Write-Host 'Waiting for services...'
    if (-not (Wait-ForPort -Port $pbPort -TimeoutSeconds 20)) {
        Write-Host "ERROR: PocketBase did not start on port $pbPort."
        exit 1
    }
    if (-not (Wait-ForPort -Port $backendPort -TimeoutSeconds 30)) {
        Write-Host "ERROR: Backend did not start on port $backendPort."
        exit 1
    }

    Write-Host "Opening browser at $backendUrl ..."
    Start-Process $backendUrl | Out-Null
    Write-Host 'AIDA services are running. Press Ctrl+C to stop.'
    Write-Host ''

    while ($true) {
        Start-Sleep -Seconds 5
        if ($null -ne $backendProcess -and $backendProcess.HasExited) {
            Write-Host '[Backend] Process exited — check logs above for errors.'
            break
        }
    }

} finally {
    Write-Host 'Stopping AIDA services...'
    Stop-ProcessTree -Process $backendProcess
    Stop-ProcessTree -Process $pbProcess
    Write-Host 'Done.'
}
