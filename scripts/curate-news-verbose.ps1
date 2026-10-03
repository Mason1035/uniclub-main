# Uniclub News Curation Script (Verbose Mode)
# Fetches new articles from News API and curates them with AI - with detailed logging

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  News Curation (Verbose Mode)         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "[i] Starting verbose news curation from News API..." -ForegroundColor Gray
Write-Host "[i] You will see detailed logs of each step" -ForegroundColor Gray
Write-Host ""

# Navigate to backend and run curation
$backendPath = Join-Path $projectRoot "uniclub-backend"
Set-Location $backendPath

Write-Host "[*] Running news curation with verbose output..." -ForegroundColor Yellow
Write-Host ""

# Run the manual curation script with verbose flag
node manual-curation.js --verbose
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  News Curation Complete!              " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  News Curation Failed!                " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}
Write-Host ""

# Return to project root
Set-Location $projectRoot

