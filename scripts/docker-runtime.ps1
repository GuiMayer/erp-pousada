# Shared execution target for the panel and standalone Windows scripts.
$script:ErpDockerRoot=Split-Path $PSScriptRoot -Parent
function ConvertTo-ErpLinuxPath([string]$Path) {
  if($Path -match '^([A-Za-z]):[\\/](.*)$') { return '/mnt/'+$Matches[1].ToLowerInvariant()+'/'+$Matches[2].Replace('\','/') }
  return $Path
}
function Get-ErpDockerRuntime {
  $file=Join-Path $script:ErpDockerRoot '.local/docker-runtime.json'
  if(!(Test-Path -LiteralPath $file)){return @{Backend='desktop'}}
  $runtime=Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
  if($runtime.Backend -ne 'wsl' -or $runtime.Distribution -notmatch '^[A-Za-z0-9_-]+$'){throw 'Configuração do motor Docker inválida.'}
  return $runtime
}
function Get-ErpDockerInvocation([string[]]$Arguments) {
  $runtime=Get-ErpDockerRuntime
  if($runtime.Backend -eq 'wsl') {
    Start-ErpDockerKeepAlive $runtime.Distribution
    $root=ConvertTo-ErpLinuxPath $script:ErpDockerRoot
    $payload=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(((@($root)+$Arguments) -join [char]0)+[char]0))
    return @{Executable=(Get-Command wsl.exe -CommandType Application | Select-Object -First 1).Source; Arguments=@('--distribution',$runtime.Distribution,'--user','root','--exec','/usr/local/bin/erp-pousada-docker',$payload)}
  }
  return @{Executable=(Get-Command docker.exe -CommandType Application | Select-Object -First 1).Source; Arguments=$Arguments}
}
function Start-ErpDockerKeepAlive([string]$Distribution) {
  # systemd services alone do not keep WSL alive. Keep an explicit Windows
  # client attached while this machine is acting as the server.
  $file=Join-Path $script:ErpDockerRoot '.local/docker-wsl-keepalive.json'
  $mutex=New-Object Threading.Mutex($false,'Local\ErpPousadaWslKeepAlive')
  $locked=$false
  try {
    try{$locked=$mutex.WaitOne(5000)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(!$locked){throw 'Aguarde a inicializacao do Debian.'}
  if(Test-Path -LiteralPath $file) {
    try {
      $saved=Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
      $process=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$saved.ProcessId)"
      if($saved.Distribution -eq $Distribution -and $process.Name -eq 'wsl.exe' -and $process.CommandLine -like "*-d $Distribution -u root --exec sleep infinity*"){return}
    } catch { }
  }
  $log=Join-Path $script:ErpDockerRoot ('.local/wsl-keeper-'+[Guid]::NewGuid().ToString('N'))
  $process=Start-Process -FilePath (Get-Command wsl.exe).Source -ArgumentList "-d $Distribution -u root --exec sleep infinity" -WindowStyle Hidden -RedirectStandardOutput "$log.out" -RedirectStandardError "$log.err" -PassThru
  @{ProcessId=$process.Id;Distribution=$Distribution} | ConvertTo-Json -Compress | Set-Content -LiteralPath $file -Encoding UTF8
  } finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
}
function Invoke-ErpDocker([string[]]$Arguments) {
  $invocation=Get-ErpDockerInvocation $Arguments
  . (Join-Path $PSScriptRoot 'server-panel-process.ps1')
  $previousWslEnv=$env:WSLENV
  try {
    if((Get-ErpDockerRuntime).Backend -eq 'wsl') {
      $env:WSLENV=(@($previousWslEnv,'BOOTSTRAP_ADMIN_USERNAME','BOOTSTRAP_ADMIN_PASSWORD') | Where-Object {$_}) -join ':'
    }
    Invoke-PanelCommand $invocation.Executable $invocation.Arguments 3600
    $global:LASTEXITCODE=0
  } catch { $global:LASTEXITCODE=1; throw }
  finally { $env:WSLENV=$previousWslEnv }
}
