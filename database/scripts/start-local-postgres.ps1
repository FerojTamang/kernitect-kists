param(
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\16\bin',
  [int]$Port = 55432
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$localRoot = Join-Path $projectRoot '.local/postgres'
$dataPath = Join-Path $localRoot 'data'
$envPath = Join-Path $projectRoot 'server/.env'
$initdb = Join-Path $PostgresBin 'initdb.exe'
$pgctl = Join-Path $PostgresBin 'pg_ctl.exe'
$createdb = Join-Path $PostgresBin 'createdb.exe'
if (!(Test-Path -LiteralPath $initdb)) { throw 'PostgreSQL binaries not found. Supply -PostgresBin.' }
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Use a local development port between 1024 and 65535.' }
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
  if ((Test-Path -LiteralPath $envPath) -and ((Get-Content -Raw -LiteralPath $envPath) -notmatch '(?m)^DATABASE_URL=postgresql://kists_user:replace_me@localhost:5432/kists(?:_dev)?\s*$')) {
    throw 'server/.env already has a custom database URL. Preserve it; use your database or configure a separate local cluster manually.'
  }
  $randomBytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($randomBytes)
  $rng.Dispose()
  $localPassword = [Convert]::ToBase64String($randomBytes)
  $passwordFile = Join-Path $localRoot 'init-password.tmp'
  try {
    [IO.File]::WriteAllText($passwordFile, $localPassword)
    & $initdb -D $dataPath -U kists_local --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
  } finally {
    if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
  }
  $databaseUrl = 'postgresql://kists_local:' + [Uri]::EscapeDataString($localPassword) + '@127.0.0.1:' + $Port + '/kists_dev'
  $envText = if (Test-Path -LiteralPath $envPath) { Get-Content -Raw -LiteralPath $envPath } else { Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'server/.env.example') }
  $envText = $envText -replace '(?m)^DATABASE_URL=.*$', ('DATABASE_URL=' + $databaseUrl)
  [IO.File]::WriteAllText($envPath, $envText)
}
& $pgctl -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
  $startup = Start-Process -FilePath $pgctl -ArgumentList @('-D', ('"' + $dataPath + '"'), '-l', ('"' + (Join-Path $localRoot 'postgres.log') + '"'), '-o', ('"-h 127.0.0.1 -p ' + $Port + '"'), '-w', 'start') -WindowStyle Hidden -PassThru
  # Wait for pg_ctl only; -Wait would also wait for the long-running postgres child.
  $startup.WaitForExit()
  if ($startup.ExitCode -ne 0) { throw 'PostgreSQL startup failed. See .local/postgres/postgres.log.' }
}
$urlLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$connectionUri = [Uri]($urlLine.Substring('DATABASE_URL='.Length))
if ($connectionUri.Host -ne '127.0.0.1' -or $connectionUri.Port -ne $Port -or $connectionUri.AbsolutePath -ne '/kists_dev') { throw 'Local cluster does not match server/.env.' }
$savedPgPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = [Uri]::UnescapeDataString(($connectionUri.UserInfo -split ':', 2)[1])
  $exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $Port -U kists_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'kists_dev'"
  if ($LASTEXITCODE -ne 0) { throw 'Could not connect to local PostgreSQL.' }
  if ($exists -ne '1') {
    & $createdb -h 127.0.0.1 -p $Port -U kists_local kists_dev
    if ($LASTEXITCODE -ne 0) { throw 'Could not create kists_dev.' }
  }
} finally { $env:PGPASSWORD = $savedPgPassword }
Write-Output "Local PostgreSQL is ready on 127.0.0.1:$Port. Connection details are stored only in ignored server/.env."
