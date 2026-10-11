param(
  [Parameter(Mandatory=$true)][ValidateSet('Status','StartEngine','StartNormal','StopNormal','StartDemo','ResetDemo','UpdateDemo','StopDemo','ConnectNormal','ConnectDemo','ConfigureBackup','BackupNow')][string]$Action,
  [Parameter(Mandatory=$true)][string]$ResultFile,
  [string]$ProgressFile='', [string]$CancelFile='', [string]$BackupDirectory=''
)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. (Join-Path $PSScriptRoot 'server-panel-probes.ps1')
. (Join-Path $PSScriptRoot 'server-panel-actions.ps1')
$script:ProgressFile=$ProgressFile;$script:CancelFile=$CancelFile
$script:OperationDeadline=[DateTime]::UtcNow.AddMinutes(12)
$script:PanelMetrics=New-Object Collections.Generic.List[object]
$script:PanelStages=New-Object Collections.Generic.List[object]
$watch=[Diagnostics.Stopwatch]::StartNew()
$mutex=$null;$locked=$false
$result=@{Ok=$false;Message='';State=@{}}
try {
  if($Action -eq 'Status') {
    $result=@{Ok=$true;Message='Estados atualizados.';Normal='';Demo='';Docker='';Tailscale='';Backup='';NormalLink='';DemoLink='';NormalAccess='';DemoAccess=''}
    foreach($component in @('Docker','Network','Backup')) {
      $probe=Invoke-PanelProbe $component | ConvertFrom-Json
      if(!$probe.Ok){$result[$component]=$probe.Message;continue}
      foreach($key in $probe.Data.PSObject.Properties.Name) {
        if($key -in @('Normal','Demo')) {
          if($component -eq 'Docker'){$result[$key]=$probe.Data.$key.Text}
          else {$result["${key}Link"]=$probe.Data.$key.Url;$result["${key}Access"]=$probe.Data.$key.Access}
        } else {$result[$key]=$probe.Data.$key}
      }
    }
  } else {
    $mutex=New-Object Threading.Mutex($false,'Local\ErpPousadaServerOperation')
    try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(!$locked){throw 'Outra operação está em andamento. Aguarde sua conclusão.'}
    $result=Invoke-PanelAction $Action $BackupDirectory
  }
} catch {$result.Message=$_.Exception.Message}
finally {
  if($locked){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}
  $watch.Stop();$result.Action=$Action;$result.Observed=[DateTime]::UtcNow.ToString('o')
  Set-PanelStage 'Operação finalizada.' $result.State
  $result.Stages=@($script:PanelStages.ToArray())
  $result.DurationMs=[math]::Round($watch.Elapsed.TotalMilliseconds);$result.Commands=@($script:PanelMetrics.ToArray())
  Write-PanelJson $ResultFile $result
  if($Action -ne 'Status') {
    $directory=Join-Path (Split-Path $PSScriptRoot -Parent) '.local/server-panel'
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    Write-PanelJson (Join-Path $directory 'last-operation.json') $result
    if(!$result.Ok){Write-PanelJson (Join-Path $directory 'last-error.json') $result}
    Write-PanelJson (Join-Path $directory ('operation-'+[Guid]::NewGuid().ToString('N')+'.json')) $result
    Get-ChildItem -LiteralPath $directory -Filter 'operation-*.json' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
  }
}
