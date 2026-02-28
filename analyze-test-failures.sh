#!/bin/bash
echo "=== TEST FAILURE ANALYSIS ==="
echo ""
echo "Analyzing test results from last run..."
echo ""

# Count Phase 5 test results
echo "Phase 5 Security Tests:"
npm test -- src/__tests__/security/ src/auth/sessionSecurity.test.ts src/utils/securityLogger.test.ts src/__tests__/utils/rateLimiter.test.ts src/components/admin/AuditLogViewer.test.tsx --run --reporter=verbose 2>&1 | grep -E "(Test Files|Tests)" | tail -2

echo ""
echo "Common failure patterns in full suite:"
echo "(Running quick analysis...)"
