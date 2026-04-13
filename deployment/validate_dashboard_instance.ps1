param(
    [string]$ApiUrl = "https://mymemo-app.duckdns.org",
    [string]$AdminKey = "",
    [string]$Username = "",
    [System.Security.SecureString]$Password,
    [switch]$SkipLogin,
    [switch]$SkipPlaces
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
    param(
        [string]$EnvFilePath,
        [string]$Key
    )

    if (-not (Test-Path $EnvFilePath)) {
        return ""
    }

    $line = Get-Content $EnvFilePath | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
    if (-not $line) {
        return ""
    }

    return ($line -split '=', 2)[1].Trim()
}

function Test-Health {
    param([string]$Url)

    try {
        $resp = Invoke-WebRequest -Uri "$Url/health" -UseBasicParsing -TimeoutSec 20
        if ($resp.StatusCode -eq 200) {
            Write-Host "[OK] /health" -ForegroundColor Green
            return $true
        }

        Write-Host "[FAIL] /health (status=$($resp.StatusCode))" -ForegroundColor Red
        return $false
    }
    catch {
        Write-Host "[FAIL] /health ($($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

function Test-AdminEndpoint {
    param(
        [string]$Url,
        [string]$Path,
        [string]$Key
    )

    try {
        $null = Invoke-RestMethod -Uri "$Url$Path" -Headers @{ "X-Admin-Key" = $Key } -TimeoutSec 25
        Write-Host "[OK] $Path" -ForegroundColor Green
        return $true
    }
    catch {
        $status = $null
        try { $status = $_.Exception.Response.StatusCode.value__ } catch {}

        if ($status) {
            Write-Host "[FAIL] $Path (status=$status)" -ForegroundColor Red
        }
        else {
            Write-Host "[FAIL] $Path ($($_.Exception.Message))" -ForegroundColor Red
        }
        return $false
    }
}

function Get-Jwt {
    param(
        [string]$Url,
        [string]$User,
        [System.Security.SecureString]$Pass
    )

    if ([string]::IsNullOrWhiteSpace($User) -or -not $Pass) {
        Write-Host "[WARN] Login omitido: Username/Password vacios." -ForegroundColor Yellow
        return ""
    }

    try {
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Pass)
        try {
            $plainPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }

        $formBody = "username=$([uri]::EscapeDataString($User))&password=$([uri]::EscapeDataString($plainPass))"
        $auth = Invoke-RestMethod `
            -Method Post `
            -Uri "$Url/api/v1/auth/login" `
            -ContentType "application/x-www-form-urlencoded" `
            -Body $formBody `
            -TimeoutSec 25

        if ($auth.access_token) {
            Write-Host "[OK] /api/v1/auth/login" -ForegroundColor Green
            return $auth.access_token
        }

        Write-Host "[FAIL] /api/v1/auth/login (sin access_token)" -ForegroundColor Red
        return ""
    }
    catch {
        Write-Host "[FAIL] /api/v1/auth/login ($($_.Exception.Message))" -ForegroundColor Red
        return ""
    }
}

function Test-Places {
    param(
        [string]$Url,
        [string]$Token
    )

    if ([string]::IsNullOrWhiteSpace($Token)) {
        Write-Host "[WARN] Places omitido: no hay JWT." -ForegroundColor Yellow
        return @($true, $true)
    }

    $headers = @{ Authorization = "Bearer $Token" }

    $okAutocomplete = $true
    $okReverse = $true

    try {
        $null = Invoke-RestMethod -Uri "$Url/api/v1/search/places/autocomplete?q=roma%20norte&language=es&country=mx" -Headers $headers -TimeoutSec 25
        Write-Host "[OK] /api/v1/search/places/autocomplete" -ForegroundColor Green
    }
    catch {
        Write-Host "[FAIL] /api/v1/search/places/autocomplete ($($_.Exception.Message))" -ForegroundColor Red
        $okAutocomplete = $false
    }

    try {
        $null = Invoke-RestMethod -Uri "$Url/api/v1/search/places/reverse-geocode?latitude=19.4326&longitude=-99.1332&language=es" -Headers $headers -TimeoutSec 25
        Write-Host "[OK] /api/v1/search/places/reverse-geocode" -ForegroundColor Green
    }
    catch {
        Write-Host "[FAIL] /api/v1/search/places/reverse-geocode ($($_.Exception.Message))" -ForegroundColor Red
        $okReverse = $false
    }

    return @($okAutocomplete, $okReverse)
}

# Resolve repo root and load default ADMIN_API_KEY from backend/.env if needed.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$backendEnv = Join-Path $repoRoot "backend/.env"

if ([string]::IsNullOrWhiteSpace($AdminKey)) {
    $AdminKey = Get-EnvValue -EnvFilePath $backendEnv -Key "ADMIN_API_KEY"
}

Write-Host "=== Dashboard Validation (Instance) ==="
Write-Host "API URL: $ApiUrl"

$failed = 0

if (-not (Test-Health -Url $ApiUrl)) { $failed++ }

if ([string]::IsNullOrWhiteSpace($AdminKey)) {
    Write-Host "[FAIL] ADMIN_API_KEY no disponible (parametro o backend/.env)." -ForegroundColor Red
    $failed++
}
else {
    $adminPaths = @(
        "/api/v1/admin/stats",
        "/api/v1/admin/executive",
        "/api/v1/admin/users-kpis",
        "/api/v1/admin/product-kpis",
        "/api/v1/admin/alerts",
        "/api/v1/admin/finops",
        "/api/v1/admin/infrastructure"
    )

    foreach ($path in $adminPaths) {
        if (-not (Test-AdminEndpoint -Url $ApiUrl -Path $path -Key $AdminKey)) { $failed++ }
    }
}

if (-not $SkipLogin) {
    $jwt = Get-Jwt -Url $ApiUrl -User $Username -Pass $Password

    if (-not $SkipPlaces) {
        $placesResults = Test-Places -Url $ApiUrl -Token $jwt
        if (-not $placesResults[0]) { $failed++ }
        if (-not $placesResults[1]) { $failed++ }
    }
}

if ($failed -eq 0) {
    Write-Host "\nVALIDATION RESULT: SUCCESS" -ForegroundColor Green
    exit 0
}

Write-Host "\nVALIDATION RESULT: FAILED ($failed checks)" -ForegroundColor Red
exit 1
