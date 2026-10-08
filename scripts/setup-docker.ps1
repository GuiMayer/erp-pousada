param([string]$Domain = "localhost", [string]$BindAddress = "127.0.0.1")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$localDirectory = Join-Path $projectRoot '.local'
$environmentFile = Join-Path $projectRoot '.env.docker.local'
if (Test-Path -LiteralPath $environmentFile) { throw 'Configuração existente preservada. Edite .env.docker.local para mudar os valores.' }
if ($Domain -notmatch '^[a-zA-Z0-9.-]+$' -or $BindAddress -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw 'Endereço inválido.' }
New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
function New-LocalSecret {
  $secretBytes = New-Object byte[] 24
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($secretBytes) } finally { $generator.Dispose() }
  return [BitConverter]::ToString($secretBytes).Replace('-', '').ToLowerInvariant()
}
$secretValues = @{}
foreach ($key in @('DB_ADMIN_PASSWORD','DB_MIGRATOR_PASSWORD','DB_APP_PASSWORD','DB_BACKUP_PASSWORD')) { $secretValues[$key] = New-LocalSecret }
$configuration = @("DOMAIN=$Domain", "LAN_BIND_ADDRESS=$BindAddress", "APP_URL=https://$Domain", 'BACKUP_HOST_DIR=./backups', 'BACKUP_INTERVAL_MINUTES=30', 'BACKUP_RETENTION_DAYS=14', 'BACKUP_REMOTE=', 'ALERT_WEBHOOK_URL=')
foreach ($key in $secretValues.Keys) { $configuration += "$key=$($secretValues[$key])" }
[IO.File]::WriteAllLines($environmentFile, $configuration)
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $environmentFile /inheritance:r /grant:r "${currentIdentity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível restringir acesso à configuração.' }
$bootstrapPassword = New-LocalSecret
$bootstrapFile = Join-Path $localDirectory 'administrador-inicial.txt'
[IO.File]::WriteAllLines($bootstrapFile, @('Usuario: admin', "Senha: $bootstrapPassword", 'Guarde em local seguro e remova este arquivo apos o primeiro acesso.'))
& icacls $bootstrapFile /inheritance:r /grant:r "${currentIdentity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível restringir acesso à senha inicial.' }
Write-Host 'Configuração criada sem dados de demonstração. Nenhuma senha foi exibida.'
Write-Host "Credencial inicial: $bootstrapFile"
Write-Host 'Inicie com: .\scripts\start-docker.ps1'
