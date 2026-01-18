# Graceful Books Sync Relay - Binary Build Script (PowerShell)
# Builds standalone binaries for Linux, Windows, and macOS

param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$BUILD_DIR = "./build"
$DIST_DIR = "./dist"

Write-Host "🔨 Building Graceful Books Sync Relay binaries v$Version" -ForegroundColor Cyan
Write-Host ""

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm ci
}

# Build TypeScript
Write-Host "🔧 Compiling TypeScript..." -ForegroundColor Yellow
npm run build

# Install pkg if needed
Write-Host "📦 Installing pkg if needed..." -ForegroundColor Yellow
npm install -g pkg

# Build for each platform
Write-Host ""
Write-Host "🏗️  Building binaries for all platforms..." -ForegroundColor Cyan
Write-Host ""

# Linux (x64)
Write-Host "🐧 Building for Linux (x64)..." -ForegroundColor Green
pkg --targets node20-linux-x64 --output "$BUILD_DIR/graceful-books-sync-linux-x64" --compress GZip package.json

# Linux (ARM64)
Write-Host "🐧 Building for Linux (ARM64)..." -ForegroundColor Green
pkg --targets node20-linux-arm64 --output "$BUILD_DIR/graceful-books-sync-linux-arm64" --compress GZip package.json

# Windows (x64)
Write-Host "🪟 Building for Windows (x64)..." -ForegroundColor Green
pkg --targets node20-win-x64 --output "$BUILD_DIR/graceful-books-sync-win-x64.exe" --compress GZip package.json

# macOS (x64)
Write-Host "🍎 Building for macOS (x64 - Intel)..." -ForegroundColor Green
pkg --targets node20-macos-x64 --output "$BUILD_DIR/graceful-books-sync-macos-x64" --compress GZip package.json

# macOS (ARM64)
Write-Host "🍎 Building for macOS (ARM64 - Apple Silicon)..." -ForegroundColor Green
pkg --targets node20-macos-arm64 --output "$BUILD_DIR/graceful-books-sync-macos-arm64" --compress GZip package.json

# Create archives
Write-Host ""
Write-Host "📦 Creating archives..." -ForegroundColor Cyan
Write-Host ""

Push-Location $BUILD_DIR

# Windows x64
Write-Host "Compressing Windows binary..." -ForegroundColor Yellow
Compress-Archive -Path "graceful-books-sync-win-x64.exe" -DestinationPath "graceful-books-sync-v$Version-win-x64.zip" -Force
Write-Host "✅ Created: graceful-books-sync-v$Version-win-x64.zip" -ForegroundColor Green

# For Linux and macOS, we need tar (use WSL or Git Bash tar if available)
if (Get-Command tar -ErrorAction SilentlyContinue) {
    # Linux x64
    tar -czf "graceful-books-sync-v$Version-linux-x64.tar.gz" graceful-books-sync-linux-x64
    Write-Host "✅ Created: graceful-books-sync-v$Version-linux-x64.tar.gz" -ForegroundColor Green

    # Linux ARM64
    tar -czf "graceful-books-sync-v$Version-linux-arm64.tar.gz" graceful-books-sync-linux-arm64
    Write-Host "✅ Created: graceful-books-sync-v$Version-linux-arm64.tar.gz" -ForegroundColor Green

    # macOS x64
    tar -czf "graceful-books-sync-v$Version-macos-x64.tar.gz" graceful-books-sync-macos-x64
    Write-Host "✅ Created: graceful-books-sync-v$Version-macos-x64.tar.gz" -ForegroundColor Green

    # macOS ARM64
    tar -czf "graceful-books-sync-v$Version-macos-arm64.tar.gz" graceful-books-sync-macos-arm64
    Write-Host "✅ Created: graceful-books-sync-v$Version-macos-arm64.tar.gz" -ForegroundColor Green
} else {
    Write-Host "⚠️  tar command not found. Install Git for Windows or WSL to create .tar.gz archives" -ForegroundColor Yellow
}

Pop-Location

# Generate checksums
Write-Host ""
Write-Host "🔐 Generating checksums..." -ForegroundColor Cyan

Push-Location $BUILD_DIR

$files = Get-ChildItem -Filter "*.zip" -File
if (Get-Command tar -ErrorAction SilentlyContinue) {
    $files += Get-ChildItem -Filter "*.tar.gz" -File
}

$checksums = @()
foreach ($file in $files) {
    $hash = (Get-FileHash -Path $file.Name -Algorithm SHA256).Hash.ToLower()
    $checksums += "$hash  $($file.Name)"
}

$checksums | Out-File -FilePath "SHA256SUMS.txt" -Encoding ASCII
Write-Host "✅ Created: SHA256SUMS.txt" -ForegroundColor Green

Pop-Location

# Summary
Write-Host ""
Write-Host "✨ Build complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Built archives:" -ForegroundColor Yellow
Get-ChildItem -Path $BUILD_DIR -Filter "*.zip" | Format-Table Name, Length -AutoSize
if (Get-Command tar -ErrorAction SilentlyContinue) {
    Get-ChildItem -Path $BUILD_DIR -Filter "*.tar.gz" | Format-Table Name, Length -AutoSize
}
Write-Host ""
Write-Host "📁 Binaries available in: $BUILD_DIR/" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
