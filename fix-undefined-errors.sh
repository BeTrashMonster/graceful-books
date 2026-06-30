#!/bin/bash

echo "🎯 Fixing 'possibly undefined' errors..."

# injection.test.ts line 297
sed -i '297s/result\.data/result.data!/' "C:/Users/Admin/graceful_books/src/__tests__/security/injection.test.ts"

# session.test.ts lines 431, 432, 665
sed -i '431s/session\./session!./' "C:/Users/Admin/graceful_books/src/__tests__/security/session.test.ts"
sed -i '432s/session\./session!./' "C:/Users/Admin/graceful_books/src/__tests__/security/session.test.ts"
sed -i '665s/session\./session!./' "C:/Users/Admin/graceful_books/src/__tests__/security/session.test.ts"

# sessionSecurity.test.ts lines 429, 430, 663
sed -i '429s/session\./session!./' "C:/Users/Admin/graceful_books/src/auth/sessionSecurity.test.ts"
sed -i '430s/session\./session!./' "C:/Users/Admin/graceful_books/src/auth/sessionSecurity.test.ts"
sed -i '663s/session\./session!./' "C:/Users/Admin/graceful_books/src/auth/sessionSecurity.test.ts"

echo "✅ Fixed all 'possibly undefined' errors!"
