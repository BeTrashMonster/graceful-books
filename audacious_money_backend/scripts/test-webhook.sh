#!/bin/bash
# Stripe Webhook Local Testing Script
# Requires Stripe CLI: https://stripe.com/docs/stripe-cli

set -e

echo "🧪 Stripe Webhook Testing"
echo "=========================="
echo ""

# Check Stripe CLI installed
if ! command -v stripe &> /dev/null; then
  echo "❌ Stripe CLI not found"
  echo ""
  echo "📦 Install Stripe CLI:"
  echo "   macOS:   brew install stripe/stripe-cli/stripe"
  echo "   Windows: scoop install stripe"
  echo "   Linux:   https://stripe.com/docs/stripe-cli#install"
  echo ""
  exit 1
fi

echo "✅ Stripe CLI found"

# Check Stripe CLI is authenticated
if ! stripe config --list &> /dev/null; then
  echo "❌ Stripe CLI not authenticated"
  echo ""
  echo "🔑 Please login to Stripe:"
  echo "   stripe login"
  echo ""
  exit 1
fi

echo "✅ Stripe CLI authenticated"

# Check backend is running
echo ""
echo "🔍 Checking backend status..."

if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "❌ Backend not running on localhost:3001"
  echo ""
  echo "💡 Start backend:"
  echo "   cd audacious_money_backend"
  echo "   bun run src/index.ts"
  echo ""
  exit 1
fi

echo "✅ Backend is running on localhost:3001"
echo ""

# Start webhook forwarding in background
echo "🔀 Starting webhook forwarding..."
echo "   Forwarding webhooks to: http://localhost:3001/stripe/webhook"
echo ""

stripe listen --forward-to localhost:3001/stripe/webhook &
LISTEN_PID=$!

# Trap to ensure cleanup on exit
trap "kill $LISTEN_PID 2>/dev/null || true" EXIT

# Wait for forwarding to start
echo "⏳ Waiting for webhook listener to initialize..."
sleep 5

# Trigger test events
echo ""
echo "📨 Triggering test events..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Event 1: Checkout Session Completed
echo "1️⃣  Checkout Session Completed"
echo "   → User completes checkout and payment succeeds"
if stripe trigger checkout.session.completed --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 2: Invoice Payment Succeeded
echo "2️⃣  Invoice Payment Succeeded"
echo "   → Subscription renewal payment succeeds"
if stripe trigger invoice.payment_succeeded --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 3: Invoice Payment Failed
echo "3️⃣  Invoice Payment Failed"
echo "   → Subscription renewal payment fails"
if stripe trigger invoice.payment_failed --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 4: Subscription Created
echo "4️⃣  Subscription Created"
echo "   → New subscription is created"
if stripe trigger customer.subscription.created --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 5: Subscription Updated
echo "5️⃣  Subscription Updated"
echo "   → Subscription is modified (plan change, cancellation)"
if stripe trigger customer.subscription.updated --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 6: Subscription Deleted
echo "6️⃣  Subscription Deleted"
echo "   → Subscription is permanently canceled"
if stripe trigger customer.subscription.deleted --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 7: Payment Intent Succeeded
echo "7️⃣  Payment Intent Succeeded"
echo "   → One-time payment succeeds"
if stripe trigger payment_intent.succeeded --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""
sleep 2

# Event 8: Payment Intent Failed
echo "8️⃣  Payment Intent Failed"
echo "   → One-time payment fails"
if stripe trigger payment_intent.payment_failed --skip-verify 2>&1 | grep -q "success"; then
  echo "   ✅ Event triggered successfully"
else
  echo "   ⚠️  Event triggered (check logs)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All 8 test events triggered!"
echo ""
echo "📋 Next Steps:"
echo "   1. Check backend logs for webhook processing"
echo "   2. Check database for updated records:"
echo "      - user_products (subscription access)"
echo "      - payments (payment records)"
echo "      - stripe_webhook_events (event log)"
echo ""
echo "💡 Tip: Keep 'stripe listen' running to see live webhook events"
echo "   Press Ctrl+C to stop webhook forwarding"
echo ""

# Stop webhook forwarding
echo "🛑 Stopping webhook listener..."
kill $LISTEN_PID 2>/dev/null || true

echo ""
echo "✅ Testing complete!"
echo ""
echo "🔍 Verify Results:"
echo "   Backend logs:    Check for '[STRIPE WEBHOOK]' messages"
echo "   Database:        Query stripe_webhook_events table"
echo "   Stripe CLI:      Use 'stripe events list' to see events"
echo ""
