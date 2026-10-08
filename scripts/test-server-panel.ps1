$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'server-panel-process.ps1')
$script:OperationDeadline=[DateTime]::UtcNow.AddMinutes(1)
$executable=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$watch=[Diagnostics.Stopwatch]::StartNew()
try{Invoke-PanelCommand $executable @('-NoProfile','-Command','Start-Sleep -Seconds 10') 1;throw 'Prazo não aplicado'}catch{if($_.Exception.Message -notlike '*prazo*'){throw}}
if($watch.Elapsed.TotalSeconds -gt 5){throw 'Comando excedeu limite de recuperação'}
$script:CancelFile=Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N')+'.cancel')
try {
 [IO.File]::WriteAllText($script:CancelFile,'cancel')
 try{Invoke-PanelCommand $executable @('-NoProfile','-Command','exit 0');throw 'Cancelamento não aplicado'}catch{if($_.Exception.Message -notlike '*cancelada*'){throw}}
}finally{Remove-Item -LiteralPath $script:CancelFile;$script:CancelFile=''}
$script:CancelFile=Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N')+'.cancel')
$canceller=Start-Process $executable -ArgumentList ('-NoProfile -Command '+(ConvertTo-ProcessArgument "Start-Sleep -Seconds 1; [IO.File]::WriteAllText('$($script:CancelFile)','cancel')")) -WindowStyle Hidden -PassThru
try {
  try{Invoke-PanelCommand $executable @('-NoProfile','-Command','Start-Sleep -Seconds 10') 15;throw 'Cancelamento em andamento não aplicado'}catch{if($_.Exception.Message -notlike '*cancelada*'){throw}}
}finally{$canceller.WaitForExit();$canceller.Dispose();Remove-Item -LiteralPath $script:CancelFile;$script:CancelFile=''}
$output=Invoke-PanelCommand $executable @('-NoProfile','-Command',"Write-Output 'folder with spaces and quotes'")
if(($output|Out-String).Trim() -ne 'folder with spaces and quotes'){throw 'Argumentos não preservados'}
Write-Output 'Prazo, cancelamento e argumentos validados.'
