# Single adapter for bounded external commands. Only its own child is terminated.
function Set-PanelStage([string]$Text) {
  if ($script:ProgressFile) {
    @{ Stage=$Text; Updated=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress | Set-Content -LiteralPath $script:ProgressFile -Encoding UTF8
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
  try {
    $quoted=($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' '
    $process=Start-Process -FilePath $Executable -ArgumentList $quoted -WindowStyle Hidden -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile -PassThru
    $null=$process.Handle
    $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while (!$process.WaitForExit(200)) {
      Assert-PanelOperation
      if ([DateTime]::UtcNow -gt $deadline) { throw 'O comando não respondeu no prazo. Abra o serviço correspondente e tente novamente.' }
    }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'O serviço recusou o comando. Consulte o Docker ou Tailscale; a operação não foi concluída.' }
    return @(Get-Content -LiteralPath $outputFile -ErrorAction SilentlyContinue)
  } finally {
    if ($process) {
      if (!$process.HasExited) { $process.Kill(); $process.WaitForExit(3000) | Out-Null }
      $process.Dispose()
    }
    foreach($file in @($outputFile,$errorFile)){Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue}
  }
}
