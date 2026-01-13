# Test CI/CD pipeline locally before pushing (PowerShell version)
# This script runs the same checks that CI will run

$ErrorActionPreference = "Continue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing CI/CD Pipeline Locally" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Track overall success
$failed = 0
$checks = @()

# Function to run a check
function Run-Check {
    param(
        [string]$Name,
        [string]$Command
    )

    Write-Host "Running: $Name" -ForegroundColor Yellow
    Write-Host "Command: $Command"
    Write-Host ""

    $result = @{
        Name = $Name
        Success = $false
    }

    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $Name passed" -ForegroundColor Green
            $result.Success = $true
        } else {
            Write-Host "✗ $Name failed" -ForegroundColor Red
            $script:failed = 1
        }
    } catch {
        Write-Host "✗ $Name failed with error: $_" -ForegroundColor Red
        $script:failed = 1
    }

    Write-Host ""
    $script:checks += $result
}

# Start timer
$startTime = Get-Date

# 1. ESLint
Run-Check -Name "ESLint" -Command "npm run lint"

# 2. TypeScript Type Check
Run-Check -Name "TypeScript Type Check" -Command "npm run type-check"

# 3. Tests with Coverage
Run-Check -Name "Tests with Coverage" -Command "npm run test:coverage"

# 4. Build
Run-Check -Name "Build" -Command "npm run build"

# 5. Security Scan
Run-Check -Name "npm audit" -Command "npm audit --audit-level=moderate"

# 6. E2E Tests (optional - can be slow)
if ($env:RUN_E2E -eq "true") {
    Run-Check -Name "E2E Tests" -Command "npm run e2e"
} else {
    Write-Host "Skipping E2E tests (set `$env:RUN_E2E='true' to run)" -ForegroundColor Yellow
    Write-Host ""
}

# End timer
$endTime = Get-Date
$duration = $endTime - $startTime
$minutes = [math]::Floor($duration.TotalMinutes)
$seconds = $duration.Seconds

Write-Host "============================================" -ForegroundColor Cyan

# Summary
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
foreach ($check in $checks) {
    if ($check.Success) {
        Write-Host "  ✓ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($check.Name)" -ForegroundColor Red
    }
}
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✓ All CI checks passed!" -ForegroundColor Green
    Write-Host "Duration: ${minutes}m ${seconds}s" -ForegroundColor Green
    Write-Host ""
    Write-Host "You're ready to push! 🚀" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some CI checks failed" -ForegroundColor Red
    Write-Host "Duration: ${minutes}m ${seconds}s" -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix the errors above before pushing." -ForegroundColor Red
    exit 1
}
