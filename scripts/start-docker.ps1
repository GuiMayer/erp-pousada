$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
Set-Location $projectRoot
$environmentFile = Join-Path $projectRoot '.env.docker.local'
if (!(Test-Path -LiteralPath $environmentFile)) { throw 'Execute scripts/setup-docker.ps1 primeiro.' }
# Upgrade existing installations without replacing any existing credential.
if (!(Select-String -LiteralPath $environmentFile -Pattern '^DB_WORKER_PASSWORD=' -Quiet)) {
  $workerBytes = New-Object byte[] 24
  $workerGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $workerGenerator.GetBytes($workerBytes) } finally { $workerGenerator.Dispose() }
  $workerSecret = [BitConverter]::ToString($workerBytes).Replace('-', '').ToLowerInvariant()
  Add-Content -LiteralPath $environmentFile -Value "DB_WORKER_PASSWORD=$workerSecret"
}
Invoke-ErpDocker @('info','--format','{{.ServerVersion}}') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Inicie o motor Docker pelo painel antes da instalação.' }
$composeArguments = @('compose','--env-file',$environmentFile,'-f','docker-compose.yml','-f','compose.lan.yml')
Invoke-ErpDocker ($composeArguments + @('up','-d','--build'))
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar. Dados e volumes foram preservados.' }
$bootstrapFile = Join-Path $projectRoot '.local/administrador-inicial.txt'
if (Test-Path -LiteralPath $bootstrapFile) {
  $credentialLines = Get-Content -LiteralPath $bootstrapFile
  $env:BOOTSTRAP_ADMIN_USERNAME = ($credentialLines | Where-Object { $_.StartsWith('Usuario: ') }).Substring(9)
  $env:BOOTSTRAP_ADMIN_PASSWORD = ($credentialLines | Where-Object { $_.StartsWith('Senha: ') }).Substring(7)
  try {
    Invoke-ErpDocker ($composeArguments + @('run','--rm','--no-deps','-e','BOOTSTRAP_ADMIN_USERNAME','-e','BOOTSTRAP_ADMIN_PASSWORD','migrate','pnpm','db:seed'))
    if ($LASTEXITCODE -ne 0) { throw 'Falha no cadastro inicial do administrador.' }
  } finally { Remove-Item Env:BOOTSTRAP_ADMIN_USERNAME; Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD }
}
Invoke-ErpDocker ($composeArguments + @('ps'))
Write-Host 'Acesse o endereço APP_URL de .env.docker.local. Para HTTPS interno, confie no certificado da instalação conforme o guia.'
