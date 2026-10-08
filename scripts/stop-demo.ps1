$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$environmentFile = Join-Path $projectRoot '.env.demo.local'
$temporary = $null
if (!(Test-Path -LiteralPath $environmentFile)) {
  # Compose requires interpolation even for down. No credential is needed to remove demo services.
  $temporary = [IO.Path]::GetTempFileName()
  $configuration = @('DEMO_APP_URL=http://localhost:3001')
  foreach ($key in @('DEMO_DB_ADMIN_PASSWORD','DEMO_DB_MIGRATOR_PASSWORD','DEMO_DB_APP_PASSWORD','DEMO_DB_BACKUP_PASSWORD','DEMO_DB_WORKER_PASSWORD','DEMO_LOGIN_PASSWORD')) { $configuration += "$key=unused-stop-only" }
  [IO.File]::WriteAllLines($temporary, $configuration)
  $environmentFile = $temporary
}
try {
  & docker compose --project-name erp-pousada-demo --env-file $environmentFile -f compose.demo.yml down --volumes --remove-orphans
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao encerrar a demonstração. Verifique se o Docker está funcionando.' }
  Write-Host 'Demonstração encerrada. As alterações foram descartadas; a instalação principal foi preservada.'
} finally { if ($temporary) { Remove-Item -LiteralPath $temporary } }
