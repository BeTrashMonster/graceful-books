#!/bin/bash

echo "🔥 PHASE 2: Fixing more error patterns!"

# Fix the unused imports in idor.test.ts  
echo "📝 Fixing unused import in idor.test.ts..."
sed -i 's/^import { db } from/\/\/ import { db } from/' "C:/Users/Admin/graceful_books/src/__tests__/security/idor.test.ts"

# Fix unused imports in injection.test.ts (already done getContact)

echo "✅ Phase 2 complete!"
