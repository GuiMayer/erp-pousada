$Arguments=$args
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
Set-Location (Split-Path $PSScriptRoot -Parent)
Invoke-ErpDocker $Arguments
exit $LASTEXITCODE
