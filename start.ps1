
# Move to the project directory
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "       INTELLIGENT IOT SOLUTIONS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Docker containers..." -ForegroundColor Yellow
Write-Host ""

# Build and start the API and its dependencies
docker compose up -d --build api

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Docker Compose failed to start." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Waiting for API to become ready..." -ForegroundColor Yellow

# Wait for the API health endpoint
$apiReady = $false

for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest `
            -Uri "http://localhost:8000/health" `
            -UseBasicParsing `
            -TimeoutSec 2

        if ($response.StatusCode -eq 200) {
            $apiReady = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

if ($apiReady) {
    Write-Host "       SYSTEM STARTED SUCCESSFULLY" -ForegroundColor Green
} else {
    Write-Host "       API NOT READY YET" -ForegroundColor Red
    Write-Host "Check the API logs with: docker compose logs api" -ForegroundColor Yellow
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "API Documentation (Swagger):" -ForegroundColor White
Write-Host "http://localhost:8000/docs" -ForegroundColor Blue
Write-Host ""

Write-Host "API Health:" -ForegroundColor White
Write-Host "http://localhost:8000/health" -ForegroundColor Blue
Write-Host ""

Write-Host "Dashboard:" -ForegroundColor White
Write-Host "http://localhost:8000/dashboard" -ForegroundColor Blue
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
