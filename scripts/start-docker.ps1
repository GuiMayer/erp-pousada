$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$environmentFile = Join-Path $projectRoot '.env.docker.local'
if (!(Test-Path -LiteralPath $environmentFile)) { throw 'Execute scripts/setup-docker.ps1 primeiro.' }
& docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Inicie o Docker Desktop antes da instalação.' }
$composeArguments = @('compose','--env-file',$environmentFile,'-f','docker-compose.yml','-f','compose.lan.yml')
& docker @composeArguments up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar. Dados e volumes foram preservados.' }
$bootstrapFile = Join-Path $projectRoot '.local/administrador-inicial.txt'
if (Test-Path -LiteralPath $bootstrapFile) {
  $credentialLines = Get-Content -LiteralPath $bootstrapFile
  $env:BOOTSTRAP_ADMIN_USERNAME = ($credentialLines | Where-Object { $_.StartsWith('Usuario: ') }).Substring(9)
  $env:BOOTSTRAP_ADMIN_PASSWORD = ($credentialLines | Where-Object { $_.StartsWith('Senha: ') }).Substring(7)
  try {
    & docker @composeArguments run --rm --no-deps -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD migrate pnpm db:seed
    if ($LASTEXITCODE -ne 0) { throw 'Falha no cadastro inicial do administrador.' }
  } finally { Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME; Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD }
}
& docker @composeArguments ps
Write-Host 'Acesse o endereço APP_URL de .env.docker.local. Para HTTPS interno, confie no certificado da instalação conforme o guia.'
