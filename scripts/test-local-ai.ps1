$ErrorActionPreference = "Continue"
Write-Host "Diagnostico local do Esperto" -ForegroundColor Cyan

Write-Host "`n[GPU]" -ForegroundColor Yellow
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { nvidia-smi } else { Write-Warning "nvidia-smi nao encontrado; verifique o driver NVIDIA." }

Write-Host "`n[OLLAMA]" -ForegroundColor Yellow
try {
    $tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 4
    $tags.models | Select-Object name, size | Format-Table -AutoSize
} catch { Write-Warning "Ollama indisponivel em 127.0.0.1:11434." }

Write-Host "`n[SEARXNG]" -ForegroundColor Yellow
try {
    $search = Invoke-RestMethod -Uri "http://127.0.0.1:8080/search?q=esperto&format=json" -TimeoutSec 10
    Write-Host "SearXNG respondeu com $($search.results.Count) resultados." -ForegroundColor Green
} catch { Write-Warning "SearXNG indisponivel. Execute scripts/setup-searxng.ps1." }

Write-Host "`n[GPU OFFLOAD]" -ForegroundColor Yellow
if (Get-Command ollama -ErrorAction SilentlyContinue) { ollama ps }
