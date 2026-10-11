param([switch]$SelfTest)
& (Join-Path $PSScriptRoot 'server-panel-ui.ps1') -SelfTest:$SelfTest
