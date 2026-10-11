# Single adapter for bounded external commands. Only its own child is terminated.
function Write-PanelJson([string]$Path,$Value) {
  $temporary="$Path.$([Guid]::NewGuid().ToString('N')).tmp"
  try {
    [IO.File]::WriteAllText($temporary,($Value | ConvertTo-Json -Depth 8 -Compress),(New-Object Text.UTF8Encoding($false)))
    if([IO.File]::Exists($Path)){[IO.File]::Replace($temporary,$Path,$null)}else{[IO.File]::Move($temporary,$Path)}
  } finally {if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}}
}
function Set-PanelStage([string]$Text,[hashtable]$State=@{}) {
  if ($script:ProgressFile) {
    if(!$script:PanelProgressState){$script:PanelProgressState=@{}}
    foreach($key in $State.Keys){$script:PanelProgressState[$key]=$State[$key]}
    Write-PanelJson $script:ProgressFile @{ Stage=$Text; State=$script:PanelProgressState; Updated=[DateTime]::UtcNow.ToString('o') }
  }
}
function Assert-PanelOperation {
  if ($script:CancelFile -and (Test-Path -LiteralPath $script:CancelFile)) { throw 'Espera cancelada. Serviços podem ter iniciado parcialmente; confira seus estados.' }
  if ($script:OperationDeadline -and [DateTime]::UtcNow -gt $script:OperationDeadline) { throw 'Tempo total excedido. Confira os serviços antes de tentar novamente.' }
}
function ConvertTo-ProcessArgument([string]$Value) {
  # Windows CommandLineToArgvW rules, including quotes and trailing backslashes.
  return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Invoke-PanelCommand([string]$Executable,[string[]]$Arguments,[int]$TimeoutSeconds=30) {
  Assert-PanelOperation
  $directory=Join-Path ([IO.Path]::GetTempPath()) 'erp-pousada-panel'
  [IO.Directory]::CreateDirectory($directory) | Out-Null
  $id=[Guid]::NewGuid().ToString('N')
  $outputFile=Join-Path $directory "$id.out"
  $errorFile=Join-Path $directory "$id.err"
  $process=$null
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $outcome='failed'; $exitCode=$null
  $tool=$script:PanelComponent
  if(!$tool){$tool=[IO.Path]::GetFileNameWithoutExtension($Executable)}
  try {
    # wsl.exe parses its own switches from the raw Windows command line and
    # treats quoted switches as Linux command text. Keep simple switches bare.
    $isWsl=[IO.Path]::GetFileName($Executable) -ieq 'wsl.exe'
    $quoted=($Arguments | ForEach-Object { if($isWsl -and $_ -match '^[A-Za-z0-9_./:+={}=-]+$'){$_}else{ConvertTo-ProcessArgument $_} }) -join ' '
    $process=Start-Process -FilePath $Executable -ArgumentList $quoted -WindowStyle Hidden -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile -PassThru
    $null=$process.Handle
    $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while (!$process.WaitForExit(200)) {
      Assert-PanelOperation
      if ([DateTime]::UtcNow -gt $deadline) { $outcome='timeout'; throw "$tool não respondeu no prazo. Abra o serviço correspondente e tente novamente." }
    }
    $process.WaitForExit()
    $exitCode=$process.ExitCode
    if ($exitCode -ne 0) {
      # Classify stderr without saving it: CLI output can contain credentials.
      $reason='recusou o comando'
      $stderr=Get-Content -Raw -LiteralPath $errorFile -ErrorAction SilentlyContinue
      if($stderr -match 'Cannot connect|Is the docker daemon running|connection refused'){$reason='está indisponível; confira se o serviço está ligado'}
      elseif($stderr -match 'permission denied|access is denied'){$reason='negou acesso; confira as permissões'}
      elseif($stderr -match 'not logged in|logged out'){$reason='está desconectado; abra o aplicativo e conecte sua conta'}
      throw "$tool $reason (código $exitCode)."
    }
    $outcome='ok'
    return @(Get-Content -LiteralPath $outputFile -ErrorAction SilentlyContinue)
  } finally {
    if ($process) {
      if (!$process.HasExited) { $process.Kill(); $process.WaitForExit(3000) | Out-Null }
      $process.Dispose()
    }
    foreach($file in @($outputFile,$errorFile)){Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue}
    $watch.Stop()
    if($null -ne $script:PanelMetrics){$script:PanelMetrics.Add(@{Component=$tool;DurationMs=[math]::Round($watch.Elapsed.TotalMilliseconds);Outcome=$outcome;ExitCode=$exitCode}) | Out-Null}
  }
}
