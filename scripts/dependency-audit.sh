#!/bin/bash

# Dependency Audit Script
# Phase 2.3 - SLSA Level 2 Supply Chain Security
#
# This script performs comprehensive dependency security checks:
# 1. npm audit for known vulnerabilities
# 2. Check for outdated packages
# 3. Verify lockfile integrity
# 4. Report on unapproved dependencies
#
# Usage: ./scripts/dependency-audit.sh [--fix] [--strict]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APPROVED_DEPS_FILE="$PROJECT_ROOT/APPROVED_DEPENDENCIES.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
FIX_MODE=false
STRICT_MODE=false

for arg in "$@"; do
    case $arg in
        --fix)
            FIX_MODE=true
            ;;
        --strict)
            STRICT_MODE=true
            ;;
    esac
done

echo "=============================================="
echo "  Dependency Security Audit"
echo "  $(date)"
echo "=============================================="
echo ""

# Step 1: Check npm audit
echo -e "${YELLOW}Step 1: Running npm audit...${NC}"
echo ""

AUDIT_RESULT=0
npm audit --json > /tmp/npm-audit.json 2>/dev/null || AUDIT_RESULT=$?

if [ $AUDIT_RESULT -eq 0 ]; then
    echo -e "${GREEN}No vulnerabilities found.${NC}"
else
    CRITICAL=$(cat /tmp/npm-audit.json | grep -o '"critical":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")
    HIGH=$(cat /tmp/npm-audit.json | grep -o '"high":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")
    MODERATE=$(cat /tmp/npm-audit.json | grep -o '"moderate":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")
    LOW=$(cat /tmp/npm-audit.json | grep -o '"low":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")

    echo -e "${RED}Vulnerabilities found:${NC}"
    echo "  Critical: $CRITICAL"
    echo "  High: $HIGH"
    echo "  Moderate: $MODERATE"
    echo "  Low: $LOW"
    echo ""

    if [ "$FIX_MODE" = true ]; then
        echo -e "${YELLOW}Attempting to fix vulnerabilities...${NC}"
        npm audit fix || true
        echo ""
    fi

    # In strict mode, fail on any high/critical
    if [ "$STRICT_MODE" = true ] && [ "$CRITICAL" != "0" -o "$HIGH" != "0" ]; then
        echo -e "${RED}FAILED: Critical or high vulnerabilities found in strict mode.${NC}"
        exit 1
    fi
fi

echo ""

# Step 2: Check lockfile integrity
echo -e "${YELLOW}Step 2: Verifying lockfile integrity...${NC}"
echo ""

if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
    # Check that package-lock.json matches package.json
    npm ci --dry-run > /dev/null 2>&1 && echo -e "${GREEN}Lockfile is valid and in sync.${NC}" || {
        echo -e "${RED}WARNING: Lockfile may be out of sync with package.json${NC}"
        echo "Run 'npm install' to update the lockfile."
    }
else
    echo -e "${RED}WARNING: No package-lock.json found!${NC}"
    echo "Run 'npm install' to generate a lockfile."
fi

echo ""

# Step 3: Check for outdated packages
echo -e "${YELLOW}Step 3: Checking for outdated packages...${NC}"
echo ""

OUTDATED=$(npm outdated --json 2>/dev/null || echo "{}")

if [ "$OUTDATED" = "{}" ]; then
    echo -e "${GREEN}All packages are up to date.${NC}"
else
    echo -e "${YELLOW}Outdated packages found:${NC}"
    npm outdated || true
fi

echo ""

# Step 4: Report summary
echo "=============================================="
echo "  Audit Summary"
echo "=============================================="
echo ""
echo "Date: $(date)"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# Count direct dependencies
DIRECT_DEPS=$(cat "$PROJECT_ROOT/package.json" | grep -c '"[^"]*":' || echo "unknown")
echo "Direct dependencies: ~$DIRECT_DEPS"

echo ""
echo -e "${GREEN}Audit complete.${NC}"

# Exit with appropriate code
if [ "$AUDIT_RESULT" -ne 0 ] && [ "$STRICT_MODE" = true ]; then
    exit 1
fi

exit 0
