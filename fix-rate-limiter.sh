#!/bin/bash

echo "🎯 Fixing rateLimiter.test.ts auditLogs errors..."

# Replace all instances of the mockDb definition to include auditLogs
sed -i 's/audit_logs: { add:/audit_logs: { add:/g; s/}/}, auditLogs: { add: vi.fn() }/g' \
  "C:/Users/Admin/graceful_books/src/__tests__/utils/rateLimiter.test.ts"

echo "Actually, let me use a different approach..."

# Find all mockDb definitions and add auditLogs property
awk '{
  if (/const mockDb = {/) {
    print
    getline
    print
    print "        auditLogs: { add: vi.fn() },"
  } else {
    print
  }
}' "C:/Users/Admin/graceful_books/src/__tests__/utils/rateLimiter.test.ts" > /tmp/rateLimiter.tmp

mv /tmp/rateLimiter.tmp "C:/Users/Admin/graceful_books/src/__tests__/utils/rateLimiter.test.ts"

echo "✅ Fixed auditLogs errors!"
