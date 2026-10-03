# Uniclub Development Server Shutdown Script for Windows
# This script safely stops all development servers

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Uniclub Development Server Shutdown  " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$stopped = $false

# Kill backend (port 5000)
Write-Host "Checking backend server (port 5000)..." -ForegroundColor Yellow
$backend = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backend) {
    $backendPid = $backend.OwningProcess
    Write-Host "  [~] Stopping backend (PID: $backendPid)..." -ForegroundColor Yellow
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  [OK] Backend server stopped" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "  [i] No backend server running" -ForegroundColor Gray
}
Write-Host ""

# Kill frontend (port 8081)
Write-Host "Checking frontend server (port 8081)..." -ForegroundColor Yellow
$frontend = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($frontend) {
    $frontendPid = $frontend.OwningProcess
    Write-Host "  [~] Stopping frontend (PID: $frontendPid)..." -ForegroundColor Yellow
    Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  [OK] Frontend server stopped" -ForegroundColor Green
    $stopped = $true
} else {
    Write-Host "  [i] No frontend server running" -ForegroundColor Gray
}
Write-Host ""

# Summary
if ($stopped) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS: All servers stopped!        " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Gray
    Write-Host "  INFO: No servers were running        " -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Gray
}
Write-Host ""
