[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ServiceDir = Join-Path $Root "infra\searxng"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker nao encontrado. Instale Docker Desktop: https://www.docker.com/products/docker-desktop/ e habilite o Docker Compose."
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop nao esta em execucao. Inicie-o e execute novamente."
}

$envFile = Join-Path $ServiceDir ".env"
if (-not (Test-Path $envFile)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $secret = ([BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
    $rng.Dispose()
    @(
        "SEARXNG_VERSION=latest"
        "SEARXNG_HOST=127.0.0.1"
        "SEARXNG_PORT=8080"
        "SEARXNG_SECRET=$secret"
    ) | Set-Content -Path $envFile -Encoding ascii
}

Push-Location $ServiceDir
try {
    docker compose --env-file .env -f docker-compose.yml up -d
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose nao conseguiu iniciar o SearXNG." }
} finally {
    Pop-Location
}

Write-Host "Aguardando SearXNG em http://127.0.0.1:8080 ..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/search?q=esperto&format=json" -TimeoutSec 5
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}
if (-not $ready) {
    Write-Warning "Container iniciado, mas a API ainda nao respondeu. Consulte: docker compose logs searxng"
} else {
    Write-Host "SearXNG operacional. Configure o Esperto com http://127.0.0.1:8080." -ForegroundColor Green
}
