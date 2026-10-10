$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$addressLine = Get-Content -LiteralPath '.env.docker.local' | Where-Object { $_.StartsWith('APP_URL=') }
if (!$addressLine -or !$addressLine.Substring(8).StartsWith('https://')) { throw 'Configure APP_URL com HTTPS.' }
Start-Process $addressLine.Substring(8)
