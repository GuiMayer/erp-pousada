function Read-PanelConfig([string]$Key,[string]$Default='') {
  $file=Join-Path (Split-Path $PSScriptRoot -Parent) '.env.docker.local'
  $line=Get-Content -LiteralPath $file | Where-Object { $_.StartsWith("$Key=") } | Select-Object -First 1
  if($line){return $line.Substring($Key.Length+1).Trim().Trim('"',"'")}
  return $Default
}
function Get-PanelBackupState {
  $root=Split-Path $PSScriptRoot -Parent
  $directory=Read-PanelConfig 'BACKUP_HOST_DIR' './backups'
  if(![IO.Path]::IsPathRooted($directory)){$directory=Join-Path $root $directory}
  $messages=@()
  foreach($entry in @(@('last-local-success','Local'),@('last-secondary-success','Segunda pasta'),@('last-remote-success','Remoto criptografado'))) {
    if($entry[0] -eq 'last-secondary-success' -and (Read-PanelConfig 'BACKUP_SECONDARY_ENABLED' 'false') -ne 'true'){continue}
    $marker=Join-Path $directory $entry[0]
    if(Test-Path -LiteralPath $marker){
      $time=(Get-Item -LiteralPath $marker).LastWriteTime
      $messages += "$($entry[1]): $($time.ToString('dd/MM HH:mm'))"
      if(([DateTime]::Now-$time).TotalMinutes -gt ([double](Read-PanelConfig 'BACKUP_INTERVAL_MINUTES' '30')*2+5)){$messages+="$($entry[1]): cópia atrasada; confira o serviço."}
    } elseif($entry[0] -eq 'last-secondary-success'){$messages+='Segunda pasta: aguardando primeira cópia'}
  }
  if((Read-PanelConfig 'BACKUP_SECONDARY_ENABLED' 'false') -ne 'true'){$messages+='Segunda pasta: não configurada'}
  if(Test-Path -LiteralPath (Join-Path $directory 'last-error')){$messages+='ATENÇÃO: a última tentativa de backup falhou.'}
  if(!$messages.Count){return 'Nenhum backup confirmado. Faça um backup agora.'}
  return $messages -join ' · '
}
function Configure-PanelBackup([string]$Directory) {
  $root=Split-Path $PSScriptRoot -Parent
  if(!$Directory -or ![IO.Path]::IsPathRooted($Directory) -or $Directory -match '[\r\n"$#]') {throw 'Selecione uma pasta válida para guardar a segunda cópia.'}
  $destination=[IO.Path]::GetFullPath($Directory).TrimEnd('\','/')
  $primary=Read-PanelConfig 'BACKUP_HOST_DIR' './backups'
  if(![IO.Path]::IsPathRooted($primary)){$primary=Join-Path $root $primary}
  $primary=[IO.Path]::GetFullPath($primary).TrimEnd('\','/')
  if($destination -eq $primary -or $destination.StartsWith("$primary\",[StringComparison]::OrdinalIgnoreCase)) {throw 'Escolha uma pasta diferente do backup principal.'}
  [IO.Directory]::CreateDirectory($destination) | Out-Null
  $probe=Join-Path $destination ([Guid]::NewGuid().ToString('N')+'.tmp')
  try{[IO.File]::WriteAllText($probe,'ERP backup write test')}finally{Remove-Item -LiteralPath $probe -ErrorAction SilentlyContinue}
  $file=Join-Path $root '.env.docker.local'
  $original=[IO.File]::ReadAllText($file)
  $lines=@([IO.File]::ReadAllLines($file) | Where-Object {$_ -notmatch '^BACKUP_SECONDARY_(HOST_DIR|ENABLED)='})
  $lines += @("BACKUP_SECONDARY_HOST_DIR=$($destination.Replace('\','/'))",'BACKUP_SECONDARY_ENABLED=true')
  try {
    [IO.File]::WriteAllLines($file,$lines,(New-Object Text.UTF8Encoding($false)))
    Set-PanelStage 'Aplicando a pasta de backup; banco e aplicativo serão preservados…'
    Invoke-Docker @('compose','--project-name','erp-pousada','--env-file',$file,'-f','docker-compose.yml','-f','compose.lan.yml','up','-d','--no-build','--no-deps','backup-worker') | Out-Null
  } catch { [IO.File]::WriteAllText($file,$original,(New-Object Text.UTF8Encoding($false))); throw }
}
function Invoke-PanelBackup {
  Set-PanelStage 'Gerando e verificando backup; copiando para os destinos configurados…'
  $worker=Get-Containers 'erp-pousada' | Where-Object {$_.Names -match '-backup-worker-\d+$'} | Select-Object -First 1
  if(!$worker -or $worker.State -ne 'running'){throw 'Inicie o sistema normal antes de fazer o backup.'}
  Invoke-Docker @('exec',$worker.ID,'sh','/scripts/db-backup.sh') | Out-Null
}
