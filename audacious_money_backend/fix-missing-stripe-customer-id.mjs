/**
 * MIGRATION: Backfill Missing Stripe Customer IDs in Users Table
 *
 * ROOT CAUSE: Webhook handler was only setting stripe_customer_id in user_products table,
 * but payment/invoice endpoints query the users table.
 *
 * This one-time migration backfills existing users who are missing the customer ID
 * in the users table but have it in user_products (from their active subscription).
 *
 * RUN ONCE: After deploying the webhook fix, run this script once to fix existing data.
 * Future subscriptions will work correctly due to the webhook handler fix.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function backfillStripeCustomerIds() {
  const client = await pool.connect();

  try {
    console.log('🔍 Finding users with missing stripe_customer_id in users table...\n');

    // Find users where:
    // - users.stripe_customer_id is NULL
    // - user_products.stripe_customer_id is NOT NULL (they have a subscription)
    // - Subscription is active
    const result = await client.query(`
      SELECT
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        up.stripe_customer_id,
        up.stripe_subscription_id,
        up.status
      FROM users u
      JOIN user_products up ON u.id = up.user_id
      WHERE u.stripe_customer_id IS NULL
        AND up.stripe_customer_id IS NOT NULL
        AND up.status IN ('trialing', 'active', 'paused')
      ORDER BY u.email
    `);

    if (result.rows.length === 0) {
      console.log('✅ No users found needing backfill');
      console.log('   All users have stripe_customer_id properly set in users table\n');
      return;
    }

    console.log(`Found ${result.rows.length} user(s) needing backfill:\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of result.rows) {
      console.log(`👤 User: ${row.email} (${row.first_name} ${row.last_name})`);
      console.log(`   Database ID: ${row.user_id}`);
      console.log(`   Stripe Customer ID: ${row.stripe_customer_id}`);
      console.log(`   Subscription Status: ${row.status}`);

      try {
        // Copy stripe_customer_id from user_products to users table
        await client.query(
          `UPDATE users
           SET stripe_customer_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [row.stripe_customer_id, row.user_id]
        );

        console.log(`   ✅ Backfilled stripe_customer_id to users table`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error updating user: ${error.message}`);
        errorCount++;
      }

      console.log(''); // Blank line between users
    }

    console.log('━'.repeat(60));
    console.log(`\n🎉 Backfill Complete!`);
    console.log(`   ✅ Successfully updated: ${successCount} user(s)`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} user(s)`);
    }
    console.log('');
    console.log('✨ Future subscriptions will automatically populate stripe_customer_id');
    console.log('   in the users table via the updated webhook handler.\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillStripeCustomerIds();
