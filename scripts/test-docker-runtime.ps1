param([switch]$Integration)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'docker-runtime.ps1')
if((ConvertTo-ErpLinuxPath 'C:\Example folder\app') -ne '/mnt/c/Example folder/app'){throw 'Windows path conversion failed'}
if((ConvertTo-ErpLinuxPath '/already/linux') -ne '/already/linux'){throw 'Linux path changed'}
function Invoke-Docker([string[]]$Arguments){$script:CapturedDockerArguments=$Arguments}
foreach($name in @('start-demo.ps1','stop-demo.ps1')) {
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name),[ref]$tokens,[ref]$errors)
  $definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-DemoDocker'},$true)
  . ([scriptblock]::Create($definition.Extent.Text))
  Invoke-DemoDocker compose up -d --volumes
  if($script:CapturedDockerArguments -notcontains '-d' -or $script:CapturedDockerArguments -notcontains '--volumes'){throw 'Docker flags consumed by PowerShell'}
}
Remove-Item Function:Invoke-Docker
if($Integration) {
  if((Get-ErpDockerRuntime).Backend -ne 'wsl'){throw 'This test requires the WSL runtime'}
  $arguments=@('exec','erp-pousada-app-1','node','-e','console.log(JSON.stringify(process.argv.slice(1)))','two words','a"b','C:\folder\file')
  $call=Get-ErpDockerInvocation $arguments
  $decoded=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($call.Arguments[-1])).TrimEnd([char]0).Split([char]0)
  if($decoded[1..($decoded.Length-1)] -join [char]0 -cne ($arguments -join [char]0)){throw 'Encoded arguments changed'}
  $output=(Invoke-ErpDocker $arguments | Out-String).Trim() | ConvertFrom-Json
  if($output[0] -cne 'two words' -or $output[1] -cne 'a"b' -or $output[2] -cne 'C:\folder\file'){throw 'WSL arguments changed in execution'}
}
Write-Output 'Docker runtime paths and arguments validated.'
