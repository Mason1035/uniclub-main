# Emergency script to kill all Node.js processes
# Use this if servers are stuck or not responding

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  WARNING: Kill All Node Processes     " -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es):" -ForegroundColor Yellow
    Write-Host ""
    
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) | Started: $($_.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "[~] Killing all Node.js processes..." -ForegroundColor Yellow
    
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    # Verify all are stopped
    $remaining = Get-Process node -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "[!] Some processes may still be running" -ForegroundColor Yellow
    } else {
        Write-Host "[OK] All Node.js processes stopped" -ForegroundColor Green
    }
} else {
    Write-Host "[i] No Node.js processes found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Clean slate - ready to start fresh!  " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Run: " -NoNewline; Write-Host "npm run start:win" -ForegroundColor Cyan -NoNewline; Write-Host " to start servers" -ForegroundColor Gray
Write-Host ""
