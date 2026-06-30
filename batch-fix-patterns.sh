#!/bin/bash

# MASTER FIX SCRIPT - Fixes all common TypeScript error patterns

echo "🚀 Starting batch pattern fixes..."

# Find all test files
TEST_FILES=$(find "C:/Users/Admin/graceful_books/src/__tests__" -name "*.ts" -o -name "*.tsx")

# Pattern 1: Fix all unused variables by prefixing with underscore
echo "📝 Fixing unused variable: companyAAccount..."
sed -i 's/let companyAAccount =/let _companyAAccount =/g' "C:/Users/Admin/graceful_books/src/__tests__/integration/security-workflows.test.ts"
sed -i 's/const companyAAccount =/const _companyAAccount =/g' "C:/Users/Admin/graceful_books/src/__tests__/integration/security-workflows.test.ts"

echo "📝 Fixing unused variable: highPrivilegeUser..."
sed -i 's/let highPrivilegeUser =/let _highPrivilegeUser =/g' "C:/Users/Admin/graceful_books/src/__tests__/integration/security-workflows.test.ts"
sed -i 's/const highPrivilegeUser =/const _highPrivilegeUser =/g' "C:/Users/Admin/graceful_books/src/__tests__/integration/security-workflows.test.ts"

echo "📝 Fixing unused variable: invoiceA_id..."
sed -i 's/const invoiceA_id =/const _invoiceA_id =/g' "C:/Users/Admin/graceful_books/src/__tests__/security/idor.test.ts"

echo "📝 Fixing unused variable: getContact..."
sed -i 's/, getContact/\/\/ , getContact/g' "C:/Users/Admin/graceful_books/src/__tests__/security/injection.test.ts"

echo "📝 Fixing unused variable: companyId in rbac.test.ts..."
sed -i 's/let companyId: string/let _companyId: string/g' "C:/Users/Admin/graceful_books/src/__tests__/security/rbac.test.ts" 

echo "📝 Fixing unused variables: beforeEach, afterEach, screen in xss.test.tsx..."
sed -i 's/beforeEach, afterEach/_beforeEach, _afterEach/g' "C:/Users/Admin/graceful_books/src/__tests__/security/xss.test.tsx"
sed -i 's/{ screen }/{ screen as _screen }/g' "C:/Users/Admin/graceful_books/src/__tests__/security/xss.test.tsx"

echo "📝 Fixing unused variable: SYNC_URL..."
sed -i 's/const SYNC_URL =/const _SYNC_URL =/g' "C:/Users/Admin/graceful_books/src/api/syncApi.ts"

echo "✅ Batch fixes complete!"
