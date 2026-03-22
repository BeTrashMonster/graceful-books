# Audacious Money - Stripe Integration

> Complete payment processing implementation with Stripe

## Overview

Audacious Money uses Stripe for:
- Subscription management
- One-time and recurring payments
- Usage-based billing (CPU product)
- Discount codes
- Invoicing
- Webhook handling

---

## Stripe Setup

### Products to Create in Stripe Dashboard

```
Product: Budgeting Tool
├─ Price: $10/month recurring
├─ Metadata: { product_slug: "budgeting", charity_amount: 5, revenue_amount: 5 }

Product: Debt Management
├─ Price: $20/month recurring
├─ Metadata: { product_slug: "debt_management", charity_amount: 5, revenue_amount: 15 }

Product: Service Provider Management
├─ Price: $30/month recurring
├─ Metadata: { product_slug: "service_provider", charity_amount: 5, revenue_amount: 25 }

Product: CPG/Distributor Management
├─ Price: $30/month recurring
├─ Metadata: { product_slug: "cpg", charity_amount: 5, revenue_amount: 25 }

Product: CPU Calculator
├─ Price: $5/product metered usage (monthly)
├─ Usage limit: $50/month max
├─ Metadata: { product_slug: "cpu", charity_amount: 5, usage_based: true }

Product: Bookkeeping Suite
├─ Price: $40/month recurring
├─ Metadata: { product_slug: "bookkeeping", charity_amount: 5, revenue_amount: 35 }

Product: Fractional CFO
├─ Price: $60/month recurring
├─ Metadata: { product_slug: "fractional_cfo", charity_amount: 5, revenue_amount: 55 }
```

---

## Payment Flows

### Flow 1: New Product Purchase (Standalone)

**Scenario:** User creates account, buys CPG tool for $30/month

**Step 1: User completes signup & charity selection**

**Step 2: Create Stripe Checkout Session**

**Frontend:**
```typescript
// User clicks "Continue to Payment"
const response = await fetch('/users/me/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productSlug: 'cpg',
    discountCode: 'WELCOME20' // optional
  })
});

const { checkoutUrl } = await response.json();

// Redirect to Stripe Checkout
window.location.href = checkoutUrl;
```

**Backend (`POST /users/me/products`):**

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. Get product details
const product = await db.products.findOne({ slug: 'cpg' });

// 2. Apply discount code if provided
let discountCoupon = null;
if (discountCode) {
  const discount = await validateDiscountCode(discountCode, product.id);
  discountCoupon = discount.stripeCouponId;
}

// 3. Calculate trial end date (14 days from now)
const trialEndDate = new Date();
trialEndDate.setDate(trialEndDate.getDate() + 14);
const trialEnd = Math.floor(trialEndDate.getTime() / 1000); // Unix timestamp

// 4. Create Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: user.email,
  line_items: [{
    price: product.stripePriceId,
    quantity: 1,
  }],
  subscription_data: {
    trial_end: trialEnd, // 14-day trial
    metadata: {
      user_id: user.id,
      product_id: product.id,
      product_slug: product.slug,
      charity_amount: product.charityAmount,
      revenue_amount: product.revenueAmount
    }
  },
  discounts: discountCoupon ? [{ coupon: discountCoupon }] : [],
  success_url: `${process.env.APP_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.APP_URL}/onboarding/payment?cancelled=true`,
  metadata: {
    user_id: user.id,
    product_id: product.id,
    affiliate_code: user.affiliateCode || null
  }
});

return { checkoutUrl: session.url, sessionId: session.id };
```

**Step 3: User completes payment on Stripe**

**Step 4: Stripe redirects back**

```
Success: https://app.audacious.money/onboarding/success?session_id=cs_test_xxx
Cancel:  https://app.audacious.money/onboarding/payment?cancelled=true
```

**Step 5: Stripe sends webhook**

```
Event: checkout.session.completed
→ POST https://api.audacious.money/stripe/webhook
```

**Backend Webhook Handler:**

```typescript
// POST /stripe/webhook
const sig = request.headers['stripe-signature'];
let event;

try {
  event = stripe.webhooks.constructEvent(
    request.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
} catch (err) {
  return response.status(400).send(`Webhook Error: ${err.message}`);
}

if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const { user_id, product_id, affiliate_code } = session.metadata;

  // 1. Create user_products record
  await db.userProducts.insert({
    userId: user_id,
    productId: product_id,
    status: 'trial',
    trialEndsAt: new Date(session.subscription.trial_end * 1000),
    activatedAt: new Date(),
    stripeSubscriptionId: session.subscription
  });

  // 2. Track affiliate conversion
  if (affiliate_code) {
    const affiliate = await db.affiliates.findOne({ code: affiliate_code });
    await db.affiliateConversions.insert({
      affiliateId: affiliate.id,
      userId: user_id,
      productId: product_id,
      signedUpAt: new Date(),
      convertedAt: new Date()
    });
  }

  // 3. Send welcome email
  await sendEmail({
    to: session.customer_email,
    subject: 'Welcome to Audacious Money!',
    template: 'trial-started',
    data: {
      productName: session.metadata.product_slug,
      trialEndsAt: new Date(session.subscription.trial_end * 1000)
    }
  });
}

return response.status(200).json({ received: true });
```

---

### Flow 2: Upgrade from Standalone → Bookkeeping Suite

**Scenario:** User has CPG ($30/mo), upgrades to Bookkeeping Suite ($40/mo)

**Frontend:**
```typescript
// User clicks "Upgrade to Bookkeeping Suite" on dashboard
const response = await fetch('/users/me/products/upgrade', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    from: 'cpg',
    to: 'bookkeeping'
  })
});

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;
```

**Backend (`POST /users/me/products/upgrade`):**

```typescript
// 1. Get current subscription
const currentProduct = await db.userProducts.findOne({
  userId: user.id,
  productSlug: 'cpg',
  status: 'active'
});

// 2. Calculate proration
const subscription = await stripe.subscriptions.retrieve(
  currentProduct.stripeSubscriptionId
);

// 3. Create Stripe Checkout for upgrade
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: subscription.customer,
  line_items: [{
    price: bookkeepingProduct.stripePriceId,
    quantity: 1
  }],
  subscription_data: {
    metadata: {
      user_id: user.id,
      product_id: bookkeepingProduct.id,
      upgraded_from: currentProduct.id,
      is_upgrade: 'true'
    }
  },
  success_url: `${process.env.APP_URL}/dashboard?upgraded=true`,
  cancel_url: `${process.env.APP_URL}/settings/subscription`,
  metadata: {
    old_subscription_id: subscription.id, // Cancel this after upgrade
    user_id: user.id
  }
});

return { checkoutUrl: session.url };
```

**Webhook Handler (checkout.session.completed):**

```typescript
if (session.metadata.is_upgrade === 'true') {
  const { user_id, product_id, upgraded_from, old_subscription_id } = session.metadata;

  // 1. Cancel old subscription
  await stripe.subscriptions.cancel(old_subscription_id, {
    prorate: true // User gets credit for unused time
  });

  // 2. Update old product status
  await db.userProducts.update(
    { userId: user_id, productId: upgraded_from },
    { status: 'cancelled', cancelledAt: new Date() }
  );

  // 3. Create new product entitlement
  await db.userProducts.insert({
    userId: user_id,
    productId: product_id,
    status: 'active',
    activatedAt: new Date(),
    stripeSubscriptionId: session.subscription
  });

  // 4. Send confirmation email
  await sendEmail({
    to: user.email,
    subject: 'Upgrade Complete!',
    template: 'upgrade-confirmation',
    data: { newProduct: 'Bookkeeping Suite' }
  });
}
```

---

### Flow 3: Adding Additional Standalone Product

**Scenario:** User has Budgeting ($10/mo), adds CPG ($30/mo) separately

**Frontend:**
```typescript
// User clicks inactive CPG node on financial web, sees "Add CPG - $30/mo"
const response = await fetch('/users/me/products', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    productSlug: 'cpg'
  })
});
```

**Backend:**
Same as Flow 1, but:
- Check if user already past first trial → NO trial for additional products
- Create separate Stripe subscription (not upgrade, additional)
- User now has 2 subscriptions: Budgeting + CPG

**Webhook Handler:**
- Creates separate `user_products` record for CPG
- Status: 'active' (no trial if user already has active products)

**Important:** User pays $10 + $30 = $40/month total (same as Bookkeeping Suite, but doesn't get other products)

---

### Flow 4: CPU Calculator (Usage-Based Billing)

**Scenario:** User has CPU product, analyzed 8 products this month

**Stripe Setup:**
```typescript
// Create metered price in Stripe
const price = await stripe.prices.create({
  product: cpuProductId,
  currency: 'usd',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    aggregate_usage: 'sum'
  },
  billing_scheme: 'per_unit',
  unit_amount: 500, // $5.00 in cents
  metadata: {
    max_amount: 5000 // $50.00 max
  }
});
```

**Tracking Usage:**

```typescript
// User analyzes a product in CPU calculator (frontend)
await fetch('/cpu/analyze', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    productData: { /* CPU calculation data */ }
  })
});

// Backend - Record usage
const subscription = await db.userProducts.findOne({
  userId: user.id,
  productSlug: 'cpu',
  status: 'active'
});

// Report usage to Stripe
await stripe.subscriptionItems.createUsageRecord(
  subscription.stripeSubscriptionItemId,
  {
    quantity: 1, // 1 product analyzed
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment'
  }
);

// Check if user hit max ($50)
const usage = await stripe.subscriptionItems.listUsageRecordSummaries(
  subscription.stripeSubscriptionItemId,
  { limit: 1 }
);

const currentCost = usage.data[0].total_usage * 5; // $5 per product
if (currentCost >= 50) {
  // User hit max, no additional charges this month
  return { message: 'Max usage reached ($50)', additionalCost: 0 };
}
```

**Monthly Billing:**
- Stripe automatically bills at end of month based on usage
- Invoice shows: "CPU Calculator: 8 products × $5 = $40"
- Webhook `invoice.payment_succeeded` records payment

---

### Flow 5: Trial Expiration & Conversion

**Scenario:** User's 14-day trial ends

**Automatic Process (Stripe handles):**

**Day 14:** Trial ends, Stripe attempts to charge card

**If payment succeeds:**
```
Event: invoice.payment_succeeded
→ Webhook updates user_products.status = 'active'
```

**Webhook Handler:**

```typescript
if (event.type === 'invoice.payment_succeeded') {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  // Find user_product by subscription ID
  const userProduct = await db.userProducts.findOne({
    stripeSubscriptionId: subscriptionId,
    status: 'trial'
  });

  if (userProduct) {
    // Convert trial to active
    await db.userProducts.update(
      { id: userProduct.id },
      {
        status: 'active',
        trialConverted: true
      }
    );

    // Record payment
    await db.payments.insert({
      userId: userProduct.userId,
      productId: userProduct.productId,
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      totalAmount: invoice.amount_paid / 100,
      charityAmount: invoice.metadata.charity_amount,
      revenueAmount: invoice.metadata.revenue_amount,
      charityId: user.currentCharityId,
      status: 'succeeded',
      paidAt: new Date(invoice.created * 1000)
    });

    // Track affiliate commission (if first payment)
    if (userProduct.affiliateConversionId) {
      const commission = calculateCommission(invoice.amount_paid / 100, affiliate);
      await db.affiliateConversions.update(
        { id: userProduct.affiliateConversionId },
        {
          firstPaymentAmount: invoice.amount_paid / 100,
          commissionEarned: commission
        }
      );
    }

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Your trial has been converted!',
      template: 'trial-converted'
    });
  }
}
```

**If payment fails:**
```
Event: invoice.payment_failed
→ Webhook updates user_products.status = 'expired'
→ Send email: "Payment failed, update your card"
```

**Webhook Handler:**

```typescript
if (event.type === 'invoice.payment_failed') {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  const userProduct = await db.userProducts.findOne({
    stripeSubscriptionId: subscriptionId
  });

  // Update status to expired
  await db.userProducts.update(
    { id: userProduct.id },
    {
      status: 'expired',
      expiresAt: new Date()
    }
  );

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Payment Failed - Update Your Card',
    template: 'payment-failed',
    data: {
      productName: userProduct.product.name,
      updateCardUrl: `${process.env.APP_URL}/settings/billing`
    }
  });
}
```

---

### Flow 6: Subscription Cancellation

**User initiates cancellation:**

**Frontend:**
```typescript
// User clicks "Cancel Subscription" in settings
const response = await fetch(`/users/me/products/${productId}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    reason: 'Too expensive', // optional
    feedback: 'Great product but not in budget right now'
  })
});
```

**Backend (`POST /users/me/products/:id/cancel`):**

```typescript
// 1. Get user product
const userProduct = await db.userProducts.findOne({
  id: productId,
  userId: user.id
});

// 2. Cancel Stripe subscription at period end (not immediately)
await stripe.subscriptions.update(userProduct.stripeSubscriptionId, {
  cancel_at_period_end: true
});

// 3. Update database
await db.userProducts.update(
  { id: userProduct.id },
  {
    status: 'cancelled',
    cancelledAt: new Date()
    // expires_at will be set by webhook when period ends
  }
);

// 4. Track cancellation reason
await db.cancellationFeedback.insert({
  userId: user.id,
  productId: productId,
  reason: 'Too expensive',
  feedback: 'Great product but not in budget right now',
  cancelledAt: new Date()
});

// 5. Send confirmation email
await sendEmail({
  to: user.email,
  subject: 'Subscription Cancelled',
  template: 'subscription-cancelled',
  data: {
    productName: userProduct.product.name,
    expiresAt: subscription.current_period_end
  }
});
```

**When billing period ends:**

```
Event: customer.subscription.deleted
→ Webhook updates user_products.expires_at
→ User loses access to product features
```

**Webhook Handler:**

```typescript
if (event.type === 'customer.subscription.deleted') {
  const subscription = event.data.object;

  await db.userProducts.update(
    { stripeSubscriptionId: subscription.id },
    {
      status: 'expired',
      expiresAt: new Date()
    }
  );

  // User can still export data, but features disabled
}
```

---

### Flow 7: Reactivation

**User wants to reactivate after cancellation:**

**Frontend:**
```typescript
// User clicks "Reactivate" on expired product
const response = await fetch(`/users/me/products/${productId}/reactivate`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` }
});

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;
```

**Backend (`POST /users/me/products/:id/reactivate`):**

```typescript
// 1. Get expired product
const userProduct = await db.userProducts.findOne({
  id: productId,
  userId: user.id,
  status: 'expired'
});

const product = await db.products.findById(userProduct.productId);

// 2. Create NEW Stripe Checkout (no trial for reactivations)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: user.email,
  line_items: [{
    price: product.stripePriceId,
    quantity: 1
  }],
  subscription_data: {
    // NO TRIAL
    metadata: {
      user_id: user.id,
      product_id: product.id,
      is_reactivation: 'true'
    }
  },
  success_url: `${process.env.APP_URL}/dashboard?reactivated=true`,
  cancel_url: `${process.env.APP_URL}/settings/subscription`,
  metadata: {
    old_user_product_id: userProduct.id,
    user_id: user.id
  }
});

return { checkoutUrl: session.url };
```

**Webhook Handler (checkout.session.completed):**

```typescript
if (session.metadata.is_reactivation === 'true') {
  // Update existing user_product record
  await db.userProducts.update(
    { id: session.metadata.old_user_product_id },
    {
      status: 'active',
      reactivatedAt: new Date(),
      stripeSubscriptionId: session.subscription,
      expiresAt: null
    }
  );

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Welcome Back!',
    template: 'reactivation-success'
  });
}
```

---

## Discount Codes

### Creating Discount Codes in Admin Dashboard

**Admin creates discount code:**

**Frontend (Admin Dashboard):**
```typescript
const response = await fetch('/admin/discount-codes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminJwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'WELCOME20',
    discountType: 'percentage',
    discountValue: 20.00,
    productSlugs: null, // null = all products
    maxUses: 1000,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31'
  })
});
```

**Backend (`POST /admin/discount-codes`):**

```typescript
// 1. Create Stripe coupon
const coupon = await stripe.coupons.create({
  percent_off: 20,
  duration: 'once', // Apply to first invoice only
  name: 'WELCOME20',
  metadata: {
    code: 'WELCOME20',
    audacious_money_id: 'will_be_set_after_db_insert'
  }
});

// 2. Create discount code in database
const discountCode = await db.discountCodes.insert({
  code: 'WELCOME20',
  discountType: 'percentage',
  discountValue: 20.00,
  productIds: null,
  maxUses: 1000,
  currentUses: 0,
  validFrom: new Date('2026-01-01'),
  validUntil: new Date('2026-12-31'),
  stripeCouponId: coupon.id,
  active: true,
  createdBy: adminUser.id
});

return { discountCode };
```

### Applying Discount Codes

**User enters discount code at checkout:**

**Frontend:**
```typescript
// Before creating checkout session
const validateResponse = await fetch('/discount-codes/validate', {
  method: 'POST',
  body: JSON.stringify({
    code: 'WELCOME20',
    productSlug: 'cpg'
  })
});

if (validateResponse.ok) {
  // Code is valid, proceed to checkout with code
  const checkoutResponse = await fetch('/users/me/products', {
    method: 'POST',
    body: JSON.stringify({
      productSlug: 'cpg',
      discountCode: 'WELCOME20'
    })
  });
}
```

**Backend (`POST /discount-codes/validate`):**

```typescript
// 1. Look up discount code
const discount = await db.discountCodes.findOne({
  code: 'WELCOME20',
  active: true
});

// 2. Check expiry
const now = new Date();
if (discount.validUntil && discount.validUntil < now) {
  return { valid: false, error: 'Code expired' };
}

// 3. Check max uses
if (discount.maxUses && discount.currentUses >= discount.maxUses) {
  return { valid: false, error: 'Code limit reached' };
}

// 4. Check product eligibility
if (discount.productIds && !discount.productIds.includes(productId)) {
  return { valid: false, error: 'Code not valid for this product' };
}

// 5. Check uses per user
const userUsage = await db.discountCodeUsage.count({
  discountCodeId: discount.id,
  userId: user.id
});

if (userUsage >= discount.maxUsesPerUser) {
  return { valid: false, error: 'You already used this code' };
}

return {
  valid: true,
  discountType: discount.discountType,
  discountValue: discount.discountValue
};
```

**When checkout completes:**

```typescript
// Webhook: checkout.session.completed
if (session.discount) {
  // Track discount code usage
  await db.discountCodeUsage.insert({
    discountCodeId: discountCode.id,
    userId: user.id,
    productId: product.id,
    discountAmount: session.total_details.amount_discount / 100,
    usedAt: new Date()
  });

  // Increment current uses
  await db.discountCodes.update(
    { id: discountCode.id },
    { currentUses: db.raw('current_uses + 1') }
  );
}
```

---

## Webhook Events to Handle

### Critical Events

```typescript
const webhookHandlers = {
  // New subscription created
  'checkout.session.completed': handleCheckoutComplete,

  // Recurring payment succeeded
  'invoice.payment_succeeded': handlePaymentSuccess,

  // Payment failed
  'invoice.payment_failed': handlePaymentFailed,

  // Subscription cancelled
  'customer.subscription.deleted': handleSubscriptionDeleted,

  // Subscription updated (plan change, payment method update)
  'customer.subscription.updated': handleSubscriptionUpdated,

  // Payment method updated
  'customer.updated': handleCustomerUpdated,

  // Refund issued
  'charge.refunded': handleRefund,

  // Dispute created
  'charge.dispute.created': handleDisputeCreated,
};
```

---

## Customer Portal

**Allow users to manage subscriptions via Stripe Customer Portal:**

**Frontend:**
```typescript
// User clicks "Manage Billing" in settings
const response = await fetch('/stripe/create-portal-session', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` }
});

const { url } = await response.json();
window.location.href = url;
```

**Backend (`POST /stripe/create-portal-session`):**

```typescript
// 1. Get user's Stripe customer ID
const subscription = await db.userProducts.findOne({
  userId: user.id,
  status: 'active'
});

const stripeSubscription = await stripe.subscriptions.retrieve(
  subscription.stripeSubscriptionId
);

const customerId = stripeSubscription.customer;

// 2. Create portal session
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${process.env.APP_URL}/settings/subscription`
});

return { url: session.url };
```

**What users can do in portal:**
- Update payment method
- View invoices
- Cancel subscription
- Update billing info

---

## Testing

### Stripe Test Mode

**Test Cards:**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires SCA: 4000 0025 0000 3155
```

### Webhook Testing (Local Development)

**Install Stripe CLI:**
```bash
stripe login
stripe listen --forward-to http://localhost:3000/stripe/webhook
```

**Trigger test events:**
```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

---

## Security Considerations

1. **Webhook signature verification** - Always verify Stripe signatures
2. **Idempotency** - Handle duplicate webhooks gracefully
3. **Metadata validation** - Validate all metadata from Stripe events
4. **Customer ID verification** - Ensure customer belongs to user making request

---

## Next Steps

See:
- **ROADMAPS_ADMIN_DASHBOARD.md** for managing payments/subscriptions in admin interface
- **ROADMAPS_DEPLOYMENT.md** for setting up Stripe in production

---

**Last Updated:** 2026-03-20
