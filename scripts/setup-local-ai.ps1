[CmdletBinding()]
param(
    [switch]$SkipCoderModel,
    [switch]$SkipVisionModel
)

$ErrorActionPreference = "Stop"
$VisionModel = "qwen3-vl:4b"
$CoderModel = "qwen2.5-coder:7b"

Write-Host "Esperto | Configuracao de IA local" -ForegroundColor Cyan
Write-Host "GPU-alvo: NVIDIA RTX 2060 Super 8 GB; RAM: 16 GB." -ForegroundColor Gray

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama nao encontrado. Tentando instalar via WinGet..." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
    } else {
        throw "Instale o Ollama em https://ollama.com/download/windows e execute este script novamente."
    }
}

$OllamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
$OllamaExe = if ($OllamaCommand) { $OllamaCommand.Source } else { Join-Path $env:LOCALAPPDATA "Programs\\Ollama\\ollama.exe" }
if (-not (Test-Path $OllamaExe)) {
    throw "O comando ollama ainda nao esta disponivel. Feche e reabra o PowerShell apos a instalacao ou instale pelo site oficial."
}

try {
    $versionOutput = (& $OllamaExe --version 2>&1 | Out-String)
    Write-Host $versionOutput.Trim()
    if ($versionOutput -match '(\d+\.\d+\.\d+)') {
        $installedVersion = [version]$Matches[1]
        if ($installedVersion -lt [version]'0.12.7') {
            Write-Warning "Qwen3-VL requer Ollama 0.12.7 ou superior. Atualize o Ollama e execute novamente."
            if (Get-Command winget -ErrorAction SilentlyContinue) {
                winget upgrade --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
            }
            throw "Versao do Ollama abaixo de 0.12.7. Reinicie o PowerShell apos atualizar."
        }
    }
} catch {
    throw "Nao foi possivel validar a versao do Ollama: $($_.Exception.Message)"
}

$health = $false
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 | Out-Null
    $health = $true
} catch {}

if (-not $health) {
    Write-Host "Iniciando o servidor Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath $OllamaExe -ArgumentList "serve" -WindowStyle Hidden
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null
            $health = $true
            break
        } catch {}
    }
}
if (-not $health) { throw "O servidor Ollama nao respondeu em http://127.0.0.1:11434." }

if (-not $SkipVisionModel) {
    Write-Host "Baixando modelo multimodal $VisionModel..." -ForegroundColor Cyan
    ollama pull $VisionModel
    if ($LASTEXITCODE -ne 0) { throw "Falha ao baixar $VisionModel." }
}
if (-not $SkipCoderModel) {
    Write-Host "Baixando modelo de programacao $CoderModel..." -ForegroundColor Cyan
    ollama pull $CoderModel
    if ($LASTEXITCODE -ne 0) { throw "Falha ao baixar $CoderModel." }
}

Write-Host "`nModelos instalados:" -ForegroundColor Green
ollama list
Write-Host "`nNo Esperto, abra Configuracoes > Ollama & GPU, atualize a lista e selecione um modelo Ollama." -ForegroundColor Green
Write-Host "Use Qwen3-VL 4B para imagens; Qwen2.5-Coder 7B para programacao textual." -ForegroundColor Gray
