$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$privateKeyPath = Join-Path $projectRoot '~\.tauri\esperto.key'
$publicKeyPath = Join-Path $projectRoot '~\.tauri\esperto.key.pub'
$configPath = Join-Path $projectRoot 'src-tauri\tauri.conf.json'

if (-not (Test-Path -LiteralPath $privateKeyPath -PathType Leaf)) {
    throw "Updater private key not found: $privateKeyPath. Keep the key in .tauri\esperto.key and do not commit it."
}

if (-not (Test-Path -LiteralPath $publicKeyPath -PathType Leaf)) {
    throw "Updater public key not found: $publicKeyPath. The public key must match the key configured in tauri.conf.json."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$configuredPublicKey = [string]$config.plugins.updater.pubkey
$filePublicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()

if ([string]::IsNullOrWhiteSpace($configuredPublicKey)) {
    throw 'No updater public key is configured in src-tauri/tauri.conf.json.'
}

if ($configuredPublicKey.Trim() -ne $filePublicKey) {
    throw 'The public key in .tauri/esperto.key.pub does not match plugins.updater.pubkey in src-tauri/tauri.conf.json. Do not build signed updates until both keys match.'
}

$env:TAURI_SIGNING_PRIVATE_KEY = $privateKeyPath

if ([string]::IsNullOrEmpty($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD)) {
    $securePassword = Read-Host 'Private key password (press Enter if the key has no password)' -AsSecureString
    if ($securePassword.Length -gt 0) {
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
    }
}

Push-Location $projectRoot
try {
    Write-Host 'Building Esperto and signing updater artifacts...' -ForegroundColor Cyan
    & npx tauri build
    $buildExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

if ($buildExitCode -ne 0) {
    exit $buildExitCode
}

Write-Host 'Build completed. Check the MSI and NSIS folders for installers and their .sig files.' -ForegroundColor Green
exit 0
