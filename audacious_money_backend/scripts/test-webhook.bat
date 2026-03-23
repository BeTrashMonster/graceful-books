@echo off
REM Stripe Webhook Local Testing Script (Windows)
REM Requires Stripe CLI: https://stripe.com/docs/stripe-cli

echo ========================================
echo 🧪 Stripe Webhook Testing (Windows)
echo ========================================
echo.

REM Check Stripe CLI installed
where stripe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Stripe CLI not found
  echo.
  echo 📦 Install Stripe CLI:
  echo    Windows: scoop install stripe
  echo    Or download: https://github.com/stripe/stripe-cli/releases
  echo.
  exit /b 1
)

echo ✅ Stripe CLI found

REM Check Stripe CLI is authenticated
stripe config --list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Stripe CLI not authenticated
  echo.
  echo 🔑 Please login to Stripe:
  echo    stripe login
  echo.
  exit /b 1
)

echo ✅ Stripe CLI authenticated

REM Check backend is running
echo.
echo 🔍 Checking backend status...

curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Backend not running on localhost:3001
  echo.
  echo 💡 Start backend:
  echo    cd audacious_money_backend
  echo    bun run src/index.ts
  echo.
  exit /b 1
)

echo ✅ Backend is running on localhost:3001
echo.

echo 🔀 Starting webhook forwarding...
echo    Forwarding webhooks to: http://localhost:3001/stripe/webhook
echo.
echo ⚠️  Note: You'll need to keep this window open for webhook forwarding
echo.
echo Press Ctrl+C to stop testing when complete
echo.

REM Start webhook listener (this blocks until Ctrl+C)
stripe listen --forward-to localhost:3001/stripe/webhook

echo.
echo Testing complete!
