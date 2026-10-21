# Read-only probes. This file is loaded in reusable background runspaces.
. (Join-Path $PSScriptRoot 'server-panel-process.ps1')
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
. (Join-Path $PSScriptRoot 'server-panel-network.ps1')
. (Join-Path $PSScriptRoot 'server-panel-backup.ps1')

function Test-PanelHealth([string]$Url,[int]$TimeoutMs=1500) {
  # Bound the entire request (including DNS); never wait on the visual thread.
  $request=[Net.HttpWebRequest]::Create("$($Url.TrimEnd('/'))/api/health")
  $request.AllowAutoRedirect=$false; $request.Proxy=$null
  $async=$null; $response=$null
  try {
    $async=$request.BeginGetResponse($null,$null)
    if(!$async.AsyncWaitHandle.WaitOne($TimeoutMs)){return $false}
    $response=$request.EndGetResponse($async)
    return [int]$response.StatusCode -eq 200
  } catch {return $false}
  finally {
    $request.Abort()
    if($response){$response.Close()}
    if($async){$async.AsyncWaitHandle.Close()}
  }
}
function Invoke-PanelProbe([string]$Component,[string]$Url='') {
  $script:CancelFile=''; $script:ProgressFile=''
  $script:OperationDeadline=[DateTime]::UtcNow.AddSeconds(12)
  $script:PanelMetrics=New-Object Collections.Generic.List[object]
  $script:PanelComponent=$Component
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $result=@{Component=$Component;Url=$Url;Ok=$true;Observed=[DateTime]::UtcNow.ToString('o');Data=@{};Message=''}
  try {
    switch($Component) {
      'Docker' {
        $runtime=Get-ErpDockerRuntime
        if($runtime.Backend -eq 'wsl') {
          $running=Invoke-PanelCommand (Get-Command wsl.exe -CommandType Application).Source @('--list','--running','--quiet') 2
          $names=@($running | ForEach-Object {($_ -replace [char]0,'').Trim()})
          if($names -notcontains $runtime.Distribution){
            $result.Data=@{Docker='WSL parado — use Iniciar Docker.';Normal=@{State='offline';Text='Indisponível — Docker desligado.'};Demo=@{State='offline';Text='Indisponível — Docker desligado.'}}
            break
          }
        }
        $call=Get-ErpDockerInvocation @('ps','-a','--filter','label=com.docker.compose.project','--format','{{json .}}') -ReadOnly
        $containers=@(Invoke-PanelCommand $call.Executable $call.Arguments 3 | Where-Object {$_} | ForEach-Object {$_ | ConvertFrom-Json})
        $result.Data.Docker='Em execução'
        foreach($environment in @('Normal','Demo')) {
          $pattern='^erp-pousada-app-\d+$'; if($environment -eq 'Demo'){$pattern='^erp-pousada-demo-app-demo-\d+$'}
          $app=$containers | Where-Object {$_.Names -match $pattern} | Select-Object -First 1
          $state='missing';$text='Não iniciado — use Iniciar.'
          if($app){
            $state='stopped';$text='Desligado'
            if($app.State -eq 'running') {
              $state='starting';$text='Ligado — verificando aplicativo e banco…'
              if($app.Status -match '\(unhealthy\)'){$state='degraded';$text='Com falha — consulte o diagnóstico.'}
            }
          }
          $result.Data[$environment]=@{State=$state;Text=$text}
        }
      }
      'Network' {
        # Override the mutation adapter in this runspace with a short read budget.
        function Invoke-Tailscale([string[]]$Arguments) {
          $script:PanelComponent='Tailscale'
          $command=Get-Command tailscale -CommandType Application -ErrorAction SilentlyContinue
          if(!$command){throw 'Tailscale não instalado.'}
          Invoke-PanelCommand $command.Source $Arguments 2
        }
        $context=Get-TailscaleContext
        $result.Data.Tailscale='Conectado — rede privada'
        foreach($environment in @('Normal','Demo')) {
          $demo=$environment -eq 'Demo';$port=3000;if($demo){$port=3001}
          try {
            $link=Find-TailscaleLink $context $port
            $url='';$access='Link não configurado — use Preparar link.'
            if($link -and (Read-PanelAddress $demo) -eq $link.URL){$url=$link.URL;$access='Link configurado — verificando acesso…'}
            $result.Data[$environment]=@{Url=$url;Access=$access}
          } catch {$result.Data[$environment]=@{Url='';Access=$_.Exception.Message}}
        }
      }
      'Backup' {$result.Data.Backup=Get-PanelBackupState}
      'Normal' {$result.Data=@{State='degraded';Text='Aplicativo ou banco sem resposta.'};if(Test-PanelHealth 'http://127.0.0.1:3000'){$result.Data=@{State='ready';Text='Pronto localmente — aplicativo e banco respondendo.'}}}
      'Demo' {$result.Data=@{State='degraded';Text='Aplicativo ou banco sem resposta.'};if(Test-PanelHealth 'http://127.0.0.1:3001'){$result.Data=@{State='ready';Text='Pronto localmente — aplicativo e banco respondendo.'}}}
      'NormalAccess' {if(Test-PanelHealth $Url){$result.Data.Access='Acesso privado pronto'}else{$result.Data.Access='Link sem resposta — confira o Tailscale.'}}
      'DemoAccess' {if(Test-PanelHealth $Url){$result.Data.Access='Acesso privado pronto'}else{$result.Data.Access='Link sem resposta — confira o Tailscale.'}}
      default {throw 'Consulta desconhecida.'}
    }
  } catch {$result.Ok=$false;$result.Message=$_.Exception.Message}
  $watch.Stop();$result.DurationMs=[math]::Round($watch.Elapsed.TotalMilliseconds)
  $result.Commands=@($script:PanelMetrics.ToArray())
  return $result | ConvertTo-Json -Depth 8 -Compress
}
