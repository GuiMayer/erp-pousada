param([switch]$SelfTest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'server-panel-process.ps1')
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
[Windows.Forms.Application]::EnableVisualStyles()
$root=Split-Path $PSScriptRoot -Parent
$local=Join-Path $root '.local/server-panel'
[IO.Directory]::CreateDirectory($local) | Out-Null
$script:job=$null
$script:pendingAction=$null
$script:nextRefresh=[DateTime]::MinValue
$script:buttons=@()
$form=New-Object Windows.Forms.Form
$form.Text='ERP Pousada | Servidores'
$form.ClientSize=New-Object Drawing.Size(840,810)
$form.StartPosition='CenterScreen'
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$form.BackColor=[Drawing.Color]::WhiteSmoke
$form.AutoScaleMode='Dpi'
function Label([string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height) {
  $label=New-Object Windows.Forms.Label
  $label.Text=$Text; $label.SetBounds($X,$Y,$Width,$Height)
  $form.Controls.Add($label)
  return $label
}
$title=Label 'Controle dos servidores' 24 18 790 35
$title.Font=New-Object Drawing.Font('Segoe UI',17,[Drawing.FontStyle]::Bold)
$null=Label 'Iniciar também configura o link privado pelo Tailscale. Docker e Tailscale precisam estar conectados.' 24 62 790 42
$normalTitle=Label 'Sistema normal · Porta 3000' 24 120 380 28
$demoTitle=Label 'Demonstração · Porta 3001' 436 120 380 28
foreach($label in @($normalTitle,$demoTitle)) { $label.Font=New-Object Drawing.Font('Segoe UI',12,[Drawing.FontStyle]::Bold) }
$script:normalStatus=Label 'Verificando servidor…' 24 157 380 46
$script:demoStatus=Label 'Verificando servidor…' 436 157 380 46
$null=Label 'Dados permanentes. Encerrar preserva o banco e os backups.' 24 209 380 42
$null=Label 'Iniciar atualiza a versão e restaura os exemplos; encerrar descarta as alterações.' 436 209 380 42
function Run-Worker([string]$Action,[string]$BackupDirectory='') {
  if ($script:job) {
    if ($script:job.Action -eq 'Status' -and $Action -ne 'Status') {
      $script:pendingAction=$Action
      foreach($button in $script:buttons) { $button.Enabled=$false }
    }
    return
  }
  $id=[Guid]::NewGuid().ToString('N')
  $result=Join-Path $local "$id.json"
  $log=Join-Path $local "$id.log"
  $err=Join-Path $local "$id.err"
  $progress=Join-Path $local "$id.progress.json"
  $cancel=Join-Path $local "$id.cancel"
  $worker=Join-Path $PSScriptRoot 'server-panel-worker.ps1'
  $powershell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  try {
    $arguments=@('-NoProfile','-File',$worker,'-Action',$Action,'-ResultFile',$result,'-ProgressFile',$progress,'-CancelFile',$cancel)
    if($BackupDirectory){$arguments+=@('-BackupDirectory',$BackupDirectory)}
    $quoted=($arguments | ForEach-Object{ConvertTo-ProcessArgument $_}) -join ' '
    $process=Start-Process -FilePath $powershell -ArgumentList $quoted -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
    $script:job=@{ Process=$process; Action=$Action; Result=$result; Log=$log; Error=$err; Progress=$progress; Cancel=$cancel; Started=[DateTime]::UtcNow; Cancelled=$false }
    if ($Action -ne 'Status') {
      $script:cancelButton.Enabled=$true
      foreach($button in $script:buttons) { $button.Enabled=$false }
      $script:message.Text=switch($Action) {
        'StartNormal' {'Iniciando sistema normal e preparando o endereço pelo Tailscale…'}
        'StartDemo' {'Atualizando a demonstração, restaurando exemplos e preparando o Tailscale…'}
        'StopNormal' {'Encerrando o sistema normal. Os dados serão preservados…'}
        'StopDemo' {'Encerrando a demonstração e descartando as alterações…'}
        'BackupNow' {'Gerando backup e verificando as cópias…'}
        'ConfigureBackup' {'Configurando a pasta e criando a segunda cópia…'}
        default {'Configurando HTTPS e autorizando o endereço no aplicativo. Aguarde…'}
      }
      if($Action -in @('StartNormal','StopNormal','ConnectNormal','StartDemo','StopDemo','ConnectDemo')) { if($Action -match 'Normal'){$script:normalStatus.Text='Operação em andamento — aguarde.'}else{$script:demoStatus.Text='Operação em andamento — aguarde.'} }
    }
  } catch { $script:message.Text=$_.Exception.Message }
}
function Action-Button([string]$Text,[int]$X,[string]$Action) {
  $button=New-Object Windows.Forms.Button
  $button.Text=$Text; $button.SetBounds($X,262,120,38)
  $button.Tag=$Action
  $button.Add_Click({ Run-Worker $this.Tag })
  $form.Controls.Add($button)
  $script:buttons += $button
}
$script:links=@{ Normal=''; Demo='' }
$script:linkButtons=@()
function Link-Button([string]$Text,[int]$X,[string]$Environment,[bool]$Copy) {
  $button=New-Object Windows.Forms.Button
  $button.Text=$Text; $button.SetBounds($X,385,182,36)
  $button.Tag=@{Environment=$Environment; Copy=$Copy}; $button.Enabled=$false
  $button.Add_Click({
    $url=$script:links[$this.Tag.Environment]
    if(!$url){return}
    try {
      if($this.Tag.Copy){[Windows.Forms.Clipboard]::SetText($url); $script:message.Text='Link copiado. Envie para um dispositivo conectado à sua rede Tailscale.'}
      else {Start-Process $url}
    } catch {$script:message.Text='Não foi possível abrir ou copiar o link. Tente novamente.'}
  })
  $form.Controls.Add($button); $script:linkButtons += $button
}
Action-Button 'Iniciar' 24 'StartNormal'
Action-Button 'Encerrar' 152 'StopNormal'
Action-Button 'Ativar link' 280 'ConnectNormal'
Action-Button 'Iniciar' 436 'StartDemo'
Action-Button 'Encerrar' 564 'StopDemo'
Action-Button 'Ativar link' 692 'ConnectDemo'
$script:normalAccess=Label 'Verificando acesso pelo Tailscale…' 24 312 380 42
$script:demoAccess=Label 'Verificando acesso pelo Tailscale…' 436 312 380 42
$script:normalUrl=Label '' 24 354 380 25
$script:demoUrl=Label '' 436 354 380 25
foreach($label in @($script:normalUrl,$script:demoUrl)){$label.AutoEllipsis=$true}
Link-Button 'Abrir site' 24 'Normal' $false
Link-Button 'Copiar link' 218 'Normal' $true
Link-Button 'Abrir site' 436 'Demo' $false
Link-Button 'Copiar link' 630 'Demo' $true
$script:dockerStatus=Label 'Docker: verificando…' 24 447 610 30
$dockerLink=New-Object Windows.Forms.LinkLabel
$dockerLink.Text='Abrir Docker Desktop'; $dockerLink.SetBounds(650,447,170,28)
if((Get-ErpDockerRuntime).Backend -eq 'wsl'){$dockerLink.Text='Iniciar Docker Debian'}
$dockerLink.Add_LinkClicked({
  if((Get-ErpDockerRuntime).Backend -eq 'wsl'){Run-Worker 'StartEngine'; return}
  $candidates=@((Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe'),(Join-Path $env:LOCALAPPDATA 'Programs/Docker/Docker/Docker Desktop.exe'))
  $exe=$candidates | Where-Object{Test-Path -LiteralPath $_} | Select-Object -First 1
  if($exe){Start-Process -FilePath $exe -WindowStyle Normal; $script:message.Text='Docker Desktop aberto. Aguarde o motor iniciar; o painel atualizará o estado.'}
  else{$script:message.Text='Docker Desktop não encontrado. Instale-o antes de iniciar os servidores.'}
})
$form.Controls.Add($dockerLink)
$script:tailscaleStatus=Label 'Tailscale: verificando…' 24 489 610 42
$tailscaleLink=New-Object Windows.Forms.LinkLabel
$tailscaleLink.Text='Abrir Tailscale'; $tailscaleLink.SetBounds(650,489,170,28)
$tailscaleLink.Add_LinkClicked({
  $exe=Join-Path $env:ProgramFiles 'Tailscale/tailscale-ipn.exe'
  if(Test-Path -LiteralPath $exe){Start-Process -FilePath $exe -WindowStyle Normal; $script:message.Text='Confira a conexão no ícone do Tailscale, perto do relógio do Windows.'}
  else{$script:message.Text='Tailscale não encontrado. Instale-o e conecte sua conta.'}
})
$form.Controls.Add($tailscaleLink)
$script:message=New-Object Windows.Forms.TextBox
$script:message.SetBounds(24,690,620,72); $script:message.Multiline=$true; $script:message.ReadOnly=$true
$script:message.ScrollBars='Vertical'; $script:message.Text='Pronto para verificar os ambientes.'
$form.Controls.Add($script:message)
$script:backupStatus=Label 'Backup: verificando…' 24 545 792 52
$folderButton=New-Object Windows.Forms.Button
$folderButton.Text='Escolher pasta de backup'; $folderButton.SetBounds(24,602,232,38)
$folderButton.Add_Click({
  if($script:job){$script:message.Text='Aguarde a operação atual antes de escolher a pasta.';return}
  $dialog=New-Object Windows.Forms.FolderBrowserDialog
  $dialog.Description='Escolha uma pasta para a segunda cópia. Pode ser uma pasta sincronizada pelo Drive.'
  try{if($dialog.ShowDialog() -eq 'OK'){Run-Worker 'ConfigureBackup' $dialog.SelectedPath}}finally{$dialog.Dispose()}
})
$form.Controls.Add($folderButton); $script:buttons+=$folderButton
$backupButton=New-Object Windows.Forms.Button
$backupButton.Text='Fazer backup agora'; $backupButton.SetBounds(268,602,210,38)
$backupButton.Add_Click({Run-Worker 'BackupNow'})
$form.Controls.Add($backupButton); $script:buttons+=$backupButton
$diagnosticButton=New-Object Windows.Forms.LinkLabel
$diagnosticButton.Text='Abrir diagnóstico';$diagnosticButton.SetBounds(654,650,162,28)
$diagnosticButton.Add_LinkClicked({Start-Process -FilePath 'explorer.exe' -ArgumentList (ConvertTo-ProcessArgument $local) -WindowStyle Normal})
$form.Controls.Add($diagnosticButton)
$script:stage=Label 'Aguardando operação.' 24 652 610 28
$script:cancelButton=New-Object Windows.Forms.Button
$script:cancelButton.Text='Cancelar espera';$script:cancelButton.SetBounds(656,690,160,36);$script:cancelButton.Enabled=$false
$script:cancelButton.Add_Click({
  if($script:job){[IO.File]::WriteAllText($script:job.Cancel,'cancel');$script:job.Cancelled=$true;$script:message.Text='Cancelando a espera. Os serviços serão consultados novamente; dados serão preservados.';$script:cancelButton.Enabled=$false}
})
$form.Controls.Add($script:cancelButton)
$null=Label 'Fechar o painel mantém os servidores ligados. O acesso remoto exige Tailscale no outro dispositivo.' 24 778 792 30
function Update-Status($result) {
        $script:backupStatus.Text="Backup: $($result.Backup)"
        $script:normalStatus.Text=$result.Normal; $script:demoStatus.Text=$result.Demo
        $script:dockerStatus.Text="Docker: $($result.Docker)"
        $script:tailscaleStatus.Text="Tailscale: $($result.Tailscale)"
        $script:normalAccess.Text=$result.NormalAccess; $script:demoAccess.Text=$result.DemoAccess
        $script:links.Normal=$result.NormalLink; $script:links.Demo=$result.DemoLink
        $script:normalUrl.Text=$result.NormalLink; $script:demoUrl.Text=$result.DemoLink
        foreach($button in $script:linkButtons){$button.Enabled=!!$script:links[$button.Tag.Environment]}
        foreach($label in @($script:normalStatus,$script:demoStatus)) {
          $label.ForeColor=if($label.Text -like 'Pronto*'){[Drawing.Color]::ForestGreen}else{[Drawing.Color]::DarkSlateGray}
        }
}
$timer=New-Object Windows.Forms.Timer
$timer.Interval=500
$timer.Add_Tick({
  if($script:job){
    if(Test-Path -LiteralPath $script:job.Progress){try{$script:stage.Text=(Get-Content -LiteralPath $script:job.Progress -Raw|ConvertFrom-Json).Stage}catch{}}
    $maximum=480; if($script:job.Action -eq "Status"){$maximum=90}
    if(([DateTime]::UtcNow-$script:job.Started).TotalSeconds -gt $maximum -and !$script:job.Cancelled){[IO.File]::WriteAllText($script:job.Cancel,"timeout");$script:job.Cancelled=$true;$script:message.Text="Prazo excedido. Cancelando a espera e verificando os serviços…"}
  }
  if ($script:job -and $script:job.Process.HasExited) {
    $job=$script:job; $script:job=$null
    try {
      if (!(Test-Path -LiteralPath $job.Result)) { throw 'Não foi possível concluir. Verifique o Docker e tente novamente.' }
      $result=Get-Content -LiteralPath $job.Result -Raw | ConvertFrom-Json
      if ($job.Action -eq 'Status') {
        Update-Status $result
      } else {
        $script:message.Text=$result.Message
        if(!$result.Ok){$script:message.ForeColor=[Drawing.Color]::Firebrick}else{$script:message.ForeColor=[Drawing.Color]::DarkSlateGray}
      }
    } catch { $script:message.Text=$_.Exception.Message }
    finally {
      $job.Process.Dispose()
      $script:cancelButton.Enabled=$false
      $script:stage.Text='Operação finalizada. Atualizando os estados…'
      if($job.Action -ne 'Status'){
        $history=Join-Path $local 'last-operation.json'
        if(Test-Path -LiteralPath $job.Result){Copy-Item -LiteralPath $job.Result -Destination $history -Force}
      }
      foreach($file in @($job.Result,$job.Log,$job.Error,$job.Progress,$job.Cancel)) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
      foreach($button in $script:buttons) { $button.Enabled=$true }
      $script:nextRefresh=if($job.Action -eq 'Status'){[DateTime]::Now.AddSeconds(10)}else{[DateTime]::MinValue}
    }
  }
  if (!$script:job -and $script:pendingAction) {
    $action=$script:pendingAction; $script:pendingAction=$null
    Run-Worker $action
  } elseif (!$script:job -and [DateTime]::Now -ge $script:nextRefresh) { Run-Worker 'Status' }
})
if ($SelfTest) {
  if ($script:buttons.Count -ne 8 -or $script:linkButtons.Count -ne 4) { throw 'Estrutura do painel inválida.' }
  if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'server-panel-worker.ps1'))) { throw 'Executor não encontrado.' }
  $statusFile=Join-Path $local 'selftest-status.json'
  & (Join-Path $PSScriptRoot 'server-panel-worker.ps1') -Action Status -ResultFile $statusFile
  $status=Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
  Update-Status $status
  Remove-Item -LiteralPath $statusFile
  Write-Output 'Painel criado; controles e atualização de estado validados.'
  $form.Show()
  [Windows.Forms.Application]::DoEvents()
  $preview=New-Object Drawing.Bitmap($form.Width,$form.Height)
  $form.DrawToBitmap($preview,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)))
  $preview.Save((Join-Path $local 'preview.png'))
  $preview.Dispose()
  $form.Dispose(); $timer.Dispose(); exit
}
$mutex=New-Object Threading.Mutex($false,'Local\ErpPousadaServerPanel')
$acquired=$false
try {
  try { $acquired=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired=$true }
  if (!$acquired) { [Windows.Forms.MessageBox]::Show('O painel já está aberto. Procure-o na barra de tarefas.','ERP Pousada') | Out-Null; exit }
  $timer.Start()
  [Windows.Forms.Application]::Run($form)
} finally {
  $timer.Stop(); $timer.Dispose(); $form.Dispose()
  if($acquired){$mutex.ReleaseMutex()}; $mutex.Dispose()
}
