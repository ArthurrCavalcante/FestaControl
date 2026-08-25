[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root '.env.evolution'

function New-HexSecret([int]$Bytes = 32) {
  $buffer = [byte[]]::new($Bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToHexString($buffer).ToLowerInvariant()
}

if (-not (Test-Path -LiteralPath $envPath)) {
  $lines = @(
    'EVOLUTION_PUBLIC_URL=http://localhost:8080'
    "EVOLUTION_API_KEY=$(New-HexSecret)"
    "EVOLUTION_WEBHOOK_SECRET=$(New-HexSecret)"
    "EVOLUTION_DB_PASSWORD=$(New-HexSecret 24)"
    'NGROK_DOMAIN='
  )
  [IO.File]::WriteAllLines($envPath, $lines, [Text.UTF8Encoding]::new($false))
  Write-Host "Created local secrets at $envPath"
}

function Find-Docker {
  $command = Get-Command docker -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
  if (Test-Path -LiteralPath $candidate) { return $candidate }

  throw 'Docker Desktop is not installed or this terminal needs to be restarted.'
}

$docker = Find-Docker
& $docker compose --env-file $envPath --file (Join-Path $root 'docker-compose.yml') up -d
if ($LASTEXITCODE -ne 0) { throw 'Evolution containers failed to start.' }

$deadline = (Get-Date).AddMinutes(4)
do {
  Start-Sleep -Seconds 3
  try {
    $response = Invoke-WebRequest 'http://127.0.0.1:8080' -TimeoutSec 5 -SkipHttpErrorCheck
    if ($response.StatusCode -lt 500) {
      Write-Host 'Evolution API is responding at http://127.0.0.1:8080'
      exit 0
    }
  } catch {}
} while ((Get-Date) -lt $deadline)

& $docker compose --env-file $envPath --file (Join-Path $root 'docker-compose.yml') logs --tail 80 evolution
throw 'Evolution API did not become ready in four minutes.'
