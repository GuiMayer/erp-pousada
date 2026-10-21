param([switch]$SelfTest)
$ErrorActionPreference='Stop'
$uiWatch=[Diagnostics.Stopwatch]::StartNew()
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'server-panel-process.ps1')
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
. (Join-Path $PSScriptRoot 'server-panel-monitor.ps1')
. (Join-Path $PSScriptRoot 'server-panel-controller.ps1')
[Windows.Forms.Application]::EnableVisualStyles()
$root=Split-Path $PSScriptRoot -Parent;$local=Join-Path $root '.local/server-panel'
[IO.Directory]::CreateDirectory($local) | Out-Null
$script:command=$null;$script:monitor=$null;$script:cards=@{};$script:mutationButtons=@()
$script:diagnostics=@{};$script:stacked=$false
$script:layoutContainers=New-Object Collections.Generic.List[object]
$ink=[Drawing.Color]::FromArgb(23,37,55);$muted=[Drawing.Color]::FromArgb(87,101,119)
$form=New-Object Windows.Forms.Form
$form.Text='ERP Pousada | Servidores';$form.ClientSize=New-Object Drawing.Size(1020,720)
$form.MinimumSize=New-Object Drawing.Size(680,520)
$form.StartPosition='CenterScreen';$form.AutoScaleMode='Dpi';$form.AutoScroll=$true
$form.Font=New-Object Drawing.Font('Segoe UI',10);$form.ForeColor=$ink
$form.BackColor=[Drawing.Color]::FromArgb(241,245,249)
$form.SuspendLayout()
function New-Text([string]$Text,[bool]$Strong=$false) {
  $label=New-Object Windows.Forms.Label
  $label.Text=$Text;$label.AutoSize=$true;$label.Dock='Top';$label.Margin=New-Object Windows.Forms.Padding(0,0,0,8)
  if($Strong){$label.Font=New-Object Drawing.Font('Segoe UI',12,[Drawing.FontStyle]::Bold)}else{$label.ForeColor=$muted}
  return $label
}
function New-Flow {
  $flow=New-Object Windows.Forms.FlowLayoutPanel
  $flow.AutoSize=$true;$flow.Dock='Top';$flow.WrapContents=$true;$flow.Margin=New-Object Windows.Forms.Padding(0,0,0,6)
  $flow.SuspendLayout();$script:layoutContainers.Add($flow)
  return $flow
}
function New-Button([string]$Text,[string]$Action='',[bool]$Primary=$false) {
  $button=New-Object Windows.Forms.Button
  $button.Text=$Text;$button.AutoSize=$true;$button.MinimumSize=New-Object Drawing.Size(110,36)
  $button.Padding=New-Object Windows.Forms.Padding(9,3,9,3);$button.Margin=New-Object Windows.Forms.Padding(0,0,8,6)
  $button.FlatStyle='Flat';$button.FlatAppearance.BorderColor=[Drawing.Color]::FromArgb(200,210,222);$button.BackColor=[Drawing.Color]::White
  if($Primary){$button.BackColor=[Drawing.Color]::FromArgb(31,87,160);$button.ForeColor=[Drawing.Color]::White}
  if($Action){$button.Tag=$Action;$button.Add_Click({Start-PanelAction $this.Tag});$script:mutationButtons+=$button}
  return $button
}
$layout=New-Object Windows.Forms.TableLayoutPanel
$layout.SuspendLayout();$script:layoutContainers.Add($layout)
$layout.ColumnCount=1;$layout.AutoSize=$true;$layout.Dock='Top';$layout.Padding=New-Object Windows.Forms.Padding(22)
$null=$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)));$form.Controls.Add($layout)
$layout.Controls.Add((New-Text 'Controle dos servidores' $true),0,0)
$layout.Controls.Add((New-Text 'Inicie, compartilhe e acompanhe cada ambiente. As consultas não bloqueiam suas ações.'),0,1)
$cardLayout=New-Object Windows.Forms.TableLayoutPanel
$cardLayout.SuspendLayout();$script:layoutContainers.Add($cardLayout)
$cardLayout.ColumnCount=2;$cardLayout.RowCount=1;$cardLayout.AutoSize=$true;$cardLayout.Dock='Top';$cardLayout.Margin=New-Object Windows.Forms.Padding(0,8,0,12)
$null=$cardLayout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',50)))
$null=$cardLayout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',50)));$layout.Controls.Add($cardLayout,0,2)
function Add-EnvironmentCard([string]$Environment,[int]$Column) {
  $panel=New-Object Windows.Forms.TableLayoutPanel
  $panel.SuspendLayout();$script:layoutContainers.Add($panel)
  $panel.ColumnCount=1;$panel.AutoSize=$true;$panel.Dock='Top';$panel.BackColor=[Drawing.Color]::White
  $panel.Padding=New-Object Windows.Forms.Padding(18);$panel.Margin=New-Object Windows.Forms.Padding(0,0,12,0)
  $null=$panel.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)))
  $title='Sistema normal';$description='Dados permanentes. Encerrar preserva banco e backups.'
  if($Environment -eq 'Demo'){$title='Demonstração';$description='Dados fictícios. Encerrar descarta as alterações da sessão.'}
  $panel.Controls.Add((New-Text $title $true),0,0);$panel.Controls.Add((New-Text $description),0,1)
  $status=New-Text 'Verificando servidor…' $true;$panel.Controls.Add($status,0,2)
  $age=New-Text 'Ainda sem verificação';$age.Font=New-Object Drawing.Font('Segoe UI',9);$panel.Controls.Add($age,0,3)
  $actions=New-Flow;$primary=New-Button 'Iniciar' "Start$Environment" $true;$actions.Controls.Add($primary)
  $remote=New-Button 'Preparar link' "Connect$Environment";$actions.Controls.Add($remote)
  $cancel=New-Button 'Cancelar espera';$cancel.Visible=$false;$cancel.Add_Click({Request-PanelCancel});$actions.Controls.Add($cancel)
  $panel.Controls.Add($actions,0,4)
  $access=New-Text 'Acesso privado: verificando Tailscale…';$panel.Controls.Add($access,0,5)
  $url=New-Object Windows.Forms.TextBox
  $url.ReadOnly=$true;$url.Dock='Top';$url.Margin=New-Object Windows.Forms.Padding(0,0,0,10)
  $url.AccessibleName="Endereço privado de $title";$url.Text='Link ainda não configurado';$panel.Controls.Add($url,0,6)
  $links=New-Flow;$open=New-Button 'Abrir site';$copy=New-Button 'Copiar link'
  $open.Tag=@{Environment=$Environment;Copy=$false};$copy.Tag=@{Environment=$Environment;Copy=$true}
  foreach($button in @($open,$copy)) {
    $button.Enabled=$false
    $button.Add_Click({
      $address=$script:cards[$this.Tag.Environment].UrlValue
      if(!$address){return}
      try {
        if($this.Tag.Copy){[Windows.Forms.Clipboard]::SetText($address);$script:notice.Text='Link copiado. O outro dispositivo precisa de acesso à sua rede Tailscale.'}
        else {Start-Process $address}
      } catch {$script:notice.Text='Não foi possível abrir ou copiar o link. Tente novamente.'}
    })
    $links.Controls.Add($button)
  }
  $panel.Controls.Add($links,0,7)
  if($Environment -eq 'Demo') {
    $more=New-Button 'Mais opções';$menu=New-Object Windows.Forms.ContextMenuStrip
    foreach($entry in @(@('Restaurar exemplos','ResetDemo'),@('Atualizar versão','UpdateDemo'))) {
      $item=$menu.Items.Add($entry[0]);$item.Tag=$entry[1]
      $item.Add_Click({
        $question='Restaurar os exemplos? As alterações desta demonstração serão descartadas.'
        if($this.Tag -eq 'UpdateDemo'){$question='Construir a versão com o código local e iniciar uma nova demonstração? Pode levar minutos. As alterações fictícias serão descartadas após a construção.'}
        if([Windows.Forms.MessageBox]::Show($form,$question,'Demonstração','YesNo','Question') -eq 'Yes'){Start-PanelAction $this.Tag}
      })
    }
    $more.ContextMenuStrip=$menu;$more.Add_Click({$this.ContextMenuStrip.Show($this,0,$this.Height)})
    $links.Controls.Add($more);$script:mutationButtons+=$more
  }
  $progress=New-Object Windows.Forms.ProgressBar
  $progress.Style='Marquee';$progress.MarqueeAnimationSpeed=28;$progress.Dock='Top';$progress.Height=5;$progress.Visible=$false
  $panel.Controls.Add($progress,0,8);$stage=New-Text 'Nenhuma operação em andamento.';$panel.Controls.Add($stage,0,9)
  $panel.Add_SizeChanged({
    $width=[math]::Max(250,$this.ClientSize.Width-$this.Padding.Horizontal)
    foreach($control in $this.Controls){if($control -is [Windows.Forms.Label]){$control.MaximumSize=New-Object Drawing.Size($width,0)}}
  })
  $script:cards[$Environment]=@{Panel=$panel;Status=$status;Age=$age;Primary=$primary;Remote=$remote;Cancel=$cancel;Access=$access;Url=$url;UrlValue='';Open=$open;Copy=$copy;Progress=$progress;Stage=$stage;State='unknown';Text='Verificando servidor…';Observed=$null}
  $cardLayout.Controls.Add($panel,$Column,0)
}
Add-EnvironmentCard 'Normal' 0;Add-EnvironmentCard 'Demo' 1
$form.Add_Resize({
  $stack=$form.ClientSize.Width -lt (900*$form.DeviceDpi/96.0)
  if($stack -eq $script:stacked){return}
  $script:stacked=$stack;$cardLayout.SuspendLayout()
  if($stack){
    $cardLayout.ColumnCount=1;$cardLayout.RowCount=2
    $cardLayout.SetCellPosition($script:cards.Demo.Panel,(New-Object Windows.Forms.TableLayoutPanelCellPosition(0,1)))
    $cardLayout.ColumnStyles[0].Width=100
    $script:cards.Normal.Panel.Margin=New-Object Windows.Forms.Padding(0,0,0,12)
  } else {
    $cardLayout.ColumnCount=2;$cardLayout.RowCount=1
    $cardLayout.SetCellPosition($script:cards.Demo.Panel,(New-Object Windows.Forms.TableLayoutPanelCellPosition(1,0)))
    $cardLayout.ColumnStyles[0].Width=50
    $script:cards.Normal.Panel.Margin=New-Object Windows.Forms.Padding(0,0,12,0)
  }
  $script:cards.Demo.Panel.Margin=New-Object Windows.Forms.Padding(0);$cardLayout.ResumeLayout($true)
})
$infrastructure=New-Object Windows.Forms.TableLayoutPanel
$infrastructure.SuspendLayout();$script:layoutContainers.Add($infrastructure)
$infrastructure.ColumnCount=1;$infrastructure.AutoSize=$true;$infrastructure.Dock='Top'
$infrastructure.Padding=New-Object Windows.Forms.Padding(14);$infrastructure.BackColor=[Drawing.Color]::White
$null=$infrastructure.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)))
$infrastructure.Controls.Add((New-Text 'Infraestrutura e backups' $true),0,0)
$script:dockerStatus=New-Text 'Docker: verificando…';$infrastructure.Controls.Add($script:dockerStatus,0,1)
$script:networkStatus=New-Text 'Tailscale: verificando…';$infrastructure.Controls.Add($script:networkStatus,0,2)
$script:backupStatus=New-Text 'Backup: verificando…';$infrastructure.Controls.Add($script:backupStatus,0,3)
$tools=New-Flow;$runtime=Get-ErpDockerRuntime;$docker=New-Button 'Abrir Docker'
if($runtime.Backend -eq 'wsl'){$docker.Text="Iniciar Docker ($($runtime.Distribution))"}
$docker.Add_Click({
  if((Get-ErpDockerRuntime).Backend -eq 'wsl'){Start-PanelAction 'StartEngine';return}
  $paths=@((Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe'),(Join-Path $env:LOCALAPPDATA 'Programs/Docker/Docker/Docker Desktop.exe'))
  $exe=$paths | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
  if($exe){Start-Process -FilePath $exe -WindowStyle Normal;$script:notice.Text='Docker Desktop aberto. Aguarde a inicialização do motor.'}
  else {$script:notice.Text='Docker Desktop não encontrado neste computador.'}
})
if($runtime.Backend -eq 'wsl'){$script:mutationButtons+=$docker};$tools.Controls.Add($docker)
$tailscale=New-Button 'Abrir Tailscale'
$tailscale.Add_Click({
  $exe=Join-Path $env:ProgramFiles 'Tailscale/tailscale-ipn.exe'
  if(Test-Path -LiteralPath $exe){Start-Process -FilePath $exe -WindowStyle Normal;$script:notice.Text='Confira a conexão no ícone do Tailscale, perto do relógio.'}
  else {$script:notice.Text='Tailscale não encontrado neste computador.'}
});$tools.Controls.Add($tailscale)
$folder=New-Button 'Pasta de backup'
$folder.Add_Click({
  $dialog=New-Object Windows.Forms.FolderBrowserDialog;$dialog.Description='Escolha uma segunda pasta, inclusive uma pasta local sincronizada pelo Drive.'
  try {if($dialog.ShowDialog($form) -eq 'OK'){Start-PanelAction 'ConfigureBackup' $dialog.SelectedPath}}finally{$dialog.Dispose()}
});$script:mutationButtons+=$folder;$tools.Controls.Add($folder)
$backup=New-Button 'Fazer backup' 'BackupNow';$tools.Controls.Add($backup)
$tips=New-Object Windows.Forms.ToolTip
$tips.SetToolTip($backup,'Inicie o sistema normal antes de fazer backup.')
$tips.SetToolTip($folder,'Inicie o sistema normal antes de configurar a segunda cópia.')
$refresh=New-Button 'Verificar agora';$refresh.Add_Click({Reset-PanelMonitor $script:monitor;$script:notice.Text='Consultando os componentes em segundo plano…'});$tools.Controls.Add($refresh)
$infrastructure.Controls.Add($tools,0,4);$layout.Controls.Add($infrastructure,0,3)
$script:notice=New-Text 'Consultar o estado não liga o WSL. Use Iniciar quando precisar.'
$script:notice.Padding=New-Object Windows.Forms.Padding(0,12,0,0);$layout.Controls.Add($script:notice,0,4)
$operationTools=New-Flow;$script:cancel=New-Button 'Cancelar espera';$script:cancel.Enabled=$false
$script:cancel.Add_Click({Request-PanelCancel});$operationTools.Controls.Add($script:cancel)
$details=New-Object Windows.Forms.CheckBox;$details.Text='Mostrar diagnóstico';$details.AutoSize=$true;$details.Margin=New-Object Windows.Forms.Padding(8,8,10,0);$operationTools.Controls.Add($details)
$diagnostic=New-Button 'Abrir histórico';$diagnostic.Add_Click({Start-Process -FilePath 'explorer.exe' -ArgumentList (ConvertTo-ProcessArgument $local) -WindowStyle Normal});$operationTools.Controls.Add($diagnostic)
$layout.Controls.Add($operationTools,0,5)
$script:diagnosticText=New-Object Windows.Forms.TextBox
$script:diagnosticText.Multiline=$true;$script:diagnosticText.ReadOnly=$true;$script:diagnosticText.ScrollBars='Vertical'
$script:diagnosticText.Dock='Top';$script:diagnosticText.Height=135;$script:diagnosticText.Visible=$false
$details.Add_CheckedChanged({$script:diagnosticText.Visible=$this.Checked});$layout.Controls.Add($script:diagnosticText,0,6)
$layout.Controls.Add((New-Text 'Fechar este painel mantém os servidores ligados. O link privado exige Tailscale autorizado no outro dispositivo.'),0,7)
foreach($container in @($layout,$infrastructure)) {
  $container.Add_SizeChanged({
    $width=[math]::Max(250,$this.ClientSize.Width-$this.Padding.Horizontal)
    foreach($control in $this.Controls){if($control -is [Windows.Forms.Label]){$control.MaximumSize=New-Object Drawing.Size($width,0)}}
  })
}
for($index=$script:layoutContainers.Count-1;$index -ge 0;$index--){$script:layoutContainers[$index].ResumeLayout($false)}
$layout.PerformLayout();$form.ResumeLayout($true)
$uiWatch.Stop();$script:diagnostics.Interface="Interface | construção: $($uiWatch.ElapsedMilliseconds) ms"
Update-ActionAvailability
$timer=New-Object Windows.Forms.Timer;$timer.Interval=200
$timer.Add_Tick({try{Update-Panel}catch{$script:notice.Text='Falha ao atualizar o painel. Os servidores não foram desligados.'}})
$form.Add_FormClosing({
  param($sender,$eventArgs)
  if($script:command -and [Windows.Forms.MessageBox]::Show($form,'Há uma operação em andamento. Ao fechar, ela continuará em segundo plano; o resultado ficará no histórico. Fechar o painel?','ERP Pousada','YesNo','Question') -ne 'Yes'){$eventArgs.Cancel=$true}
})
if($SelfTest) {
  # Exercise and render our own form using fake data, without any external service.
  Set-CardState 'Normal' ([pscustomobject]@{State='ready';Text='Pronto localmente — aplicativo e banco respondendo.'}) ([DateTime]::UtcNow.ToString('o'))
  Set-CardState 'Demo' ([pscustomobject]@{State='stopped';Text='Desligado — exemplos restaurados ao iniciar.'}) ([DateTime]::UtcNow.ToString('o'))
  Set-CardAccess 'Normal' ([pscustomobject]@{Url='https://pousada.exemplo.ts.net';Access='Acesso privado pronto'})
  if($script:cards.Normal.Primary.Tag -ne 'StopNormal' -or $script:cards.Demo.Primary.Tag -ne 'StartDemo'){throw 'Ações não correspondem ao estado'}
  if(!$script:cards.Normal.Copy.Enabled){throw 'Link conhecido indisponível'}
  $testDirectory=Join-Path ([IO.Path]::GetTempPath()) ('erp-panel-ui-'+[Guid]::NewGuid().ToString('N'))
  [IO.Directory]::CreateDirectory($testDirectory) | Out-Null
  $fixture=Join-Path $testDirectory 'probe.ps1'
  [IO.File]::WriteAllText($fixture,'function Invoke-PanelProbe($Component,$Url){Start-Sleep -Milliseconds 600; @{Component=$Component;Ok=$true;Data=@{};Observed=[DateTime]::UtcNow.ToString("o")} | ConvertTo-Json -Compress}')
  $script:monitor=New-PanelMonitor $fixture
  $null=Start-PanelProbe $script:monitor 'Docker'
  $originalLocal=$local;$local=$testDirectory;$script:testLaunchCount=0;$script:testArguments=''
  function Start-Process {
    param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru)
    $script:testLaunchCount++;$script:testArguments=$ArgumentList
    $process=[pscustomobject]@{HasExited=$false}
    $process | Add-Member ScriptMethod Dispose {}
    return $process
  }
  try {
    $watch=[Diagnostics.Stopwatch]::StartNew()
    Start-PanelAction 'ConfigureBackup' 'C:\Pasta de testes com espaços'
    $watch.Stop()
    if($watch.ElapsedMilliseconds -gt 1000 -or !$script:command){throw 'Comando ficou bloqueado pela consulta lenta'}
    if(!$script:cards.Normal.Copy.Enabled -or !$script:cards.Normal.Open.Enabled){throw 'Links bloqueados durante operação'}
    if($script:testArguments -notmatch 'Pasta de testes com espaços'){throw 'Argumentos da operação foram perdidos'}
    Start-PanelAction 'StartDemo'
    if($script:testLaunchCount -ne 1){throw 'Mutações concorrentes permitidas'}
    $old=[DateTime]::UtcNow.AddMinutes(-1).ToString('o')
    Set-CardState 'Normal' ([pscustomobject]@{State='stopped';Text='Resultado antigo'}) $old
    if($script:cards.Normal.State -ne 'ready'){throw 'Resultado antigo regrediu o estado'}
    Apply-Probe ([pscustomobject]@{Component='Backup';Ok=$false;Message='Backup indisponível';DurationMs=1;Commands=@()})
    if($script:cards.Normal.State -ne 'ready'){throw 'Falha de backup alterou a disponibilidade local'}
    Write-PanelJson $script:command.Result @{Ok=$true;Message='Operação simulada concluída.';State=@{Normal=@{State='ready';Text='Pronto localmente — aplicativo e banco respondendo.'}};Observed=[DateTime]::UtcNow.ToString('o');DurationMs=10;Commands=@()}
    $script:command.Process.HasExited=$true
    Update-Panel
    if($script:command -or !$script:cards.Normal.Primary.Enabled){throw 'Conclusão não liberou a interface'}
    if($script:cards.Normal.Primary.Tag -ne 'StopNormal'){throw 'Conclusão não atualizou estado imediatamente'}
    Start-PanelAction 'StartDemo'
    if(!$script:cards.Demo.Cancel.Enabled -or !$script:cards.Normal.Copy.Enabled){throw 'Cancelamento no cartão ou links não disponíveis durante início'}
    Request-PanelCancel
    if(!$script:command.Cancelled -or ![IO.File]::Exists($script:command.Cancel) -or $script:cards.Demo.Cancel.Enabled){throw 'Cancelamento não foi enviado cooperativamente'}
    Write-PanelJson $script:command.Result @{Ok=$false;Message='Espera simulada cancelada.';State=@{Demo=@{State='stopped';Text='Desligado — exemplos restaurados ao iniciar.'}};Observed=[DateTime]::UtcNow.ToString('o');DurationMs=10;Commands=@()}
    $script:command.Process.HasExited=$true;Update-Panel
    if($script:command -or !$script:cards.Demo.Primary.Enabled){throw 'Cancelamento não reconciliou a interface'}
    Write-Output "Aceitação do comando com consulta lenta: $($watch.ElapsedMilliseconds) ms (executor simulado)."
  } finally {
    Remove-Item Function:Start-Process
    Stop-PanelMonitor $script:monitor;$script:monitor=$null;$local=$originalLocal
    if($testDirectory.StartsWith([IO.Path]::GetTempPath(),[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $testDirectory -Recurse -Force}
  }
  $script:notice.Text='Consultar o estado não liga o WSL. Use Iniciar quando precisar.'
  $script:notice.ForeColor=$muted;$script:cards.Demo.Stage.Text='Nenhuma operação em andamento.'
  $script:cards.Normal.Age.Text='Última verificação há 0 s'
  $script:dockerStatus.Text='Docker: em execução (exemplo)';$script:networkStatus.Text='Tailscale: conectado (exemplo)';$script:backupStatus.Text='Backup: última cópia confirmada (exemplo)'
  $form.ShowInTaskbar=$false;$form.Opacity=0
  $form.Show();$form.PerformLayout()
  $bitmap=New-Object Drawing.Bitmap($form.Width,$form.Height)
  $form.DrawToBitmap($bitmap,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)))
  $bitmap.Save((Join-Path $local 'preview.png'));$bitmap.Dispose()
  $form.ClientSize=New-Object Drawing.Size(700,560);$form.PerformLayout()
  if(!$script:stacked -or $cardLayout.GetRow($script:cards.Demo.Panel) -ne 1){throw 'Layout compacto não empilha os cartões'}
  $bitmap=New-Object Drawing.Bitmap($form.Width,$form.Height)
  $form.DrawToBitmap($bitmap,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height)))
  $bitmap.Save((Join-Path $local 'preview-compact.png'));$bitmap.Dispose()
  $form.ClientSize=New-Object Drawing.Size(1020,720);$form.PerformLayout()
  if($script:stacked -or $cardLayout.GetColumn($script:cards.Demo.Panel) -ne 1){throw 'Layout amplo não restaura as colunas'}
  $form.Dispose();$timer.Dispose();Write-Output 'Layout, ações por estado e links validados sem iniciar Docker ou WSL.';exit
}
$mutex=New-Object Threading.Mutex($false,'Local\ErpPousadaServerPanel');$acquired=$false
try {
  try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
  if(!$acquired){[Windows.Forms.MessageBox]::Show('O painel já está aberto. Procure-o na barra de tarefas.','ERP Pousada') | Out-Null;exit}
  $script:monitor=New-PanelMonitor;$timer.Start();[Windows.Forms.Application]::Run($form)
} finally {
  $timer.Stop();$timer.Dispose();if($script:monitor){Stop-PanelMonitor $script:monitor}
  if($script:command){$script:command.Process.Dispose()}
  $form.Dispose();if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()
}
