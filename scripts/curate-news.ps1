# Uniclub News Curation Script (One-Time Run)
# Fetches new articles from News API and curates them with AI

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     News Curation (One-Time Run)      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "[i] Starting news curation from News API..." -ForegroundColor Gray
Write-Host "[i] This will fetch, filter, and curate articles using AI" -ForegroundColor Gray
Write-Host ""

# Navigate to backend and run curation
$backendPath = Join-Path $projectRoot "uniclub-backend"
Set-Location $backendPath

Write-Host "[*] Running news curation..." -ForegroundColor Yellow
Write-Host ""

# Run the manual curation script
node manual-curation.js
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "     News Curation Complete!           " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "     News Curation Failed!             " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}
Write-Host ""

# Return to project root
Set-Location $projectRoot

