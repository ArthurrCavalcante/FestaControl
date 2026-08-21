[CmdletBinding()]
param(
  [ValidateSet('Backup', 'Restore')]
  [string]$Mode,
  [string]$BackupDirectory = 'C:\Users\Daniele\Documents\FestaFlow-Backups',
  [string]$BackupSet,
  [string]$ProjectRef = 'ksbivaolyusmrcblnnfe',
  [string]$LocalDatabase = 'festaflow_restore',
  [int]$LocalPort = 5433
)

$ErrorActionPreference = 'Stop'
$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin'
$OpenSsl = 'C:\Program Files\Git\usr\bin\openssl.exe'
$SupabaseUrl = "https://$ProjectRef.supabase.co"
$DbHost = if ($env:SUPABASE_DB_HOST) { $env:SUPABASE_DB_HOST } else { "db.$ProjectRef.supabase.co" }
$DbUser = if ($env:SUPABASE_DB_USER) { $env:SUPABASE_DB_USER } else { 'postgres' }

function Assert-Environment([string[]]$Names) {
  foreach ($name in $Names) {
    if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value) {
      throw "Required environment variable is missing: $name"
    }
  }
  foreach ($path in @("$PostgresBin\pg_dump.exe", "$PostgresBin\psql.exe", $OpenSsl)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required executable not found: $path" }
  }
}

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $Executable" }
}

function Get-CoreCounts([string]$HostName, [int]$Port, [string]$User, [string]$Database, [string]$Password) {
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $query = @"
select json_build_object(
  'companies', (select count(*) from public.companies),
  'profiles', (select count(*) from public.profiles),
  'leads', (select count(*) from public.leads),
  'deals', (select count(*) from public.deals),
  'events', (select count(*) from public.events),
  'conversations', (select count(*) from public.conversations),
  'messages', (select count(*) from public.messages),
  'storage_objects', (select count(*) from storage.objects)
)::text;
"@
    $value = & "$PostgresBin\psql.exe" -X -A -t -h $HostName -p $Port -U $User -d $Database -c $query
    if ($LASTEXITCODE -ne 0) { throw 'Could not read database counts.' }
    return ($value | Where-Object { $_ } | Select-Object -Last 1 | ConvertFrom-Json)
  } finally {
    $env:PGPASSWORD = $oldPassword
  }
}

function Get-SchemaFingerprint([string]$HostName, [int]$Port, [string]$User, [string]$Database, [string]$Password) {
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    $query = "select coalesce(string_agg(table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, E'\n' order by table_schema, table_name, ordinal_position), '') from information_schema.columns where table_schema in ('public','auth','storage');"
    $value = & "$PostgresBin\psql.exe" -X -A -t -h $HostName -p $Port -U $User -d $Database -c $query
    if ($LASTEXITCODE -ne 0) { throw 'Could not fingerprint the database schema.' }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($value -join "`n"))
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
      return ([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
      $hasher.Dispose()
    }
  } finally {
    $env:PGPASSWORD = $oldPassword
  }
}

function Get-StorageObjects([string]$Bucket, [string]$Prefix = '') {
  $headers = @{ Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"; apikey = $env:SUPABASE_SERVICE_ROLE_KEY }
  $result = [System.Collections.Generic.List[string]]::new()
  $offset = 0
  do {
    $body = @{ prefix = $Prefix; limit = 1000; offset = $offset; sortBy = @{ column = 'name'; order = 'asc' } } | ConvertTo-Json -Depth 4
    $response = Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/storage/v1/object/list/$Bucket" -Headers $headers -ContentType 'application/json' -Body $body
    $items = @($response | ForEach-Object { $_ })
    foreach ($item in $items) {
      $path = if ($Prefix) { "$Prefix/$($item.name)" } else { $item.name }
      if ($item.id) {
        $result.Add($path)
      } else {
        foreach ($child in Get-StorageObjects -Bucket $Bucket -Prefix $path) { $result.Add($child) }
      }
    }
    $offset += $items.Count
  } while ($items.Count -eq 1000)
  return $result
}

function Export-Storage([string]$Destination) {
  $headers = @{ Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"; apikey = $env:SUPABASE_SERVICE_ROLE_KEY }
  $hashes = @{}
  foreach ($bucket in @('Catalogo', 'crm')) {
    foreach ($objectPath in Get-StorageObjects -Bucket $bucket) {
      $target = Join-Path $Destination (Join-Path $bucket $objectPath)
      $parent = Split-Path -Parent $target
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
      $encodedPath = (($objectPath -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
      try {
        Invoke-WebRequest -Uri "$SupabaseUrl/storage/v1/object/$bucket/$encodedPath" -Headers $headers -OutFile $target
      } catch {
        throw "Could not export Storage object ${bucket}/${objectPath}: $($_.Exception.Message)"
      }
      $hashes["$bucket/$objectPath"] = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
    }
  }
  return $hashes
}

function Protect-File([string]$Source, [string]$Destination) {
  Invoke-Checked $OpenSsl @('enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '600000', '-in', $Source, '-out', $Destination, '-pass', 'env:FESTAFLOW_BACKUP_PASSPHRASE')
}

function Unprotect-File([string]$Source, [string]$Destination) {
  Invoke-Checked $OpenSsl @('enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-in', $Source, '-out', $Destination, '-pass', 'env:FESTAFLOW_BACKUP_PASSPHRASE')
}

function New-Backup {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  Assert-Environment @('SUPABASE_DB_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY', 'FESTAFLOW_BACKUP_PASSPHRASE')
  New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
  $setDirectory = Join-Path $BackupDirectory (Get-Date -Format 'yyyyMMdd-HHmmss')
  $tempDirectory = Join-Path $env:TEMP "FestaFlowBackup-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $setDirectory, $tempDirectory -Force | Out-Null
  try {
    $dump = Join-Path $tempDirectory 'database.dump'
    $storage = Join-Path $tempDirectory 'storage'
    $storageZip = Join-Path $tempDirectory 'storage.zip'
    New-Item -ItemType Directory -Path $storage -Force | Out-Null

    $env:PGPASSWORD = $env:SUPABASE_DB_PASSWORD
    Invoke-Checked "$PostgresBin\pg_dump.exe" @('-Fc', '--no-owner', '--no-privileges', '-h', $DbHost, '-p', '5432', '-U', $DbUser, '-d', 'postgres', '-f', $dump)
    $sourceCounts = Get-CoreCounts $DbHost 5432 $DbUser 'postgres' $env:SUPABASE_DB_PASSWORD
    $schemaFingerprint = Get-SchemaFingerprint $DbHost 5432 $DbUser 'postgres' $env:SUPABASE_DB_PASSWORD
    $storageHashes = Export-Storage $storage
    Compress-Archive -Path (Join-Path $storage '*') -DestinationPath $storageZip -CompressionLevel Optimal -Force

    $encryptedDump = Join-Path $setDirectory 'database.dump.enc'
    $encryptedStorage = Join-Path $setDirectory 'storage.zip.enc'
    Protect-File $dump $encryptedDump
    Protect-File $storageZip $encryptedStorage
    $manifest = [ordered]@{
      created_at = (Get-Date).ToUniversalTime().ToString('o')
      project_ref = $ProjectRef
      database_counts = $sourceCounts
      schema_fingerprint = $schemaFingerprint
      storage_hashes = $storageHashes
      encrypted_sha256 = @{
        database = (Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedDump).Hash.ToLowerInvariant()
        storage = (Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedStorage).Hash.ToLowerInvariant()
      }
      duration_seconds = [Math]::Round($timer.Elapsed.TotalSeconds, 2)
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $setDirectory 'manifest.json') -Encoding utf8
    return $setDirectory
  } finally {
    $env:PGPASSWORD = $null
    if ((Resolve-Path $tempDirectory).Path.StartsWith((Resolve-Path $env:TEMP).Path, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
  }
}

function Restore-Backup {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  Assert-Environment @('FESTAFLOW_BACKUP_PASSPHRASE', 'FESTAFLOW_LOCAL_PG_PASSWORD')
  if (-not $BackupSet) {
    $script:BackupSet = (Get-ChildItem -LiteralPath $BackupDirectory -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
  }
  if (-not $BackupSet -or -not (Test-Path -LiteralPath $BackupSet)) { throw 'Backup set was not found.' }

  $tempDirectory = Join-Path $env:TEMP "FestaFlowRestore-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
  try {
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $BackupSet 'manifest.json') | ConvertFrom-Json
    $encryptedDump = Join-Path $BackupSet 'database.dump.enc'
    $encryptedStorage = Join-Path $BackupSet 'storage.zip.enc'
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedDump).Hash.ToLowerInvariant() -ne $manifest.encrypted_sha256.database) { throw 'Database checksum mismatch.' }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedStorage).Hash.ToLowerInvariant() -ne $manifest.encrypted_sha256.storage) { throw 'Storage checksum mismatch.' }

    $dump = Join-Path $tempDirectory 'database.dump'
    $storageZip = Join-Path $tempDirectory 'storage.zip'
    $storage = Join-Path $tempDirectory 'storage'
    Unprotect-File $encryptedDump $dump
    Unprotect-File $encryptedStorage $storageZip
    Expand-Archive -LiteralPath $storageZip -DestinationPath $storage -Force

    $env:PGPASSWORD = $env:FESTAFLOW_LOCAL_PG_PASSWORD
    Invoke-Checked "$PostgresBin\dropdb.exe" @('--if-exists', '-h', 'localhost', '-p', "$LocalPort", '-U', 'postgres', $LocalDatabase)
    Invoke-Checked "$PostgresBin\createdb.exe" @('-h', 'localhost', '-p', "$LocalPort", '-U', 'postgres', $LocalDatabase)
    $rolesSql = "DO `$`$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin','supabase_storage_admin','dashboard_user'] LOOP IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('CREATE ROLE %I NOLOGIN',r); END IF; END LOOP; END `$`$;"
    Invoke-Checked "$PostgresBin\psql.exe" @('-X', '-h', 'localhost', '-p', "$LocalPort", '-U', 'postgres', '-d', $LocalDatabase, '-c', $rolesSql)
    $restoreList = Join-Path $tempDirectory 'restore.list'
    $unsupportedLocalExtensions = 'pg_net', 'supabase_vault', 'pgsodium', 'pg_graphql', 'pgjwt', 'pg_hashids', 'wrappers'
    $extensionPattern = '\b(' + ($unsupportedLocalExtensions -join '|') + ')\b'
    & "$PostgresBin\pg_restore.exe" -l $dump | Where-Object { $_ -notmatch $extensionPattern } | Set-Content -LiteralPath $restoreList -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate the restore catalog.' }
    Invoke-Checked "$PostgresBin\pg_restore.exe" @('--exit-on-error', '--no-owner', '--no-privileges', '-N', 'vault', '-L', $restoreList, '-h', 'localhost', '-p', "$LocalPort", '-U', 'postgres', '-d', $LocalDatabase, $dump)
    $restoredCounts = Get-CoreCounts 'localhost' $LocalPort 'postgres' $LocalDatabase $env:FESTAFLOW_LOCAL_PG_PASSWORD
    $restoredSchemaFingerprint = Get-SchemaFingerprint 'localhost' $LocalPort 'postgres' $LocalDatabase $env:FESTAFLOW_LOCAL_PG_PASSWORD

    $storageVerified = $true
    foreach ($entry in $manifest.storage_hashes.PSObject.Properties) {
      $path = Join-Path $storage $entry.Name
      if (-not (Test-Path -LiteralPath $path) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.Value) {
        $storageVerified = $false
      }
    }
    $countsMatch = ($manifest.database_counts | ConvertTo-Json -Compress) -eq ($restoredCounts | ConvertTo-Json -Compress)
    $schemaMatches = $manifest.schema_fingerprint -eq $restoredSchemaFingerprint
    $report = [ordered]@{
      restored_at = (Get-Date).ToUniversalTime().ToString('o')
      database = $LocalDatabase
      counts_match = $countsMatch
      schema_fingerprint_match = $schemaMatches
      source_counts = $manifest.database_counts
      restored_counts = $restoredCounts
      storage_hashes_match = $storageVerified
      duration_seconds = [Math]::Round($timer.Elapsed.TotalSeconds, 2)
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $BackupSet 'restore-report.json') -Encoding utf8
    if (-not $countsMatch -or -not $schemaMatches -or -not $storageVerified) { throw 'Restore verification did not match the backup manifest.' }
  } finally {
    $env:PGPASSWORD = $null
    if ((Resolve-Path $tempDirectory).Path.StartsWith((Resolve-Path $env:TEMP).Path, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
  }
}

if ($Mode -eq 'Backup') { New-Backup } else { Restore-Backup }
