# Mutations only. The worker owns the mutex, deadlines and diagnostic retention.
function Invoke-Docker([string[]]$Arguments) {
  $script:PanelComponent='Docker'
  $timeout=30
  if($Arguments -contains 'up' -or $Arguments -contains 'down' -or $Arguments -contains 'stop' -or $Arguments -contains 'exec'){$timeout=180}
  if($Arguments -contains 'build'){$timeout=420}
  $call=Get-ErpDockerInvocation $Arguments
  Invoke-PanelCommand $call.Executable $call.Arguments $timeout
}
function Get-Containers([string]$Project) {
  @(Invoke-Docker @('ps','-a','--filter',"label=com.docker.compose.project=$Project",'--format','{{json .}}') | Where-Object {$_} | ForEach-Object {$_ | ConvertFrom-Json})
}
function Wait-Healthy([string]$Id) {
  $deadline=[DateTime]::UtcNow.AddMinutes(3)
  do {
    Assert-PanelOperation
    $health=(Invoke-Docker @('inspect',$Id,'--format','{{.State.Health.Status}}') | Out-String).Trim()
    if($health -eq 'healthy'){return}
    if($health -eq 'unhealthy'){throw 'O serviço não ficou saudável. Consulte os registros do Docker.'}
    Start-Sleep -Seconds 1
  } while([DateTime]::UtcNow -lt $deadline)
  throw 'Tempo de inicialização excedido. Verifique o Docker.'
}
function Set-PanelLocalReady($Result,[bool]$Demo) {
  $environment='Normal';$port=3000;if($Demo){$environment='Demo';$port=3001}
  if(!(Test-PanelHealth "http://127.0.0.1:$port")){throw 'Aplicativo ou banco ainda não responde localmente.'}
  $Result.State[$environment]=@{State='ready';Text='Pronto localmente — aplicativo e banco respondendo.'}
  Set-PanelStage 'Servidor pronto localmente. Preparando o acesso privado…' $Result.State
  try {
    $url=Connect-PanelApp $Demo
    $Result.State["${environment}Access"]=@{Url=$url;Access='Acesso privado pronto'}
    $Result.Message='Servidor pronto; acesso privado disponível.'
  } catch {
    if(!(Test-PanelHealth "http://127.0.0.1:$port")) {
      $Result.State[$environment]=@{State='degraded';Text='Sem resposta após preparar o link — confira o aplicativo.'}
      throw
    }
    $Result.Warning=$true
    $Result.State["${environment}Access"]=@{Access='Acesso remoto pendente — use Preparar link.'}
    $Result.Message="Servidor pronto localmente; acesso remoto pendente. $($_.Exception.Message)"
  }
}
function Invoke-PanelAction([string]$Action,[string]$BackupDirectory='') {
  $result=@{Ok=$false;Warning=$false;Message='';State=@{}}
  try {
    if($Action -eq 'StartEngine') {
      $runtime=Get-ErpDockerRuntime
      if($runtime.Backend -ne 'wsl'){throw 'Abra o Docker Desktop para iniciar o motor.'}
      $script:PanelComponent='Docker'
      Invoke-PanelCommand (Get-Command wsl.exe).Source @('-d',$runtime.Distribution,'-u','root','--exec','systemctl','start','docker') 60 | Out-Null
    }
    Invoke-Docker @('info','--format','{{.ServerVersion}}') | Out-Null
    switch($Action) {
      'StartEngine' {$result.Message='Docker iniciado. Consultando os servidores…'}
      'StartNormal' {
        Set-PanelStage 'Verificando a instalação e iniciando o banco…'
        $services=@{}
        $containers=@(Get-Containers 'erp-pousada')
        if($containers.Count) {
          $details=Invoke-Docker (@('inspect','--format','{{json .}}')+@($containers | ForEach-Object {$_.ID}))
          foreach($line in $details) {
            $item=$line | ConvertFrom-Json
            $services[$item.Config.Labels.'com.docker.compose.service']=$item
          }
        }
        if(!$services.app -or !$services.postgres){throw 'Instalação normal não encontrada. Prepare a instalação pelo guia.'}
        if(!$services.postgres.State.Running){Invoke-Docker @('start',$services.postgres.Id) | Out-Null}
        Wait-Healthy $services.postgres.Id
        Set-PanelStage 'Banco pronto. Iniciando aplicativo e serviços auxiliares…'
        foreach($name in @('app','notification-worker','backup-worker','proxy')) {
          if($services[$name] -and !$services[$name].State.Running){Invoke-Docker @('start',$services[$name].Id) | Out-Null}
        }
        Wait-Healthy $services.app.Id
        Set-PanelLocalReady $result $false
      }
      'StopNormal' {
        Set-PanelStage 'Encerrando serviços. Banco e backups serão preservados…'
        $running=@(Get-Containers 'erp-pousada' | Where-Object {$_.State -eq 'running'})
        if($running.Count){Invoke-Docker (@('stop','--time','30')+@($running | ForEach-Object {$_.ID})) | Out-Null}
        $result.State.Normal=@{State='stopped';Text='Desligado — dados e backups preservados.'}
        $result.Message='Sistema normal encerrado. Dados preservados.'
      }
      {$_ -in @('StartDemo','ResetDemo','UpdateDemo')} {
        Set-PanelStage 'Preparando a demonstração…'
        & (Join-Path $PSScriptRoot 'start-demo.ps1') -Reset:($Action -eq 'ResetDemo') -Update:($Action -eq 'UpdateDemo')
        Set-PanelLocalReady $result $true
      }
      'StopDemo' {
        Set-PanelStage 'Encerrando demonstração e descartando somente os exemplos…'
        & (Join-Path $PSScriptRoot 'stop-demo.ps1')
        $result.State.Demo=@{State='stopped';Text='Desligado — alterações dos exemplos descartadas.'}
        $result.Message='Demonstração encerrada. Alterações descartadas.'
      }
      {$_ -in @('ConnectNormal','ConnectDemo')} {
        $environment='Normal';if($Action -eq 'ConnectDemo'){$environment='Demo'}
        $url=Connect-PanelApp ($environment -eq 'Demo')
        $result.State["${environment}Access"]=@{Url=$url;Access='Acesso privado pronto'}
        $result.Message='Link privado pronto para abrir ou copiar.'
      }
      'ConfigureBackup' {Configure-PanelBackup $BackupDirectory;Invoke-PanelBackup;$result.Message='Pasta configurada e segunda cópia verificada. Confira a sincronização no Drive.'}
      'BackupNow' {Invoke-PanelBackup;$result.Message='Backup concluído e verificado nos destinos configurados.'}
      default {throw 'Operação desconhecida.'}
    }
    $result.Ok=$true
  } catch {$result.Message=$_.Exception.Message}
  return $result
}
