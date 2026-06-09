/**
 * Fix Missing Stripe Customer ID
 *
 * This script finds users who have active subscriptions but are missing
 * their stripe_customer_id in the database, then populates it from Stripe.
 */

import pg from 'pg';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-09-30.acacia',
});

async function fixMissingCustomerIds() {
  const client = await pool.connect();

  try {
    console.log('🔍 Finding users with missing stripe_customer_id...\n');

    // Find users who have active subscriptions but no stripe_customer_id
    const result = await client.query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, up.stripe_subscription_id
      FROM users u
      JOIN user_products up ON u.id = up.user_id
      WHERE u.stripe_customer_id IS NULL
        AND up.stripe_subscription_id IS NOT NULL
        AND up.status IN ('trialing', 'active', 'paused')
      ORDER BY u.email
    `);

    if (result.rows.length === 0) {
      console.log('✅ No users found with missing stripe_customer_id');
      return;
    }

    console.log(`Found ${result.rows.length} user(s) with missing stripe_customer_id:\n`);

    for (const user of result.rows) {
      console.log(`👤 User: ${user.email} (${user.first_name} ${user.last_name})`);
      console.log(`   Database ID: ${user.id}`);
      console.log(`   Stripe Subscription ID: ${user.stripe_subscription_id}`);

      try {
        // Get subscription from Stripe to find customer ID
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

        console.log(`   ✅ Found Stripe Customer ID: ${customerId}`);

        // Update database
        await client.query(
          `UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
          [customerId, user.id]
        );

        console.log(`   ✅ Updated database with customer ID`);

        // Verify payment method exists
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          console.log(`   ⚠️  Warning: Customer is deleted in Stripe`);
        } else {
          const defaultPM = customer.invoice_settings?.default_payment_method;
          if (defaultPM) {
            console.log(`   ✅ Has payment method: ${defaultPM}`);
          } else {
            console.log(`   ⚠️  No default payment method found`);
          }
        }

      } catch (error) {
        console.error(`   ❌ Error processing user: ${error.message}`);
      }

      console.log(''); // Blank line between users
    }

    console.log('🎉 Completed fixing missing customer IDs');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMissingCustomerIds();
