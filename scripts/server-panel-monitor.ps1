# Scheduler independent from the command process and from WinForms.
function New-PanelMonitor([string]$ProbeFile=(Join-Path $PSScriptRoot 'server-panel-probes.ps1')) {
  $pool=[RunspaceFactory]::CreateRunspacePool(1,3)
  $pool.Open()
  return @{Pool=$pool;ProbeFile=$ProbeFile;Jobs=@{};Generation=0;Next=@{};Failures=@{};Latest=@{}}
}
function Start-PanelProbe($Monitor,[string]$Component,[string]$Url='',[switch]$Force) {
  if($Monitor.Jobs.ContainsKey($Component)){return $false}
  if(!$Force -and $Monitor.Next.ContainsKey($Component) -and [DateTime]::UtcNow -lt $Monitor.Next[$Component]){return $false}
  $pipeline=[PowerShell]::Create();$pipeline.RunspacePool=$Monitor.Pool
  $null=$pipeline.AddScript('param($file,$component,$url); . $file; Invoke-PanelProbe $component $url').AddArgument($Monitor.ProbeFile).AddArgument($Component).AddArgument($Url)
  $Monitor.Jobs[$Component]=@{Pipeline=$pipeline;Async=$pipeline.BeginInvoke();Generation=$Monitor.Generation;Started=[DateTime]::UtcNow}
  return $true
}
function Receive-PanelProbes($Monitor,[bool]$Busy=$false,[bool]$Minimized=$false) {
  foreach($component in @($Monitor.Jobs.Keys)) {
    $job=$Monitor.Jobs[$component]
    if(!$job.Async.IsCompleted){continue}
    try {
      $output=$job.Pipeline.EndInvoke($job.Async)
      if($job.Generation -ne $Monitor.Generation){continue}
      $result=($output | Out-String) | ConvertFrom-Json
      if(!$result){throw 'A consulta não retornou resultado.'}
      $Monitor.Latest[$component]=$result
      $failures=0;if(!$result.Ok){$failures=1+[int]$Monitor.Failures[$component]}
      $Monitor.Failures[$component]=$failures
      $seconds=20
      if($component -in @('Network','Backup','NormalAccess','DemoAccess')){$seconds=30}
      if($Busy -and $component -in @('Docker','Normal','Demo')){$seconds=2}
      if($Minimized){$seconds=60}
      if($failures){$seconds=[math]::Min(120,15*[math]::Pow(2,[math]::Min($failures,3)))}
      $Monitor.Next[$component]=[DateTime]::UtcNow.AddSeconds($seconds)
      $result
    } catch {
      $Monitor.Next[$component]=[DateTime]::UtcNow.AddSeconds(30)
      [pscustomobject]@{Component=$component;Ok=$false;Message='Não foi possível consultar este componente.';Observed=[DateTime]::UtcNow.ToString('o');DurationMs=0;Data=@{};Commands=@()}
    } finally {$job.Pipeline.Dispose();$job.Async.AsyncWaitHandle.Close();$Monitor.Jobs.Remove($component)}
  }
}
function Reset-PanelMonitor($Monitor) {
  # In-flight reads finish in the background, but can no longer overwrite newer state.
  $Monitor.Generation++;$Monitor.Next.Clear()
}
function Stop-PanelMonitor($Monitor) {
  foreach($job in @($Monitor.Jobs.Values)) {
    try {$job.Pipeline.Stop()}catch{}
    $job.Pipeline.Dispose();$job.Async.AsyncWaitHandle.Close()
  }
  $Monitor.Jobs.Clear();$Monitor.Pool.Close();$Monitor.Pool.Dispose()
}
