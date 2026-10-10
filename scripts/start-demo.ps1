param([string]$AppUrl = '', [switch]$NoBuild)
function Invoke-DemoDocker {
  # Keep Docker flags literal: advanced PowerShell functions consume -d as Debug.
  $Arguments=$args
  if(Get-Command Invoke-Docker -ErrorAction SilentlyContinue) { Invoke-Docker $Arguments; $global:LASTEXITCODE=0 }
  else { Invoke-ErpDocker $Arguments }
}
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$environmentFile = Join-Path $projectRoot '.env.demo.local'
$localDirectory = Join-Path $projectRoot '.local'
$credentialFile = Join-Path $localDirectory 'demonstracao-acesso.txt'
function New-DemoSecret {
  $bytes = New-Object byte[] 24
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}
function Protect-DemoFile([string]$Path) {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $Path /inheritance:r /grant:r "${identity}:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger a configuração de demonstração.' }
}
if ($AppUrl) {
  $parsed = $null
  if (![Uri]::TryCreate($AppUrl, [UriKind]::Absolute, [ref]$parsed) -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment -or $parsed.AbsolutePath -ne '/' -or !($parsed.Scheme -eq 'https' -or $parsed.Scheme -eq 'http' -and $parsed.Host -eq 'localhost' -and $parsed.Port -eq 3001)) { throw 'Use http://localhost:3001 ou a origem HTTPS privada da demonstração, sem caminhos ou parâmetros.' }
  $AppUrl = $parsed.GetLeftPart([UriPartial]::Authority)
}
New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
if (!(Test-Path -LiteralPath $environmentFile)) {
  $configuration = @('DEMO_APP_URL=http://localhost:3001')
  foreach ($key in @('DEMO_DB_ADMIN_PASSWORD','DEMO_DB_MIGRATOR_PASSWORD','DEMO_DB_APP_PASSWORD','DEMO_DB_BACKUP_PASSWORD','DEMO_DB_WORKER_PASSWORD')) { $configuration += "$key=$(New-DemoSecret)" }
  $configuration += "DEMO_LOGIN_PASSWORD=teste"
  [IO.File]::WriteAllLines($environmentFile, $configuration)
}
$configuration = Get-Content -LiteralPath $environmentFile
if ($AppUrl) {
  $configuration = @($configuration | Where-Object { !($_.StartsWith('DEMO_APP_URL=')) }) + "DEMO_APP_URL=$AppUrl"
  [IO.File]::WriteAllLines($environmentFile, $configuration)
}
Protect-DemoFile $environmentFile
$demoUrl = ($configuration | Where-Object { $_.StartsWith('DEMO_APP_URL=') }).Substring(13)
$loginPassword = ($configuration | Where-Object { $_.StartsWith('DEMO_LOGIN_PASSWORD=') }).Substring(20)
[IO.File]::WriteAllLines($credentialFile, @("Endereço: $demoUrl", 'Usuário administrador: teste', 'Usuários por setor: recepcao, estoque', "Senha das contas de demonstração: $loginPassword", 'Credenciais exclusivas para dados fictícios; não são utilizadas pela instalação principal.'))
Protect-DemoFile $credentialFile
Invoke-DemoDocker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Inicie o motor Docker pelo painel.' }
$composeArguments = @('compose','--project-name','erp-pousada-demo','--env-file',$environmentFile,'-f','compose.demo.yml')
Write-Host 'Recriando apenas a demonstração. Alterações da sessão anterior serão descartadas.'
Invoke-DemoDocker @composeArguments down --volumes --remove-orphans
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível encerrar a demonstração anterior.' }
try {
  if (!$NoBuild) {
    if(Get-Command Set-PanelStage -ErrorAction SilentlyContinue){Set-PanelStage 'Atualizando a versão da demonstração. A primeira construção pode levar alguns minutos…'}
    Invoke-DemoDocker @composeArguments build app-demo
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao construir a imagem de demonstração.' }
  }
  if(Get-Command Set-PanelStage -ErrorAction SilentlyContinue){Set-PanelStage 'Versão pronta. Iniciando o banco e restaurando os exemplos…'}
  Invoke-DemoDocker @composeArguments up -d
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar a demonstração.' }
  if(Get-Command Set-PanelStage -ErrorAction SilentlyContinue){Set-PanelStage 'Exemplos restaurados. Aguardando o aplicativo de demonstração responder…'}
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    $containerId = Invoke-DemoDocker @composeArguments ps -q app-demo
    if (!$containerId) { throw 'Servidor de demonstração não foi criado.' }
    $health = Invoke-DemoDocker inspect $containerId --format '{{.State.Health.Status}}'
    if ($health -eq 'healthy') { break }
    if ($health -eq 'unhealthy') { throw 'Servidor de demonstração não está saudável.' }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($health -ne 'healthy') { throw 'Tempo de inicialização da demonstração excedido.' }
  $localHealth = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 10
  if ($localHealth.StatusCode -ne 200) { throw 'A porta local da demonstração não está acessível.' }
  Write-Host "Demonstração pronta: $demoUrl"
  Write-Host "Acesso: $credentialFile"
  Write-Host 'Para encerrar e descartar alterações: .\scripts\stop-demo.ps1'
} catch {
  $startupError = $_
  try {
    $diagnosticFile = Join-Path $localDirectory 'demonstracao-ultimo-erro.log'
    Invoke-DemoDocker @composeArguments logs --no-color --tail 40 migrate-demo seed-demo permissions-demo app-demo 2>&1 | Set-Content -LiteralPath $diagnosticFile
    Protect-DemoFile $diagnosticFile
    Write-Host "Diagnóstico da inicialização: $diagnosticFile"
  } finally {
    Invoke-DemoDocker @composeArguments down --volumes --remove-orphans | Out-Null
  }
  throw $startupError
}
