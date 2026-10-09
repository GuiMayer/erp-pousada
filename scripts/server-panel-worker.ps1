param(
  [Parameter(Mandatory=$true)][ValidateSet('Status','StartEngine','StartNormal','StopNormal','StartDemo','StopDemo','ConnectNormal','ConnectDemo','ConfigureBackup','BackupNow')][string]$Action,
  [Parameter(Mandatory=$true)][string]$ResultFile,
  [string]$ProgressFile='',
  [string]$CancelFile='',
  [string]$BackupDirectory=''
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. (Join-Path $PSScriptRoot 'server-panel-process.ps1')
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
$script:ProgressFile=$ProgressFile
$script:CancelFile=$CancelFile
$script:OperationDeadline=[DateTime]::UtcNow.AddMinutes(8)
. (Join-Path $PSScriptRoot 'server-panel-network.ps1')
. (Join-Path $PSScriptRoot 'server-panel-backup.ps1')
function Invoke-Docker([string[]]$Arguments) {
  $timeout=30
  if($Arguments -contains 'up' -or $Arguments -contains 'down' -or $Arguments -contains 'stop' -or $Arguments -contains 'exec'){$timeout=180}
  $invocation=Get-ErpDockerInvocation $Arguments
  return Invoke-PanelCommand $invocation.Executable $invocation.Arguments $timeout
}
function Get-Containers([string]$Project) {
  $lines = Invoke-Docker @('ps','-a','--filter',"label=com.docker.compose.project=$Project",'--format','{{json .}}')
  return @($lines | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
}
function Get-State([string]$Project, [string]$Service) {
  $app = Get-Containers $Project | Where-Object { $_.Names -match "-$Service-\d+$" } | Select-Object -First 1
  if (!$app) { return 'Não iniciado — clique em Iniciar.' }
  if ($app.State -ne 'running') { return 'Desligado — o site está indisponível.' }
  if ($app.Status -match '\(unhealthy\)') { return 'Falha — o aplicativo não está saudável.' }
  $port=3000; if($Service -eq 'app-demo'){$port=3001}
  try {
    $health=Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 3
    if($health.StatusCode -eq 200){return 'Pronto — aplicativo e banco respondendo.'}
  } catch { }
  return 'Aguardando resposta — iniciando ou com falha.'
}
function Wait-Healthy([string]$Id) {
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    Assert-PanelOperation
    $health = (Invoke-Docker @('inspect',$Id,'--format','{{.State.Health.Status}}') | Out-String).Trim()
    if ($health -eq 'healthy') { return }
    if ($health -eq 'unhealthy') { throw 'O serviço não ficou saudável. Consulte os registros do Docker.' }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'Tempo de inicialização excedido. Verifique o Docker.'
}
$result = @{ Ok=$false; Message=''; Normal=''; Demo=''; Docker=''; Tailscale=''; NormalLink=''; DemoLink=''; NormalAccess=''; DemoAccess=''; Backup='' }
$mutex = $null
$locked = $false
try {
  Set-PanelStage 'Verificando conexão com Docker e Tailscale…'
  if($Action -eq 'Status') {
    $result.Backup=Get-PanelBackupState
    try {
      $context=Get-TailscaleContext
      $result.Tailscale='Conectado — acesso privado pela sua rede Tailscale.'
      foreach($demo in @($false,$true)) {
        $port=3000; $prefix='Normal'; if($demo){$port=3001; $prefix='Demo'}
        $link=Find-TailscaleLink $context $port
        if($link -and (Read-PanelAddress $demo) -eq $link.URL) {
          $result["${prefix}Link"]=$link.URL
          $result["${prefix}Access"]='Link configurado. Disponível quando o servidor estiver pronto.'
        } else { $result["${prefix}Access"]='Link pendente — clique em Ativar link.' }
      }
    } catch { $result.Tailscale=$_.Exception.Message; $result.NormalAccess='Sem acesso pelo Tailscale.'; $result.DemoAccess='Sem acesso pelo Tailscale.' }
  }
  if($Action -eq 'StartEngine') {
    $runtime=Get-ErpDockerRuntime
    if($runtime.Backend -ne 'wsl'){throw 'Use Abrir Docker Desktop para iniciar o motor antigo.'}
    Invoke-PanelCommand (Get-Command wsl.exe).Source @('-d',$runtime.Distribution,'-u','root','--exec','systemctl','start','docker') 60 | Out-Null
  }
  Invoke-Docker @('info','--format','{{.ServerVersion}}') | Out-Null
  if ($Action -eq 'Status') {
    $result.Normal = Get-State 'erp-pousada' 'app'
    $result.Demo = Get-State 'erp-pousada-demo' 'app-demo'
    foreach($prefix in @('Normal','Demo')) {
      $url=$result["${prefix}Link"]
      if($url -and $result[$prefix] -like 'Pronto*') {
        try {
          $response=Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 3
          if($response.StatusCode -eq 200){$result["${prefix}Access"]='Acesso pronto pelo Tailscale — abra ou copie o link.'}
        } catch { $result["${prefix}Access"]='Servidor local pronto, mas o link não respondeu. Confira o Tailscale.' }
      } elseif($url) { $result["${prefix}Access"]='Link configurado; inicie o servidor para acessar o site.' }
    }
    $result.Docker = 'Em execução — pronto para iniciar os servidores.'
    $result.Message = 'Estados atualizados.'
  } else {
    $mutex = New-Object Threading.Mutex($false, 'Local\ErpPousadaServerOperation')
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked=$true }
    if (!$locked) { throw 'Outra operação está em andamento. Aguarde sua conclusão.' }
    switch ($Action) {
      'StartEngine' { $result.Message='Docker no Debian iniciado. Atualizando os estados…' }
      'StartNormal' {
        Set-PanelStage 'Verificando a instalação e iniciando o banco…'
        $services = @{}
        foreach ($container in @(Get-Containers 'erp-pousada')) {
          $labels = (Invoke-Docker @('inspect',$container.ID,'--format','{{json .Config.Labels}}') | Out-String) | ConvertFrom-Json
          $service = $labels.'com.docker.compose.service'
          $services[$service] = $container
        }
        if (!$services['app'] -or !$services['postgres']) { throw 'Instalação normal não encontrada. Prepare a instalação pelo guia antes de usar o painel.' }
        if ($services['postgres'].State -ne 'running') { Invoke-Docker @('start',$services['postgres'].ID) | Out-Null }
        Wait-Healthy $services['postgres'].ID
        Set-PanelStage 'Banco pronto. Iniciando aplicativo e serviços auxiliares…'
        foreach ($service in @('app','notification-worker','backup-worker','proxy')) {
          if ($services[$service] -and $services[$service].State -ne 'running') { Invoke-Docker @('start',$services[$service].ID) | Out-Null }
        }
        Wait-Healthy $services['app'].ID
        $url=Connect-PanelApp $false
        $result.Message = "Sistema normal pronto pelo Tailscale: $url"
      }
      'StopNormal' {
        Set-PanelStage 'Encerrando os serviços; preservando o banco e os backups…'
        $running = @(Get-Containers 'erp-pousada' | Where-Object { $_.State -eq 'running' })
        # Never remove operational containers or database volumes.
        if ($running.Count) { Invoke-Docker (@('stop','--time','30') + @($running | ForEach-Object { $_.ID })) | Out-Null }
        $result.Message = 'Sistema normal encerrado. Dados preservados.'
      }
      'StartDemo' {
        Set-PanelStage 'Restaurando exemplos e iniciando o banco de demonstração…'
        Invoke-Docker @('image','inspect','erp-pousada:demo','--format','{{.Id}}') | Out-Null
        & (Join-Path $PSScriptRoot 'start-demo.ps1') -NoBuild
        $url=Connect-PanelApp $true
        $result.Message = "Demonstração pronta pelo Tailscale: $url"
      }
      'StopDemo' {
        Set-PanelStage 'Encerrando a demonstração e descartando somente os dados fictícios…'
        & (Join-Path $PSScriptRoot 'stop-demo.ps1')
        $result.Message = 'Demonstração encerrada. Alterações descartadas.'
      }
      'ConnectNormal' { $url=Connect-PanelApp $false; $result.Message="Link do sistema normal pronto: $url" }
      'ConnectDemo' { $url=Connect-PanelApp $true; $result.Message="Link da demonstração pronto: $url" }
      'ConfigureBackup' { Configure-PanelBackup $BackupDirectory; Invoke-PanelBackup; $result.Message='Pasta configurada e segunda cópia verificada. Confira a sincronização no Drive, se utilizado.' }
      'BackupNow' { Invoke-PanelBackup; $result.Message='Backup concluído e verificado nos destinos configurados.' }
    }
  }
  $result.Ok=$true
} catch {
  $result.Message = $_.Exception.Message
  if($Action -ne 'Status') {
    $diagnostic=Join-Path (Split-Path $PSScriptRoot -Parent) '.local/server-panel/last-error.json'
    @{ Action=$Action; Time=[DateTime]::UtcNow.ToString('o'); Message=$result.Message } | ConvertTo-Json | Set-Content -LiteralPath $diagnostic -Encoding UTF8
  }
  if ($Action -eq 'Status') {
    $result.Docker='Indisponível — inicie o motor Docker pelo link do painel.'
    $result.Normal='Indisponível — depende do Docker.'; $result.Demo='Indisponível — depende do Docker.'
  } elseif($Action -in @('StartNormal','StartDemo')) {
    $result.Message="Inicialização incompleta: $($result.Message) O servidor pode estar funcionando localmente; confira o estado e ative o link novamente."
  }
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  if ($mutex) { $mutex.Dispose() }
  $result | ConvertTo-Json -Compress | Set-Content -LiteralPath $ResultFile -Encoding UTF8
}
