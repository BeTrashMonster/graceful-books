#!/bin/bash
# Test CI/CD pipeline locally before pushing
# This script runs the same checks that CI will run

set -e  # Exit on any error

echo "============================================"
echo "Testing CI/CD Pipeline Locally"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall success
FAILED=0

# Function to run a check
run_check() {
    local name="$1"
    local command="$2"

    echo -e "${YELLOW}Running: ${name}${NC}"
    echo "Command: ${command}"
    echo ""

    if eval "${command}"; then
        echo -e "${GREEN}✓ ${name} passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ ${name} failed${NC}"
        echo ""
        FAILED=1
        return 1
    fi
}

# Start timer
START_TIME=$(date +%s)

# 1. ESLint
run_check "ESLint" "npm run lint" || true

# 2. TypeScript Type Check
run_check "TypeScript Type Check" "npm run type-check" || true

# 3. Tests with Coverage
run_check "Tests with Coverage" "npm run test:coverage" || true

# 4. Build
run_check "Build" "npm run build" || true

# 5. Security Scan
run_check "npm audit" "npm audit --audit-level=moderate" || true

# 6. E2E Tests (optional - can be slow)
if [ "${RUN_E2E:-false}" = "true" ]; then
    run_check "E2E Tests" "npm run e2e" || true
else
    echo -e "${YELLOW}Skipping E2E tests (set RUN_E2E=true to run)${NC}"
    echo ""
fi

# End timer
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo "============================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All CI checks passed!${NC}"
    echo -e "${GREEN}Duration: ${MINUTES}m ${SECONDS}s${NC}"
    echo ""
    echo "You're ready to push! 🚀"
    exit 0
else
    echo -e "${RED}✗ Some CI checks failed${NC}"
    echo -e "${RED}Duration: ${MINUTES}m ${SECONDS}s${NC}"
    echo ""
    echo "Fix the errors above before pushing."
    exit 1
fi
