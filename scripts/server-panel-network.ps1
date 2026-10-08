# Optional installation convenience; Tailscale remains external infrastructure.
function Invoke-Tailscale([string[]]$Arguments) {
  if (!(Get-Command tailscale -ErrorAction SilentlyContinue)) { throw 'Tailscale não instalado. Instale e conecte sua conta antes de ativar o link.' }
  return Invoke-PanelCommand (Get-Command tailscale -CommandType Application).Source $Arguments 30
}
function Get-TailscaleContext {
  $state = (Invoke-Tailscale @('status','--json') | Out-String) | ConvertFrom-Json
  if ($state.BackendState -ne 'Running') { throw 'Tailscale desconectado. Abra o Tailscale e conecte sua conta.' }
  $dns = $state.Self.DNSName.TrimEnd('.')
  if (!$dns) { throw 'Nome de rede indisponível. Ative o MagicDNS e o HTTPS no Tailscale.' }
  $config = (Invoke-Tailscale @('serve','status','--json') | Out-String) | ConvertFrom-Json
  return @{ DNS=$dns; Config=$config }
}
function Find-TailscaleLink($Context,[int]$BackendPort) {
  foreach ($web in $Context.Config.Web.PSObject.Properties) {
    $handler = $web.Value.Handlers.'/'
    if ($handler.Proxy -in @("http://127.0.0.1:$BackendPort","http://localhost:$BackendPort")) {
      $port = [int]($web.Name.Split(':')[-1])
      if ($Context.Config.TCP."$port".HTTPS) {
        $url = "https://$($Context.DNS)"
        if ($port -ne 443) { $url += ":$port" }
        if ($Context.Config.AllowFunnel.$($web.Name)) { throw 'Este endereço está público pelo Funnel. Desative o Funnel para usar o acesso privado do painel.' }
        return @{ URL=$url; Port=$port }
      }
    }
  }
  return $null
}
function Enable-TailscaleLink([int]$BackendPort) {
  $context = Get-TailscaleContext
  $link = Find-TailscaleLink $context $BackendPort
  if (!$link) {
    $port = @(443,8443,10000 | Where-Object { !$context.Config.TCP."$_" }) | Select-Object -First 1
    if (!$port) { throw 'As portas HTTPS disponíveis já estão ocupadas. Revise o Tailscale Serve sem apagar outros encaminhamentos.' }
    Invoke-Tailscale @('serve','--bg','--yes',"--https=$port","http://127.0.0.1:$BackendPort") | Out-Null
    $link = Find-TailscaleLink (Get-TailscaleContext) $BackendPort
  }
  if (!$link) { throw 'O Tailscale não confirmou o encaminhamento. Verifique HTTPS e permissões da sua rede.' }
  return $link.URL
}
function Read-PanelAddress([bool]$Demo) {
  $file=Join-Path (Split-Path $PSScriptRoot -Parent) '.env.docker.local'; $key='APP_URL='
  if ($Demo) { $file=Join-Path (Split-Path $PSScriptRoot -Parent) '.env.demo.local'; $key='DEMO_APP_URL=' }
  if (Test-Path -LiteralPath $file) {
    $line=Get-Content -LiteralPath $file | Where-Object { $_.StartsWith($key) } | Select-Object -First 1
    if ($line) { return $line.Substring($key.Length).Trim().Trim('"',"'") }
  }
  return ''
}
function Set-PanelAddress([bool]$Demo,[string]$Address) {
  $file=Join-Path (Split-Path $PSScriptRoot -Parent) '.env.docker.local'; $key='APP_URL='
  if ($Demo) { $file=Join-Path (Split-Path $PSScriptRoot -Parent) '.env.demo.local'; $key='DEMO_APP_URL=' }
  if (!(Test-Path -LiteralPath $file)) { throw 'Configuração da instalação não encontrada.' }
  $lines=[IO.File]::ReadAllLines($file)
  $found=$false
  $lines=@($lines | ForEach-Object { if ($_.StartsWith($key)) { $found=$true; "$key$Address" } else { $_ } })
  if (!$found) { $lines += "$key$Address" }
  [IO.File]::WriteAllLines($file,$lines,(New-Object Text.UTF8Encoding($false)))
}
function Connect-PanelApp([bool]$Demo) {
  $port=3000; $project='erp-pousada'; $service='app'; $envFile='.env.docker.local'
  if ($Demo) { $port=3001; $project='erp-pousada-demo'; $service='app-demo'; $envFile='.env.demo.local' }
  $app=Get-Containers $project | Where-Object { $_.Names -match "-$service-\d+$" } | Select-Object -First 1
  if (!$app -or $app.State -ne 'running') { throw 'Inicie este servidor antes de ativar seu link.' }
  $url=Enable-TailscaleLink $port
  Set-PanelStage 'Preparando HTTPS e autorizando o endereço no aplicativo…'
  $details=(Invoke-Docker @('inspect',$app.ID) | Out-String | ConvertFrom-Json)[0]
  if ($details.Config.Env -notcontains "APP_URL=$url") {
    $previous=Read-PanelAddress $Demo
    Set-PanelAddress $Demo $url
    # Preserve the exact installed image when applying only the new authorized origin.
    $override=Join-Path (Split-Path $PSScriptRoot -Parent) ".local/server-panel/url-$project.yml"
    [IO.Directory]::CreateDirectory((Split-Path $override)) | Out-Null
    [IO.File]::WriteAllText($override,"services:`n  ${service}:`n    image: $($details.Image)`n",(New-Object Text.UTF8Encoding($false)))
    try {
      $arguments=@('compose','--project-name',$project,'--env-file',$envFile)
      foreach ($file in $details.Config.Labels.'com.docker.compose.project.config_files'.Split(',')) {
        if ($file -ne $override) { $arguments += @('-f',$file) }
      }
      $arguments += @('-f',$override,'up','-d','--no-deps','--no-build',$service)
      Invoke-Docker $arguments | Out-Null
      $app=Get-Containers $project | Where-Object { $_.Names -match "-$service-\d+$" } | Select-Object -First 1
      Wait-Healthy $app.ID
    } catch {
      if ($previous) { Set-PanelAddress $Demo $previous }
      throw "Não foi possível aplicar o endereço ao aplicativo: $($_.Exception.Message)"
    }
  } else { Set-PanelAddress $Demo $url }
  $response=Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 15
  if ($response.StatusCode -ne 200) { throw 'Link configurado, mas o acesso HTTPS ainda não respondeu. Confira o Tailscale.' }
  return $url
}
