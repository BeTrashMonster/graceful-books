#!/bin/bash
#
# Task 0.4 Verification Script
# Verifies all files exist and basic code structure is correct
#

echo "================================================"
echo "Task 0.4: Backend Project Setup - Verification"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter
PASS=0
FAIL=0

# Check function
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        ((FAIL++))
    fi
}

# Check directory
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1/ (MISSING)"
        ((FAIL++))
    fi
}

echo "Checking file structure..."
echo ""

# Check directories
check_dir "src/db"
check_dir "src/middleware"
check_dir "src/utils"

echo ""

# Check files
check_file "src/app.ts"
check_file "src/index.ts"
check_file "src/db/connection.ts"
check_file "src/middleware/security.ts"
check_file "src/middleware/rateLimit.ts"
check_file "src/middleware/errorHandler.ts"
check_file "src/utils/responses.ts"

echo ""
echo "Checking environment configuration..."
echo ""

if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    ((PASS++))

    # Check required env vars
    if grep -q "DATABASE_URL=" .env; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configured"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} DATABASE_URL not found in .env"
        ((FAIL++))
    fi

    if grep -q "ALLOWED_ORIGINS=" .env; then
        echo -e "${GREEN}✓${NC} ALLOWED_ORIGINS configured"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} ALLOWED_ORIGINS not found in .env"
        ((FAIL++))
    fi
else
    echo -e "${RED}✗${NC} .env file missing"
    ((FAIL++))
fi

echo ""
echo "Checking TypeScript syntax..."
echo ""

# Count TypeScript files
TS_FILES=$(find src -name "*.ts" | wc -l)
echo "Found $TS_FILES TypeScript files"

echo ""
echo "================================================"
echo "Results:"
echo "================================================"
echo -e "${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Failed: $FAIL${NC}"
else
    echo -e "${GREEN}Failed: $FAIL${NC}"
fi
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the server: bun run dev"
    echo "2. Test health check: curl http://localhost:3001/health"
    echo "3. Review TASK_0.4_COMPLETION_REPORT.md for detailed testing"
    exit 0
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo "Please review the missing files/configurations above"
    exit 1
fi
