$ErrorActionPreference='Stop'
$desktop=[Environment]::GetFolderPath('Desktop')
$shortcutPath=Join-Path $desktop 'ERP Pousada - Servidores.lnk'
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$panel=Join-Path $PSScriptRoot 'server-panel.ps1'
$shortcut.Arguments="-NoProfile -STA -WindowStyle Hidden -File `"$panel`""
$shortcut.WorkingDirectory=Split-Path $PSScriptRoot -Parent
$shortcut.Description='Iniciar e encerrar o sistema normal e a demonstração do ERP Pousada.'
$shortcut.IconLocation="$env:SystemRoot\System32\shell32.dll,21"
$shortcut.Save()
Write-Output "Painel instalado: $shortcutPath"
