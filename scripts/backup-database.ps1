param(
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = 'Stop'

if (-not $env:MYSQL_DATABASE) { $env:MYSQL_DATABASE = 'procurement_management_ocr' }
if (-not $env:MYSQL_HOST) { $env:MYSQL_HOST = 'localhost' }
if (-not $env:MYSQL_PORT) { $env:MYSQL_PORT = '3306' }
if (-not $env:MYSQL_USER) { $env:MYSQL_USER = 'root' }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $OutputDirectory "$($env:MYSQL_DATABASE)-$timestamp.sql"

Write-Host "Creating database backup: $output"
& mysqldump.exe --host=$env:MYSQL_HOST --port=$env:MYSQL_PORT --user=$env:MYSQL_USER --single-transaction --routines --triggers --events --result-file=$output $env:MYSQL_DATABASE
if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE" }

Write-Host "Backup completed. Store this file securely and test restoration before relying on it."
