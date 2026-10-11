param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$Confirm
)

$ErrorActionPreference = 'Stop'
if (-not $Confirm) { throw 'Restore is destructive. Re-run with -Confirm after verifying the backup file and target database.' }
if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }

if (-not $env:MYSQL_DATABASE) { $env:MYSQL_DATABASE = 'procurement_management_ocr' }
if (-not $env:MYSQL_HOST) { $env:MYSQL_HOST = 'localhost' }
if (-not $env:MYSQL_PORT) { $env:MYSQL_PORT = '3306' }
if (-not $env:MYSQL_USER) { $env:MYSQL_USER = 'root' }

Write-Host "Restoring $BackupFile into $($env:MYSQL_DATABASE)..."
Get-Content -Raw -Path $BackupFile | & mysql.exe --host=$env:MYSQL_HOST --port=$env:MYSQL_PORT --user=$env:MYSQL_USER $env:MYSQL_DATABASE
if ($LASTEXITCODE -ne 0) { throw "mysql restore failed with exit code $LASTEXITCODE" }
Write-Host 'Restore completed. Run npm run db:verify next.'
