# Environment File Backup Script
# This script creates a timestamped backup of your .env file

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"
Write-Host "   Environment File Backup Utility"
Write-Host "========================================"
Write-Host ""

$envFile = "uniclub-backend\.env"
$backupDir = "uniclub-backend\.env-backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = "$backupDir\.env.$timestamp"

# Create backup directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "[+] Created backup directory: $backupDir" -ForegroundColor Green
}

# Check if .env file exists
if (-not (Test-Path $envFile)) {
    Write-Host "[!] ERROR: .env file not found at $envFile" -ForegroundColor Red
    Write-Host "[i] If you accidentally deleted it, check: $backupDir" -ForegroundColor Yellow
    exit 1
}

# Create backup
Copy-Item $envFile -Destination $backupFile
Write-Host "[OK] Backup created: $backupFile" -ForegroundColor Green

# Keep only last 5 backups
$backups = Get-ChildItem $backupDir -Filter ".env.*" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 5) {
    $backups | Select-Object -Skip 5 | ForEach-Object {
        Remove-Item $_.FullName
        Write-Host "[~] Removed old backup: $($_.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  SUCCESS: Environment file backed up!"
Write-Host "========================================"
Write-Host ""

