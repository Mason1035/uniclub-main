# Uniclub Server Status Check Script for Windows
# This script checks if development servers are running

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     Uniclub Server Status Check       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check backend (port 5000)
Write-Host "Backend Server (Port 5000):" -ForegroundColor Yellow
$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backend) {
    $backendPid = $backend.OwningProcess
    $backendProcess = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
    Write-Host "  Status:      " -NoNewline; Write-Host "[RUNNING]" -ForegroundColor Green
    Write-Host "  PID:         $backendPid" -ForegroundColor Gray
    Write-Host "  Process:     $($backendProcess.ProcessName)" -ForegroundColor Gray
    Write-Host "  Start Time:  $($backendProcess.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
    Write-Host "  URL:         " -NoNewline; Write-Host "http://localhost:5000" -ForegroundColor Cyan
    
    # Test backend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  Health:      " -NoNewline; Write-Host "[OK] API responding" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Health:      " -NoNewline; Write-Host "[!] API not responding" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Status:      " -NoNewline; Write-Host "[NOT RUNNING]" -ForegroundColor Red
    Write-Host "  URL:         http://localhost:5000" -ForegroundColor Gray
}
Write-Host ""

# Check frontend (port 8081)
Write-Host "Frontend Server (Port 8081):" -ForegroundColor Yellow
$frontend = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($frontend) {
    $frontendPid = $frontend.OwningProcess
    $frontendProcess = Get-Process -Id $frontendPid -ErrorAction SilentlyContinue
    Write-Host "  Status:      " -NoNewline; Write-Host "[RUNNING]" -ForegroundColor Green
    Write-Host "  PID:         $frontendPid" -ForegroundColor Gray
    Write-Host "  Process:     $($frontendProcess.ProcessName)" -ForegroundColor Gray
    Write-Host "  Start Time:  $($frontendProcess.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
    Write-Host "  URL:         " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Cyan
    
    # Test frontend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  Health:      " -NoNewline; Write-Host "[OK] App responding" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Health:      " -NoNewline; Write-Host "[!] App not responding" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Status:      " -NoNewline; Write-Host "[NOT RUNNING]" -ForegroundColor Red
    Write-Host "  URL:         http://localhost:8081" -ForegroundColor Gray
}
Write-Host ""

# Check for any other node processes
Write-Host "Other Node Processes:" -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -notin @($backendPid, $frontendPid) }
if ($nodeProcesses) {
    Write-Host "  Found $($nodeProcesses.Count) other node process(es):" -ForegroundColor Gray
    $nodeProcesses | ForEach-Object {
        Write-Host "    - PID: $($_.Id) | Started: $($_.StartTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
    }
} else {
    Write-Host "  No other node processes detected" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($backend -and $frontend) {
    Write-Host "  SUCCESS: Both servers are running!   " -ForegroundColor Green
    Write-Host "  Open http://localhost:8081 to view   " -ForegroundColor Cyan
} elseif ($backend -or $frontend) {
    Write-Host "  WARNING: Only one server is running  " -ForegroundColor Yellow
    Write-Host "  Run: npm run start:win               " -ForegroundColor Yellow
} else {
    Write-Host "  INFO: No servers are running         " -ForegroundColor Red
    Write-Host "  Run: npm run start:win               " -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
