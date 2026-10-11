$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'server-panel-monitor.ps1')
. (Join-Path $PSScriptRoot 'server-panel-probes.ps1')
. (Join-Path $PSScriptRoot 'server-panel-actions.ps1')
function Assert($Condition,[string]$Message){if(!$Condition){throw $Message}}
$testDirectory=Join-Path ([IO.Path]::GetTempPath()) ('erp-panel-test-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testDirectory) | Out-Null
$monitor=$null
try {
  $listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
  $listener.Start()
  try {
    $port=$listener.LocalEndpoint.Port;$healthWatch=[Diagnostics.Stopwatch]::StartNew()
    $healthy=Test-PanelHealth "http://127.0.0.1:$port" 150
    $healthWatch.Stop()
    Assert (!$healthy -and $healthWatch.ElapsedMilliseconds -lt 1500) 'Health request exceeded whole-request deadline'
  } finally {$listener.Stop()}
  $fixture=Join-Path $testDirectory 'probe.ps1'
  [IO.File]::WriteAllText($fixture,@'
function Invoke-PanelProbe($Component,$Url) {
  $delay=20;if($Component -eq 'Docker'){$delay=600}
  Start-Sleep -Milliseconds $delay
  if($Component -eq 'Throw'){throw 'simulated failure'}
  @{Component=$Component;Ok=($Component -ne 'Fail');Observed=[DateTime]::UtcNow.ToString('o');Data=@{Value=$Url};DurationMs=$delay;Message='simulated'} | ConvertTo-Json -Compress
}
'@)
  $monitor=New-PanelMonitor $fixture
  Assert (Start-PanelProbe $monitor 'Docker') 'First probe refused'
  Assert (!(Start-PanelProbe $monitor 'Docker')) 'Duplicate probe scheduled'
  $null=Start-PanelProbe $monitor 'Network'
  $watch=[Diagnostics.Stopwatch]::StartNew();$received=@()
  do {$received+=@(Receive-PanelProbes $monitor);Start-Sleep -Milliseconds 20}while(!$received.Count -and $watch.ElapsedMilliseconds -lt 4000)
  Assert ($received[0].Component -eq 'Network') 'Slow Docker blocked independent network result'
  Reset-PanelMonitor $monitor
  while($monitor.Jobs.Count -and $watch.ElapsedMilliseconds -lt 5000){$received=@(Receive-PanelProbes $monitor);Assert (!$received.Count) 'Old generation overwrote newer state';Start-Sleep -Milliseconds 20}
  Assert ($monitor.Jobs.Count -eq 0) 'Completed stale job leaked'
  $null=Start-PanelProbe $monitor 'Throw'
  Reset-PanelMonitor $monitor
  do {$received=@(Receive-PanelProbes $monitor);Assert (!$received.Count) 'Stale exception overwrote newer state';Start-Sleep -Milliseconds 20}while($monitor.Jobs.Count)
  $null=Start-PanelProbe $monitor 'Fail'
  do {$received=@(Receive-PanelProbes $monitor);Start-Sleep -Milliseconds 20}while(!$received.Count)
  Assert (!$received[0].Ok) 'Failure classification lost'
  Assert (($monitor.Next.Fail-[DateTime]::UtcNow).TotalSeconds -gt 25) 'Failure did not back off'
  Assert (!(Start-PanelProbe $monitor 'Fail')) 'Failure backoff ignored'
  $null=Start-PanelProbe $monitor 'Normal' -Force
  do {$received=@(Receive-PanelProbes $monitor $true);Start-Sleep -Milliseconds 20}while(!$received.Count)
  Assert (($monitor.Next.Normal-[DateTime]::UtcNow).TotalSeconds -lt 3) 'Active polling not accelerated'
  $null=Start-PanelProbe $monitor 'Backup' -Force
  do {$received=@(Receive-PanelProbes $monitor $false $true);Start-Sleep -Milliseconds 20}while(!$received.Count)
  Assert (($monitor.Next.Backup-[DateTime]::UtcNow).TotalSeconds -gt 50) 'Minimized polling not reduced'
  for($iteration=0;$iteration -lt 30;$iteration++) {
    $null=Start-PanelProbe $monitor 'Reuse' -Force
    do {$received=@(Receive-PanelProbes $monitor);Start-Sleep -Milliseconds 5}while(!$received.Count)
    Assert ($monitor.Jobs.Count -eq 0) 'Repeated monitoring leaked jobs'
  }
  Stop-PanelMonitor $monitor;$monitor=$null

  # Passive WSL invocation must not create a keeper.
  function Get-ErpDockerRuntime { @{Backend='wsl';Distribution='PanelTest'} }
  function Start-ErpDockerKeepAlive { throw 'Passive probe created a keeper' }
  $call=Get-ErpDockerInvocation @('ps') -ReadOnly
  Assert ($call.Arguments -contains 'PanelTest') 'Read-only Docker target changed'
  function Invoke-PanelCommand($Executable,$Arguments,$TimeoutSeconds) { "OtherDistribution`0" }
  $probe=Invoke-PanelProbe 'Docker' | ConvertFrom-Json
  Assert ($probe.Data.Normal.State -eq 'offline') 'Stopped WSL was not identified without starting it'
  function Get-ErpDockerRuntime { @{Backend='desktop'} }
  function Get-ErpDockerInvocation($Arguments,[switch]$ReadOnly){Assert $ReadOnly 'Docker probe is not passive';@{Executable='simulated';Arguments=$Arguments}}
  $script:probeCalls=0
  function Invoke-PanelCommand($Executable,$Arguments,$TimeoutSeconds) {
    $script:probeCalls++
    @(@{Names='erp-pousada-app-1';State='running';Status='Up (healthy)'},@{Names='erp-pousada-demo-app-demo-1';State='exited';Status='Exited'},@{Names='another-app-1';State='running';Status='Up'}) | ForEach-Object {$_ | ConvertTo-Json -Compress}
  }
  $probe=Invoke-PanelProbe 'Docker' | ConvertFrom-Json
  Assert ($probe.Ok -and $probe.Data.Normal.State -eq 'starting' -and $probe.Data.Demo.State -eq 'stopped' -and $script:probeCalls -eq 1) 'Docker snapshot did not group/isolate projects'
  function Get-PanelBackupState {throw 'simulated backup failure'}
  $probe=Invoke-PanelProbe 'Backup' | ConvertFrom-Json
  Assert (!$probe.Ok -and $probe.Component -eq 'Backup') 'Backup failure misclassified as Docker failure'

  # Batched normal startup, preservation on shutdown and remote failure isolation.
  $global:PanelTestCalls=New-Object Collections.Generic.List[object]
  function Invoke-Docker([string[]]$Arguments) {
    $global:PanelTestCalls.Add($Arguments) | Out-Null
    switch($Arguments[0]) {
      'ps' { @('app','postgres','backup-worker') | ForEach-Object {@{ID=$_;Names="erp-pousada-$_-1";State='running'} | ConvertTo-Json -Compress} }
      'inspect' {
        foreach($id in $Arguments[3..($Arguments.Length-1)]) {
          @{Id=$id;State=@{Running=$true};Config=@{Labels=@{'com.docker.compose.service'=$id}}} | ConvertTo-Json -Depth 5 -Compress
        }
      }
    }
  }
  function Wait-Healthy {}
  function Test-PanelHealth {return $true}
  function Connect-PanelApp {throw 'Tailscale desconectado.'}
  $result=Invoke-PanelAction 'StartNormal'
  Assert ($result.Ok -and $result.Warning -and $result.State.Normal.State -eq 'ready') 'Tailscale failure masked a healthy server'
  Assert (@($global:PanelTestCalls | Where-Object {$_[0] -eq 'inspect'}).Count -eq 1) 'Startup did not inspect containers in one batch'
  $global:PanelTestCalls.Clear();$result=Invoke-PanelAction 'StopNormal'
  Assert ($result.Ok -and $result.State.Normal.State -eq 'stopped') 'Normal shutdown failed'
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'down' -or $_ -contains '--volumes'}).Count -eq 0) 'Normal shutdown could delete data'

  # Execute the real demo script in an isolated directory with fake Docker only.
  $scriptsDirectory=Join-Path $testDirectory 'scripts';[IO.Directory]::CreateDirectory($scriptsDirectory) | Out-Null
  Copy-Item (Join-Path $PSScriptRoot 'start-demo.ps1') $scriptsDirectory
  [IO.File]::WriteAllText((Join-Path $scriptsDirectory 'docker-runtime.ps1'),'# isolated test runtime')
  [IO.File]::WriteAllLines((Join-Path $testDirectory '.env.demo.local'),@('DEMO_APP_URL=http://localhost:3001','DEMO_LOGIN_PASSWORD=test-only'))
  function icacls {$global:LASTEXITCODE=0}
  $global:PanelTestDemoRunning=$true;$global:PanelTestDemoImage=$true;$global:PanelTestFailBuild=$false
  function Invoke-Docker([string[]]$Arguments) {
    $global:PanelTestCalls.Add($Arguments) | Out-Null
    if($Arguments -contains 'build' -and $global:PanelTestFailBuild){throw 'simulated build failure'}
    if($Arguments[0] -eq 'image' -and $global:PanelTestDemoImage){return 'image-id'}
    if($Arguments -contains 'ps' -and $global:PanelTestDemoRunning){return 'app-id'}
    if($Arguments[0] -eq 'inspect'){return 'healthy'}
    if($Arguments -contains 'up'){$global:PanelTestDemoRunning=$true}
  }
  $global:PanelTestCalls.Clear();& (Join-Path $scriptsDirectory 'start-demo.ps1')
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'down' -or $_ -contains 'build' -or $_ -contains 'up'}).Count -eq 0) 'Starting running demo altered the session'
  $global:PanelTestCalls.Clear();$global:PanelTestDemoRunning=$false
  & (Join-Path $scriptsDirectory 'start-demo.ps1')
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'build'}).Count -eq 0) 'Installed demo image rebuilt unnecessarily'
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'up' -and $_ -contains '--no-build'}).Count -eq 1) 'Demo did not use installed image'
  $global:PanelTestCalls.Clear();& (Join-Path $scriptsDirectory 'start-demo.ps1') -Reset
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'down'}).Count -eq 1) 'Explicit reset did not restore demo'
  $global:PanelTestCalls.Clear();$global:PanelTestFailBuild=$true
  try {& (Join-Path $scriptsDirectory 'start-demo.ps1') -Update;throw 'Expected build failure'}catch{Assert ($_.Exception.Message -like '*simulated build*') 'Unexpected update failure'}
  Assert (@($global:PanelTestCalls | Where-Object {$_ -contains 'down'}).Count -eq 0) 'Failed update destroyed running demo'
  foreach($arguments in $global:PanelTestCalls){Assert ($arguments -notcontains 'erp-pousada') 'Demo targeted operational project'}
  Copy-Item (Join-Path $PSScriptRoot 'server-panel-actions.ps1') $scriptsDirectory
  . (Join-Path $scriptsDirectory 'server-panel-actions.ps1')
  $script:ProgressFile=Join-Path $testDirectory 'progress.json'
  $script:CancelFile=Join-Path $testDirectory 'cancel'
  $global:PanelTestExpectedCancel=$script:CancelFile
  $script:OperationDeadline=[DateTime]::UtcNow.AddMinutes(1)
  $global:PanelTestFailBuild=$false;$global:PanelTestDemoRunning=$true
  function Invoke-Docker([string[]]$Arguments) {
    Assert ($script:CancelFile -eq $global:PanelTestExpectedCancel) 'Demo lost cancellation context'
    Assert-PanelOperation
    $global:PanelTestCalls.Add($Arguments) | Out-Null
    if($Arguments -contains 'ps'){return 'app-id'}
    if($Arguments[0] -eq 'inspect'){return 'healthy'}
  }
  $result=Invoke-PanelAction 'StartDemo'
  $progress=[IO.File]::ReadAllText($script:ProgressFile) | ConvertFrom-Json
  Assert ($result.Ok -and $progress.State.Demo.State -eq 'ready') 'Demo did not publish progress from its script'
  [IO.File]::WriteAllText($script:CancelFile,'cancel')
  $result=Invoke-PanelAction 'StartDemo'
  Assert (!$result.Ok -and $result.Message -like '*cancelada*') 'Demo ignored cooperative cancellation'
  $script:CancelFile='';$script:ProgressFile=''
  Write-Output 'Monitoramento independente, resultados antigos, intervalos, WSL passivo, lote Docker e demonstração validados.'
} finally {
  if($monitor){Stop-PanelMonitor $monitor}
  Set-Location (Split-Path $PSScriptRoot -Parent)
  # Only the exact temporary fixture directory created by this test is removed.
  if($testDirectory.StartsWith([IO.Path]::GetTempPath(),[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $testDirectory -Recurse -Force}
}
