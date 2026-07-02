$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$target = Join-Path $backupDir "feelky-$timestamp.sql"

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is required"
}

pg_dump $env:DATABASE_URL -f $target
Write-Host "Backup written to $target"
