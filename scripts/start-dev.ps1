# Uniclub Development Server Startup Script for Windows
# This script cleanly starts both backend and frontend servers

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Uniclub Development Server Startup   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill processes on a specific port
function Kill-Port {
    param($Port, $ServerName)
    
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        $processPid = $connection.OwningProcess
        Write-Host "  [!] Found existing $ServerName on port $Port (PID: $processPid)" -ForegroundColor Yellow
        Write-Host "  [~] Stopping old process..." -ForegroundColor Yellow
        Stop-Process -Id $processPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        Write-Host "  [OK] Old $ServerName stopped" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Port $Port is available for $ServerName" -ForegroundColor Gray
    }
}

# Kill any existing servers
Write-Host "Checking for existing servers..." -ForegroundColor Yellow
Write-Host ""
Kill-Port 5000 "Backend"
Kill-Port 8081 "Frontend"
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "Starting servers from: $projectRoot" -ForegroundColor Gray
Write-Host ""

# Start backend in new window
Write-Host "[*] Starting backend server..." -ForegroundColor Green
$backendPath = Join-Path $projectRoot "uniclub-backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host '=== BACKEND SERVER ===' -ForegroundColor Green; npm run dev"

# Wait for backend to initialize
Write-Host "    Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Verify backend is running
$backendRunning = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($backendRunning) {
    Write-Host "    [OK] Backend running on port 5000" -ForegroundColor Green
} else {
    Write-Host "    [!] Backend may still be starting..." -ForegroundColor Yellow
}
Write-Host ""

# Start frontend in new window
Write-Host "[*] Starting frontend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== FRONTEND SERVER ===' -ForegroundColor Cyan; npm run frontend"

# Wait for frontend to initialize
Write-Host "    Waiting for frontend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Verify frontend is running
$frontendRunning = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($frontendRunning) {
    Write-Host "    [OK] Frontend running on port 8081" -ForegroundColor Green
} else {
    Write-Host "    [!] Frontend may still be starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SUCCESS: Servers Started!            " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API:  " -NoNewline; Write-Host "http://localhost:5000" -ForegroundColor Cyan
Write-Host "  Frontend App: " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [i] Server windows opened in separate terminals" -ForegroundColor Gray
Write-Host "  [i] To stop servers, run: " -NoNewline; Write-Host "npm run stop:win" -ForegroundColor Yellow
Write-Host ""
