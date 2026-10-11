$ErrorActionPreference='Stop'
$testDirectory=Join-Path ([IO.Path]::GetTempPath()) ('erp-recovery-test-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testDirectory)|Out-Null
$backup=Join-Path $testDirectory 'backup with spaces.dump'
[IO.File]::WriteAllText($backup,'mock-backup')
$global:RecoveryCalls=New-Object 'System.Collections.Generic.List[object]'
$global:RecoveryFail=$false
function global:Invoke-ErpDocker {
 param([string[]]$Arguments)
 $global:RecoveryCalls.Add([string[]]$Arguments)
 $global:LASTEXITCODE=0
 if($global:RecoveryFail -and $Arguments -contains 'pg_restore'){throw 'mock-restore-failure'}
 if($Arguments -contains 'psql'){return 'mock-manifest-or-check'}
 return 'mock-docker'
}
try{
 & (Join-Path $PSScriptRoot 'test-recovery.ps1') -BackupFile $backup -OutputDirectory $testDirectory | Out-Null
 $run=$global:RecoveryCalls | Where-Object {$_[0] -eq 'run'} | Select-Object -First 1
 if(!($run -contains 'none') -or !($run -contains '256m') -or ($run -contains '--publish') -or ($run -contains '--volume')){throw 'Recuperação sem isolamento'}
 $name=$run[[Array]::IndexOf($run,'--name')+1]
 if($name -notmatch '^erp-recovery-[a-f0-9]{32}$'){throw 'Nome do container inválido'}
 $cleanup=$global:RecoveryCalls | Where-Object {$_[0] -eq 'rm'} | Select-Object -Last 1
 if($cleanup[-1] -ne $name){throw 'Limpeza apontou para outro container'}
 $global:RecoveryFail=$true
 try{& (Join-Path $PSScriptRoot 'test-recovery.ps1') -BackupFile $backup -OutputDirectory $testDirectory | Out-Null;throw 'Falha não propagada'}catch{if($_.Exception.Message -notlike '*mock-restore-failure*'){throw}}
 if($global:RecoveryCalls[-1][0] -ne 'rm'){throw 'Container não removido após falha'}
 Write-Output 'Destino isolado, limites, caminhos com espaços e limpeza após falha validados.'
}finally{
 $verified=[IO.Path]::GetFullPath($testDirectory)
 if(!$verified.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $verified -Leaf) -notmatch '^erp-recovery-test-[a-f0-9]{32}$'){throw 'Destino de limpeza inválido'}
 foreach($file in (Get-ChildItem -LiteralPath $verified -File)){Remove-Item -LiteralPath $file.FullName}
 Remove-Item -LiteralPath $verified
}
