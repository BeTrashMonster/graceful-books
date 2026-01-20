@echo off
cd C:\Users\Admin\graceful_books
npm test -- --run --reporter=verbose > test-execution-f12.txt 2>&1
echo Test execution completed
