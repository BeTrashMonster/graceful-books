/**
 * Stripe Integration Verification Script
 *
 * Verifies Stripe configuration is correct for production deployment
 * Usage: bun run scripts/verify-stripe-integration.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

interface VerificationResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Verify environment variables are set
 */
function verifyEnvironmentVariables(): VerificationResult[] {
  const results: VerificationResult[] = [];

  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      results.push({
        success: false,
        message: `❌ ${varName} not set in environment`,
      });
    } else {
      results.push({
        success: true,
        message: `✅ ${varName} is set`,
      });
    }
  }

  return results;
}

/**
 * Verify Stripe API key format
 */
function verifyApiKeyFormat(): VerificationResult {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      message: '❌ STRIPE_SECRET_KEY not found',
    };
  }

  // Check key format
  const isTestKey = secretKey.startsWith('sk_test_');
  const isLiveKey = secretKey.startsWith('sk_live_');

  if (!isTestKey && !isLiveKey) {
    return {
      success: false,
      message: '❌ STRIPE_SECRET_KEY has invalid format (should start with sk_test_ or sk_live_)',
    };
  }

  // Check environment matches key
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction && !isLiveKey) {
    return {
      success: false,
      message: '❌ Production environment MUST use live Stripe key (sk_live_)',
      details: { currentKey: secretKey.substring(0, 10) + '...' },
    };
  }

  if (isProduction && isLiveKey) {
    return {
      success: true,
      message: '✅ Using live Stripe key in production',
    };
  }

  if (!isProduction && isTestKey) {
    return {
      success: true,
      message: '✅ Using test Stripe key in development',
    };
  }

  return {
    success: true,
    message: `⚠️  Using ${isLiveKey ? 'live' : 'test'} key in ${nodeEnv} environment`,
    details: { warning: 'Key type does not match environment' },
  };
}

/**
 * Verify webhook secret format
 */
function verifyWebhookSecretFormat(): VerificationResult {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return {
      success: false,
      message: '❌ STRIPE_WEBHOOK_SECRET not found',
    };
  }

  if (!webhookSecret.startsWith('whsec_')) {
    return {
      success: false,
      message: '❌ STRIPE_WEBHOOK_SECRET has invalid format (should start with whsec_)',
    };
  }

  return {
    success: true,
    message: '✅ Webhook secret format is valid',
  };
}

/**
 * Test Stripe API connection
 */
async function testStripeConnection(): Promise<VerificationResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      message: '❌ Cannot test connection - STRIPE_SECRET_KEY not set',
    };
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    // Test API connection by retrieving account
    const account = await stripe.accounts.retrieve();

    return {
      success: true,
      message: `✅ Connected to Stripe account: ${account.business_profile?.name || account.id}`,
      details: {
        accountId: account.id,
        accountName: account.business_profile?.name,
        country: account.country,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: '❌ Failed to connect to Stripe',
      details: {
        error: error.message,
        type: error.type,
      },
    };
  }
}

/**
 * List products and prices
 */
async function listProductsAndPrices(): Promise<VerificationResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      message: '❌ Cannot list products - STRIPE_SECRET_KEY not set',
    };
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    const products = await stripe.products.list({ limit: 100 });
    const prices = await stripe.prices.list({ limit: 100 });

    const productDetails = products.data.map((product) => ({
      id: product.id,
      name: product.name,
      active: product.active,
    }));

    const priceDetails = prices.data.map((price) => ({
      id: price.id,
      product: price.product,
      amount: price.unit_amount,
      currency: price.currency,
      recurring: price.recurring?.interval,
    }));

    return {
      success: true,
      message: `✅ Found ${products.data.length} products and ${prices.data.length} prices`,
      details: {
        products: productDetails,
        prices: priceDetails,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: '❌ Failed to list products',
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Check webhook endpoints (production only)
 */
async function checkWebhookEndpoints(): Promise<VerificationResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false,
      message: '❌ Cannot check webhooks - STRIPE_SECRET_KEY not set',
    };
  }

  if (!secretKey.startsWith('sk_live_')) {
    return {
      success: true,
      message: '⚠️  Skipping webhook check (test mode - configure webhooks manually)',
    };
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    const webhooks = await stripe.webhookEndpoints.list();

    if (webhooks.data.length === 0) {
      return {
        success: false,
        message: '⚠️  No webhook endpoints configured',
        details: {
          warning: 'You need to configure webhooks in Stripe Dashboard (Task 6.3)',
        },
      };
    }

    // Check for production webhook
    const prodWebhook = webhooks.data.find((wh) =>
      wh.url.includes('api.audacious.money')
    );

    if (!prodWebhook) {
      return {
        success: false,
        message: '⚠️  Production webhook not found',
        details: {
          existingWebhooks: webhooks.data.map((wh) => wh.url),
          expected: 'https://api.audacious.money/stripe/webhook',
        },
      };
    }

    // Verify events are configured
    const requiredEvents = [
      'checkout.session.completed',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
    ];

    const configuredEvents = prodWebhook.enabled_events;
    const missingEvents = requiredEvents.filter(
      (event) => !configuredEvents.includes(event as any)
    );

    if (missingEvents.length > 0) {
      return {
        success: false,
        message: '⚠️  Some required webhook events are missing',
        details: {
          webhookUrl: prodWebhook.url,
          missingEvents,
          configuredEvents,
        },
      };
    }

    return {
      success: true,
      message: `✅ Production webhook configured: ${prodWebhook.url}`,
      details: {
        webhookId: prodWebhook.id,
        url: prodWebhook.url,
        status: prodWebhook.status,
        events: configuredEvents.length,
        apiVersion: prodWebhook.api_version,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: '❌ Failed to check webhooks',
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Main verification function
 */
async function verifyStripeIntegration() {
  console.log('🔍 Verifying Stripe Integration');
  console.log('================================\n');

  // Step 1: Environment Variables
  console.log('1️⃣  Environment Variables');
  console.log('   ----------------------');
  const envResults = verifyEnvironmentVariables();
  envResults.forEach((result) => console.log(`   ${result.message}`));
  console.log('');

  // Step 2: API Key Format
  console.log('2️⃣  API Key Format');
  console.log('   ---------------');
  const keyFormatResult = verifyApiKeyFormat();
  console.log(`   ${keyFormatResult.message}`);
  if (keyFormatResult.details) {
    console.log(`   Details:`, keyFormatResult.details);
  }
  console.log('');

  // Step 3: Webhook Secret Format
  console.log('3️⃣  Webhook Secret Format');
  console.log('   ----------------------');
  const webhookFormatResult = verifyWebhookSecretFormat();
  console.log(`   ${webhookFormatResult.message}`);
  console.log('');

  // Step 4: Test API Connection
  console.log('4️⃣  Stripe API Connection');
  console.log('   ----------------------');
  const connectionResult = await testStripeConnection();
  console.log(`   ${connectionResult.message}`);
  if (connectionResult.details) {
    console.log(`   Account ID: ${connectionResult.details.accountId}`);
    console.log(`   Country: ${connectionResult.details.country}`);
    console.log(
      `   Charges Enabled: ${connectionResult.details.chargesEnabled}`
    );
    console.log(
      `   Payouts Enabled: ${connectionResult.details.payoutsEnabled}`
    );
  }
  console.log('');

  // Step 5: Products and Prices
  console.log('5️⃣  Products and Prices');
  console.log('   --------------------');
  const productsResult = await listProductsAndPrices();
  console.log(`   ${productsResult.message}`);
  if (productsResult.details) {
    console.log(`   Products:`);
    productsResult.details.products.forEach((product: any) => {
      console.log(
        `     - ${product.name} (${product.id}) [${product.active ? 'Active' : 'Inactive'}]`
      );
    });
    console.log(`   Prices:`);
    productsResult.details.prices.slice(0, 5).forEach((price: any) => {
      const amount = price.amount ? `$${price.amount / 100}` : 'Free';
      const recurring = price.recurring ? `/${price.recurring}` : '';
      console.log(`     - ${amount}${recurring} (${price.id})`);
    });
    if (productsResult.details.prices.length > 5) {
      console.log(
        `     ... and ${productsResult.details.prices.length - 5} more`
      );
    }
  }
  console.log('');

  // Step 6: Webhook Endpoints
  console.log('6️⃣  Webhook Endpoints');
  console.log('   ------------------');
  const webhookResult = await checkWebhookEndpoints();
  console.log(`   ${webhookResult.message}`);
  if (webhookResult.details) {
    if (webhookResult.details.webhookId) {
      console.log(`   Webhook ID: ${webhookResult.details.webhookId}`);
      console.log(`   URL: ${webhookResult.details.url}`);
      console.log(`   Status: ${webhookResult.details.status}`);
      console.log(`   Events: ${webhookResult.details.events}`);
      console.log(`   API Version: ${webhookResult.details.apiVersion}`);
    } else if (webhookResult.details.missingEvents) {
      console.log(`   Missing Events:`, webhookResult.details.missingEvents);
    } else if (webhookResult.details.warning) {
      console.log(`   Warning: ${webhookResult.details.warning}`);
    }
  }
  console.log('');

  // Summary
  console.log('================================');
  const allResults = [
    ...envResults,
    keyFormatResult,
    webhookFormatResult,
    connectionResult,
    productsResult,
    webhookResult,
  ];

  const successCount = allResults.filter((r) => r.success).length;
  const totalCount = allResults.length;

  if (successCount === totalCount) {
    console.log('✅ Stripe integration verified successfully!');
    console.log('   All checks passed.');
    process.exit(0);
  } else {
    console.log(
      `⚠️  Stripe integration has issues (${successCount}/${totalCount} checks passed)`
    );
    console.log('   Review the errors above and fix before deploying.');
    process.exit(1);
  }
}

// Run verification
verifyStripeIntegration().catch((error) => {
  console.error('❌ Verification failed with error:', error.message);
  process.exit(1);
});
