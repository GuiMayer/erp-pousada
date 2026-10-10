param([Parameter(Mandatory=$true)][string]$BackupFile,[string]$OutputDirectory)
$ErrorActionPreference='Stop'
if(!(Get-Command Invoke-ErpDocker -CommandType Function -ErrorAction SilentlyContinue)){. (Join-Path $PSScriptRoot 'docker-runtime.ps1')}
$script:OperationDeadline=[DateTime]::UtcNow.AddMinutes(8)
$resolvedBackup=(Resolve-Path -LiteralPath $BackupFile).Path
if(!(Test-Path -LiteralPath $resolvedBackup -PathType Leaf) -or [IO.Path]::GetExtension($resolvedBackup) -ne '.dump'){throw 'Selecione um arquivo .dump de backup.'}
if(!$OutputDirectory){$OutputDirectory=Join-Path (Split-Path $PSScriptRoot -Parent) '.local/recovery'}
[IO.Directory]::CreateDirectory([IO.Path]::GetFullPath($OutputDirectory))|Out-Null
$container='erp-recovery-'+[Guid]::NewGuid().ToString('N')
$started=[Diagnostics.Stopwatch]::StartNew()
function Invoke-RecoveryDocker([string[]]$Arguments){
 if($Arguments[0] -eq 'cp' -and (Get-Command Get-ErpDockerRuntime -ErrorAction SilentlyContinue) -and (Get-ErpDockerRuntime).Backend -eq 'wsl'){$Arguments[1]=ConvertTo-ErpLinuxPath $Arguments[1]}
 return Invoke-ErpDocker $Arguments
}
try{
 Write-Output 'Criando banco descartável sem portas, rede ou volumes da operação…'
 Invoke-RecoveryDocker @('run','--detach','--name',$container,'--network','none','--memory','256m','--cpus','0.5','--shm-size','64m','--label','erp-purpose=recovery-test','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_USER=restore','--env','POSTGRES_DB=erp_restore','postgres:16-alpine')|Out-Null
 $ready=$false
 for($attempt=0;$attempt -lt 60;$attempt++) {try{Invoke-RecoveryDocker @('exec',$container,'pg_isready','-U','restore','-d','erp_restore')|Out-Null;$ready=$true;break}catch{if($attempt -eq 59){throw};Start-Sleep -Seconds 1}}
 if(!$ready){throw 'Banco descartável não ficou disponível em 60 segundos.'}
 Invoke-RecoveryDocker @('cp',$resolvedBackup,"${container}:/tmp/input.dump")|Out-Null
 Invoke-RecoveryDocker @('cp',(Join-Path $PSScriptRoot 'db-recovery-manifest.sql'),"${container}:/tmp/manifest.sql")|Out-Null
 Invoke-RecoveryDocker @('cp',(Join-Path $PSScriptRoot 'db-recovery-check.sql'),"${container}:/tmp/check.sql")|Out-Null
 Write-Output 'Restaurando exclusivamente no banco descartável…'
 Invoke-RecoveryDocker @('exec',$container,'pg_restore','-U','restore','-d','erp_restore','--exit-on-error','--single-transaction','--no-owner','--no-acl','/tmp/input.dump')|Out-Null
 $checks=Invoke-RecoveryDocker @('exec',$container,'psql','-U','restore','-d','erp_restore','-f','/tmp/check.sql')
 $manifest=Invoke-RecoveryDocker @('exec',$container,'psql','-q','-U','restore','-d','erp_restore','--csv','-f','/tmp/manifest.sql')
 $stamp=[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
 [IO.File]::WriteAllLines((Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) "manifest-$stamp.csv"),[string[]]$manifest,(New-Object Text.UTF8Encoding($false)))
 Write-Output ($checks|Out-String)
 Write-Output "Restauração isolada validada em $([Math]::Round($started.Elapsed.TotalSeconds,1)) segundos. O manifesto foi salvo na pasta de saída. Homologação da instalação e metas RPO/RTO ainda precisam ser medidas no equipamento final."
}finally{
 # Remove only the uniquely named container created for this test.
 $script:OperationDeadline=[DateTime]::UtcNow.AddSeconds(30)
 Invoke-RecoveryDocker @('rm','--force',$container)|Out-Null
}
