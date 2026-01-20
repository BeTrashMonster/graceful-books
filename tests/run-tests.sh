#!/bin/bash
cd /c/Users/Admin/graceful_books
npx vitest run --no-coverage 2>&1 | tee full-test-output.txt
echo "Exit code: $?"
