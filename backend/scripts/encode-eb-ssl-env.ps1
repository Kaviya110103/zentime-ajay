param(
  [Parameter(Mandatory = $true)]
  [string]$FullChainPath,

  [Parameter(Mandatory = $true)]
  [string]$PrivateKeyPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FullChainPath)) {
  throw "Certificate file not found: $FullChainPath"
}

if (-not (Test-Path -LiteralPath $PrivateKeyPath)) {
  throw "Private key file not found: $PrivateKeyPath"
}

$certBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $FullChainPath))
$keyBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $PrivateKeyPath))

Write-Output "SSL_CERT_BASE64=$([Convert]::ToBase64String($certBytes))"
Write-Output "SSL_KEY_BASE64=$([Convert]::ToBase64String($keyBytes))"
