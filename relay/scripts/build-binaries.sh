#!/bin/bash

# Graceful Books Sync Relay - Binary Build Script
# Builds standalone binaries for Linux, Windows, and macOS

set -e  # Exit on error

VERSION=${VERSION:-"1.0.0"}
BUILD_DIR="./build"
DIST_DIR="./dist"

echo "🔨 Building Graceful Books Sync Relay binaries v${VERSION}"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Build TypeScript
echo "🔧 Compiling TypeScript..."
npm run build

# Use pkg to create standalone binaries
echo "📦 Installing pkg if needed..."
if ! command -v pkg &> /dev/null; then
  npm install -g pkg
fi

# Build for each platform
echo ""
echo "🏗️  Building binaries for all platforms..."
echo ""

# Linux (x64)
echo "🐧 Building for Linux (x64)..."
pkg \
  --targets node20-linux-x64 \
  --output "$BUILD_DIR/graceful-books-sync-linux-x64" \
  --compress GZip \
  package.json

# Linux (ARM64)
echo "🐧 Building for Linux (ARM64)..."
pkg \
  --targets node20-linux-arm64 \
  --output "$BUILD_DIR/graceful-books-sync-linux-arm64" \
  --compress GZip \
  package.json

# Windows (x64)
echo "🪟 Building for Windows (x64)..."
pkg \
  --targets node20-win-x64 \
  --output "$BUILD_DIR/graceful-books-sync-win-x64.exe" \
  --compress GZip \
  package.json

# macOS (x64)
echo "🍎 Building for macOS (x64 - Intel)..."
pkg \
  --targets node20-macos-x64 \
  --output "$BUILD_DIR/graceful-books-sync-macos-x64" \
  --compress GZip \
  package.json

# macOS (ARM64)
echo "🍎 Building for macOS (ARM64 - Apple Silicon)..."
pkg \
  --targets node20-macos-arm64 \
  --output "$BUILD_DIR/graceful-books-sync-macos-arm64" \
  --compress GZip \
  package.json

# Create archives
echo ""
echo "📦 Creating archives..."
echo ""

cd "$BUILD_DIR"

# Linux x64
tar -czf "graceful-books-sync-v${VERSION}-linux-x64.tar.gz" graceful-books-sync-linux-x64
echo "✅ Created: graceful-books-sync-v${VERSION}-linux-x64.tar.gz"

# Linux ARM64
tar -czf "graceful-books-sync-v${VERSION}-linux-arm64.tar.gz" graceful-books-sync-linux-arm64
echo "✅ Created: graceful-books-sync-v${VERSION}-linux-arm64.tar.gz"

# Windows x64
if command -v zip &> /dev/null; then
  zip "graceful-books-sync-v${VERSION}-win-x64.zip" graceful-books-sync-win-x64.exe
  echo "✅ Created: graceful-books-sync-v${VERSION}-win-x64.zip"
else
  echo "⚠️  zip command not found, skipping Windows archive"
fi

# macOS x64
tar -czf "graceful-books-sync-v${VERSION}-macos-x64.tar.gz" graceful-books-sync-macos-x64
echo "✅ Created: graceful-books-sync-v${VERSION}-macos-x64.tar.gz"

# macOS ARM64
tar -czf "graceful-books-sync-v${VERSION}-macos-arm64.tar.gz" graceful-books-sync-macos-arm64
echo "✅ Created: graceful-books-sync-v${VERSION}-macos-arm64.tar.gz"

cd ..

# Generate checksums
echo ""
echo "🔐 Generating checksums..."
cd "$BUILD_DIR"

if command -v sha256sum &> /dev/null; then
  sha256sum *.tar.gz *.zip 2>/dev/null > SHA256SUMS.txt || sha256sum *.tar.gz > SHA256SUMS.txt
  echo "✅ Created: SHA256SUMS.txt"
elif command -v shasum &> /dev/null; then
  shasum -a 256 *.tar.gz *.zip 2>/dev/null > SHA256SUMS.txt || shasum -a 256 *.tar.gz > SHA256SUMS.txt
  echo "✅ Created: SHA256SUMS.txt"
else
  echo "⚠️  No checksum tool found, skipping SHA256SUMS.txt"
fi

cd ..

# Summary
echo ""
echo "✨ Build complete!"
echo ""
echo "Built binaries:"
ls -lh "$BUILD_DIR"/*.tar.gz "$BUILD_DIR"/*.zip 2>/dev/null || ls -lh "$BUILD_DIR"/*.tar.gz
echo ""
echo "📁 Binaries available in: $BUILD_DIR/"
echo ""
echo "🎉 Done!"
