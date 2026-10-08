$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$environmentFile = '.env.docker.local'
if (!(Test-Path -LiteralPath $environmentFile)) { throw 'Configuração ausente.' }
$configuration = @{}
foreach ($line in Get-Content -LiteralPath $environmentFile) { if ($line -match '^([A-Z_]+)=(.*)$') { $configuration[$Matches[1]] = $Matches[2] } }
$composeArguments = @('compose','--env-file',$environmentFile,'-f','docker-compose.yml','-f','compose.lan.yml')
& docker @composeArguments ps
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar os serviços.' }
$health = Invoke-RestMethod -Uri ($configuration.APP_URL + '/api/health') -TimeoutSec 15
if ($health.status -ne 'ok') { throw 'Banco não responde.' }
& docker @composeArguments exec -T backup-worker sh -c 'test -f /backups/last-success && find /backups/last-success -mmin -${BACKUP_INTERVAL_MINUTES} | grep -q . && test ! -f /backups/last-error'
if ($LASTEXITCODE -ne 0) { throw 'Backup ainda não confirmado ou com falha.' }
if (!$configuration.BACKUP_REMOTE) { Write-Host 'Cópia externa criptografada ainda precisa de configuração.' }
Write-Host 'Aplicação, banco e último backup verificados.'
