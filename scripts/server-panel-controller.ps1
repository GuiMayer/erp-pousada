# UI coordination. Network and process waits belong to background executors.
function Get-ActionEnvironment([string]$Action) {
  if($Action -match 'Normal'){return 'Normal'}
  if($Action -match 'Demo'){return 'Demo'}
  return ''
}
function Update-ActionAvailability {
  $idle=$null -eq $script:command
  foreach($button in $script:mutationButtons){$button.Enabled=$idle}
  foreach($environment in @('Normal','Demo')) {
    $card=$script:cards[$environment]
    $card.Remote.Enabled=$idle -and $card.State -in @('ready','starting','degraded')
    $active=!$idle -and $script:command.Environment -eq $environment
    $card.Cancel.Visible=$active;$card.Cancel.Enabled=$active -and !$script:command.Cancelled
  }
  if($folder){$folder.Enabled=$idle -and $script:cards.Normal.State -eq 'ready'}
  if($backup){$backup.Enabled=$idle -and $script:cards.Normal.State -eq 'ready'}
}
function Request-PanelCancel {
  if($script:command) {
    [IO.File]::WriteAllText($script:command.Cancel,'cancel');$script:command.Cancelled=$true
    $script:cancel.Enabled=$false
    $script:notice.Text='Cancelando a espera. Comandos já enviados podem ter efeito; os estados serão consultados novamente.'
    Update-ActionAvailability
  }
}
function Set-CardState([string]$Environment,$Data,[string]$Observed='') {
  $card=$script:cards[$Environment]
  if($Observed -and $card.Observed -and [DateTime]::Parse($Observed).ToUniversalTime() -lt $card.Observed){return}
  if($Data.State){$card.State=$Data.State;$card.Text=$Data.Text;$card.Status.Text=$Data.Text}
  if($Observed){$card.Observed=[DateTime]::Parse($Observed).ToUniversalTime()}
  $card.Status.ForeColor=switch($card.State){'ready'{[Drawing.Color]::ForestGreen};'degraded'{[Drawing.Color]::DarkOrange};default{$ink}}
  $stop=$card.State -in @('ready','starting','degraded')
  $card.Primary.Text=if($stop){'Encerrar'}else{'Iniciar'}
  $card.Primary.Tag=if($stop){"Stop$Environment"}else{"Start$Environment"}
  Update-ActionAvailability
}
function Set-CardAccess([string]$Environment,$Data) {
  $card=$script:cards[$Environment]
  if($null -ne $Data.Url){$card.UrlValue=$Data.Url;$card.Url.Text=if($Data.Url){$Data.Url}else{'Link ainda não configurado'}}
  if($Data.Access){$card.Access.Text=$Data.Access}
  $card.Copy.Enabled=!!$card.UrlValue;$card.Open.Enabled=!!$card.UrlValue
}
function Apply-OperationState($State,[string]$Observed) {
  foreach($environment in @('Normal','Demo')) {
    if($State.$environment){Set-CardState $environment $State.$environment $Observed}
    if($State."${environment}Access"){Set-CardAccess $environment $State."${environment}Access"}
  }
}
function Start-PanelAction([string]$Action,[string]$BackupDirectory='') {
  if($script:command){$script:notice.Text='Outra operação está em andamento. Você pode abrir sites, copiar links e consultar os estados.';return}
  $accepted=[DateTime]::UtcNow
  $environment=Get-ActionEnvironment $Action
  foreach($button in $script:mutationButtons){$button.Enabled=$false}
  $script:cancel.Enabled=$true
  $script:notice.Text='Operação aceita. Os links continuam disponíveis; acompanhe o progresso no cartão.'
  $script:notice.ForeColor=$muted
  if($environment){$card=$script:cards[$environment];$card.Progress.Visible=$true;$card.Stage.Text='Preparando a operação…';$card.Stage.Refresh()}
  $script:notice.Refresh()
  Reset-PanelMonitor $script:monitor
  $id='job-'+[Guid]::NewGuid().ToString('N')
  $result=Join-Path $local "$id.json";$progress=Join-Path $local "$id.progress.json";$cancelFile=Join-Path $local "$id.cancel"
  $arguments=@('-NoProfile','-File',(Join-Path $PSScriptRoot 'server-panel-worker.ps1'),'-Action',$Action,'-ResultFile',$result,'-ProgressFile',$progress,'-CancelFile',$cancelFile)
  if($BackupDirectory){$arguments+=@('-BackupDirectory',$BackupDirectory)}
  try {
    $process=Start-Process -FilePath (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe') -ArgumentList (($arguments | ForEach-Object {ConvertTo-ProcessArgument $_}) -join ' ') -WindowStyle Hidden -PassThru
    $script:command=@{Process=$process;Action=$Action;Environment=$environment;Result=$result;Progress=$progress;Cancel=$cancelFile;Started=$accepted;Stamp=[DateTime]::MinValue;Cancelled=$false}
    Update-ActionAvailability
  } catch {
    $script:notice.Text='Não foi possível iniciar o executor. Confira o diagnóstico.'
    Update-ActionAvailability;$script:cancel.Enabled=$false
    if($environment){$script:cards[$environment].Progress.Visible=$false}
  }
}
function Apply-Probe($Result) {
  $component=$Result.Component
  $script:diagnostics[$component]="$component | $($Result.DurationMs) ms | $(@($Result.Commands).Count) comandos | $(if($Result.Ok){'OK'}else{$Result.Message})"
  $busyEnvironment='';if($script:command){$busyEnvironment=$script:command.Environment}
  if(!$Result.Ok) {
    switch($component) {
      'Docker' {
        $script:dockerStatus.Text="Docker: $($Result.Message)"
        foreach($environment in @('Normal','Demo')) {if($environment -ne $busyEnvironment){$script:cards[$environment].Status.Text='Estado desatualizado — Docker sem resposta.'}}
      }
      'Network' {$script:networkStatus.Text="Tailscale: $($Result.Message)";foreach($card in $script:cards.Values){$card.Access.Text='Acesso não verificado — confira o Tailscale.'}}
      'Backup' {$script:backupStatus.Text="Backup: $($Result.Message)"}
    }
    return
  }
  switch($component) {
    'Docker' {
      $script:dockerStatus.Text="Docker: $($Result.Data.Docker)"
      foreach($environment in @('Normal','Demo')) {
        if($environment -eq $busyEnvironment){continue}
        $data=$Result.Data.$environment
        if($data.State -ne 'starting' -or $script:cards[$environment].State -ne 'ready'){Set-CardState $environment $data $Result.Observed}
        elseif($script:cards[$environment].Status.Text -like 'Estado desatualizado*'){$script:cards[$environment].Status.Text=$script:cards[$environment].Text}
        if($data.State -in @('starting','degraded')){$null=Start-PanelProbe $script:monitor $environment}
      }
    }
    'Network' {
      $script:networkStatus.Text="Tailscale: $($Result.Data.Tailscale)"
      foreach($environment in @('Normal','Demo')) {
        if($environment -eq $busyEnvironment){continue}
        $data=$Result.Data.$environment
        if($data.Url -and $data.Url -eq $script:cards[$environment].UrlValue){$data.Access=$script:cards[$environment].Access.Text}
        Set-CardAccess $environment $data
        if($Result.Data.$environment.Url){$null=Start-PanelProbe $script:monitor "${environment}Access" $Result.Data.$environment.Url}
      }
    }
    'Backup' {$script:backupStatus.Text="Backup: $($Result.Data.Backup)"}
    {$_ -in @('Normal','Demo')} {if($component -ne $busyEnvironment){Set-CardState $component $Result.Data $Result.Observed}}
    {$_ -in @('NormalAccess','DemoAccess')} {
      $environment=$component.Replace('Access','')
      if($environment -ne $busyEnvironment -and $Result.Url -eq $script:cards[$environment].UrlValue){Set-CardAccess $environment $Result.Data}
    }
  }
}
function Update-Panel {
  if($script:command) {
    $job=$script:command
    if([IO.File]::Exists($job.Progress)) {
      $stamp=[IO.File]::GetLastWriteTimeUtc($job.Progress)
      if($stamp -ne $job.Stamp) {
        try {
          $progress=[IO.File]::ReadAllText($job.Progress) | ConvertFrom-Json;$job.Stamp=$stamp
          Apply-OperationState $progress.State $progress.Updated
          if($job.Environment){$script:cards[$job.Environment].Stage.Text=$progress.Stage}else{$script:notice.Text=$progress.Stage}
        }catch{}
      }
    }
    if(([DateTime]::UtcNow-$job.Started).TotalMinutes -gt 12 -and !$job.Cancelled){[IO.File]::WriteAllText($job.Cancel,'timeout');$job.Cancelled=$true;$script:notice.Text='Prazo excedido. Cancelando a espera e consultando o estado real.'}
    if($job.Process.HasExited) {
      try {
        $result=[IO.File]::ReadAllText($job.Result) | ConvertFrom-Json
        Apply-OperationState $result.State $result.Observed
        $script:notice.Text=$result.Message
        $script:notice.ForeColor=if(!$result.Ok){[Drawing.Color]::Firebrick}elseif($result.Warning){[Drawing.Color]::DarkOrange}else{$muted}
        if($job.Environment){$script:cards[$job.Environment].Stage.Text=$result.Message}
        $script:diagnostics.Operation="$($job.Action) | $($result.DurationMs) ms | $(@($result.Commands).Count) comandos | $($result.Message)"
      } catch {$script:notice.Text='O executor não retornou um resultado. Confira o histórico; os serviços serão consultados novamente.'}
      finally {
        if($job.Environment){$script:cards[$job.Environment].Progress.Visible=$false}
        $job.Process.Dispose();$script:command=$null;$script:cancel.Enabled=$false
        Update-ActionAvailability
        foreach($file in @($job.Result,$job.Progress,$job.Cancel)){if([IO.File]::Exists($file)){[IO.File]::Delete($file)}}
        Reset-PanelMonitor $script:monitor
      }
    }
  }
  $busy=$null -ne $script:command;$minimized=$form.WindowState -eq 'Minimized'
  foreach($result in @(Receive-PanelProbes $script:monitor $busy $minimized)){Apply-Probe $result}
  foreach($component in @('Docker','Network','Backup')){$null=Start-PanelProbe $script:monitor $component}
  foreach($environment in @('Normal','Demo')) {
    $card=$script:cards[$environment]
    if($card.Observed) {
      $seconds=[int]([DateTime]::UtcNow-$card.Observed).TotalSeconds
      $card.Age.Text="Última verificação há $seconds s"
      if($seconds -gt 45){$card.Age.Text+=' • estado desatualizado'}
    }
  }
  if($details.Checked){$script:diagnosticText.Text=($script:diagnostics.Keys | Sort-Object | ForEach-Object {$script:diagnostics[$_]}) -join [Environment]::NewLine}
}
