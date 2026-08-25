[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root '.env.evolution'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Run setup.ps1 first.' }

function Find-Executable([string]$Name, [string[]]$Candidates) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }

  throw "$Name is not installed or could not be found."
}

$docker = Find-Executable 'docker' @(
  (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe')
)
$ngrokPackage = Get-ChildItem (
  Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Ngrok.Ngrok_*'
) -Filter ngrok.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
$ngrok = Find-Executable 'ngrok' @($ngrokPackage.FullName)

$values = @{}
foreach ($line in [IO.File]::ReadAllLines($envPath)) {
  if ($line -match '^([^#=]+)=(.*)$') { $values[$matches[1]] = $matches[2] }
}
if (-not $values.NGROK_DOMAIN) {
  throw 'Add the free assigned ngrok domain to NGROK_DOMAIN in .env.evolution.'
}

$publicUrl = $values.NGROK_DOMAIN.Trim().TrimEnd('/')
if ($publicUrl -notmatch '^https://') { $publicUrl = "https://$publicUrl" }
$domain = ([Uri]$publicUrl).Host

$updatedLines = [IO.File]::ReadAllLines($envPath) | ForEach-Object {
  if ($_ -match '^EVOLUTION_PUBLIC_URL=') { "EVOLUTION_PUBLIC_URL=$publicUrl" } else { $_ }
}
[IO.File]::WriteAllLines($envPath, $updatedLines, [Text.UTF8Encoding]::new($false))

& $docker compose --env-file $envPath --file (Join-Path $root 'docker-compose.yml') up -d evolution
if ($LASTEXITCODE -ne 0) { throw 'Evolution failed to restart with the public URL.' }

Write-Host "Evolution public URL configured as $publicUrl"
& $ngrok http --url $domain 8080
