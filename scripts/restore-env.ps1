# Environment File Restore Script
# This script helps restore your .env file from backup

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"
Write-Host "   Environment File Restore Utility"
Write-Host "========================================"
Write-Host ""

$envFile = "uniclub-backend\.env"
$backupDir = "uniclub-backend\.env-backups"
$staticBackup = "uniclub-backend\.env.backup"

# Check if backup directory exists
if (-not (Test-Path $backupDir)) {
    Write-Host "[!] No backup directory found" -ForegroundColor Yellow
    
    # Check for static backup
    if (Test-Path $staticBackup) {
        Write-Host "[i] Found static backup file" -ForegroundColor Cyan
        $response = Read-Host "Restore from static backup? (y/n)"
        
        if ($response -eq 'y') {
            Copy-Item $staticBackup -Destination $envFile
            Write-Host "[OK] Environment file restored from static backup!" -ForegroundColor Green
            exit 0
        }
    }
    
    Write-Host "[X] No backups available to restore" -ForegroundColor Red
    exit 1
}

# List available backups
$backups = Get-ChildItem $backupDir -Filter ".env.*" | Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-Host "[!] No backups found in $backupDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "Available backups:" -ForegroundColor Cyan
Write-Host ""

for ($i = 0; $i -lt $backups.Count; $i++) {
    $backup = $backups[$i]
    Write-Host "  [$($i + 1)] $($backup.Name) - $($backup.LastWriteTime)" -ForegroundColor White
}

Write-Host ""
$selection = Read-Host "Select backup to restore (1-$($backups.Count), or 'q' to quit)"

if ($selection -eq 'q') {
    Write-Host "[i] Restore cancelled" -ForegroundColor Yellow
    exit 0
}

try {
    $index = [int]$selection - 1
    $selectedBackup = $backups[$index]
    
    # Confirm restoration
    Write-Host ""
    Write-Host "[!] This will overwrite your current .env file!" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -ne 'yes') {
        Write-Host "[i] Restore cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    # Restore backup
    Copy-Item $selectedBackup.FullName -Destination $envFile
    Write-Host ""
    Write-Host "[OK] Environment file restored successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  Please restart your servers:"
    Write-Host "  npm run stop:win"
    Write-Host "  npm run start:win"
    Write-Host "========================================"
    Write-Host ""
    
} catch {
    Write-Host "[X] Invalid selection" -ForegroundColor Red
    exit 1
}

