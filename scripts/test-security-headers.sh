#!/bin/bash
# Test Security Headers Configuration
# This script checks if security headers are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Security Headers Test Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if URL is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <URL>${NC}"
    echo -e "${YELLOW}Example: $0 https://staging.gracefulbooks.com${NC}"
    echo ""
    echo -e "${YELLOW}Testing localhost requires a local server that supports _headers file:${NC}"
    echo -e "${YELLOW}  npm install -g netlify-cli && netlify dev${NC}"
    echo -e "${YELLOW}  OR${NC}"
    echo -e "${YELLOW}  npm install -g wrangler && wrangler pages dev dist${NC}"
    exit 1
fi

URL="$1"

echo -e "${BLUE}Testing URL: ${URL}${NC}"
echo ""

# Function to check header
check_header() {
    local header_name="$1"
    local expected_value="$2"
    local header_value=$(curl -sI "$URL" | grep -i "^${header_name}:" | sed "s/${header_name}: //i" | tr -d '\r')

    if [ -z "$header_value" ]; then
        echo -e "  ${RED}✗${NC} ${header_name}: ${RED}NOT FOUND${NC}"
        return 1
    else
        echo -e "  ${GREEN}✓${NC} ${header_name}: ${GREEN}PRESENT${NC}"
        echo -e "    ${YELLOW}Value:${NC} ${header_value}"

        # Check if expected value matches (if provided)
        if [ -n "$expected_value" ]; then
            if [[ "$header_value" == *"$expected_value"* ]]; then
                echo -e "    ${GREEN}✓ Contains expected value${NC}"
            else
                echo -e "    ${YELLOW}⚠ Does not contain: ${expected_value}${NC}"
            fi
        fi
        echo ""
        return 0
    fi
}

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

echo -e "${BLUE}Checking Security Headers:${NC}"
echo ""

# Initialize counters
total=0
passed=0

# 1. Content-Security-Policy
echo -e "${BLUE}[1/7] Content-Security-Policy${NC}"
if check_header "Content-Security-Policy" "default-src 'self'"; then
    ((passed++))
fi
((total++))

# 2. X-Frame-Options
echo -e "${BLUE}[2/7] X-Frame-Options${NC}"
if check_header "X-Frame-Options" "DENY"; then
    ((passed++))
fi
((total++))

# 3. X-Content-Type-Options
echo -e "${BLUE}[3/7] X-Content-Type-Options${NC}"
if check_header "X-Content-Type-Options" "nosniff"; then
    ((passed++))
fi
((total++))

# 4. X-XSS-Protection
echo -e "${BLUE}[4/7] X-XSS-Protection${NC}"
if check_header "X-XSS-Protection" "1"; then
    ((passed++))
fi
((total++))

# 5. Strict-Transport-Security
echo -e "${BLUE}[5/7] Strict-Transport-Security${NC}"
if check_header "Strict-Transport-Security" "max-age=31536000"; then
    ((passed++))
fi
((total++))

# 6. Referrer-Policy
echo -e "${BLUE}[6/7] Referrer-Policy${NC}"
if check_header "Referrer-Policy" "strict-origin-when-cross-origin"; then
    ((passed++))
fi
((total++))

# 7. Permissions-Policy
echo -e "${BLUE}[7/7] Permissions-Policy${NC}"
if check_header "Permissions-Policy" "geolocation=()"; then
    ((passed++))
fi
((total++))

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Passed: ${GREEN}${passed}${NC}/${total}"
echo ""

if [ $passed -eq $total ]; then
    echo -e "${GREEN}✓ All security headers are properly configured!${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "1. Test application functionality with strict CSP"
    echo -e "2. Run SecurityHeaders.com scan: https://securityheaders.com/?q=${URL}"
    echo -e "3. Run Mozilla Observatory scan: https://observatory.mozilla.org/analyze/${URL}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some security headers are missing or misconfigured${NC}"
    echo ""
    echo -e "${YELLOW}Action Required:${NC}"
    echo -e "1. Verify public/_headers file is deployed"
    echo -e "2. Check platform-specific header configuration"
    echo -e "3. Review deployment logs for errors"
    echo ""
    exit 1
fi
