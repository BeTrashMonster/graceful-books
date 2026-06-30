/**
 * Check subscription IDs in database
 *
 * Run with: node check-subscription-ids.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSubscriptionIds() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking subscription IDs for Audrey accounts...\n');

    const result = await client.query(`
      SELECT
        up.id,
        up.user_id,
        up.product_id,
        up.stripe_subscription_id,
        up.stripe_customer_id,
        up.status,
        up.created_at,
        u.email
      FROM user_products up
      JOIN users u ON u.id = up.user_id
      WHERE u.email LIKE '%audrey%'
      ORDER BY up.created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ No user_products records found for Audrey accounts');
      return;
    }

    console.log(`Found ${result.rows.length} record(s):\n`);

    result.rows.forEach((row, index) => {
      console.log(`--- Record ${index + 1} ---`);
      console.log(`Email: ${row.email}`);
      console.log(`User ID: ${row.user_id}`);
      console.log(`Product ID: ${row.product_id}`);
      console.log(`Status: ${row.status}`);
      console.log(`Stripe Subscription ID: ${row.stripe_subscription_id || '❌ NULL (NOT SET!)'}`);
      console.log(`Stripe Customer ID: ${row.stripe_customer_id || '❌ NULL'}`);
      console.log(`Created: ${row.created_at}`);
      console.log('');
    });

    // Summary
    const withSubscriptionId = result.rows.filter(r => r.stripe_subscription_id).length;
    const withoutSubscriptionId = result.rows.filter(r => !r.stripe_subscription_id).length;

    console.log('📊 Summary:');
    console.log(`   ✅ With subscription ID: ${withSubscriptionId}`);
    console.log(`   ❌ Without subscription ID: ${withoutSubscriptionId}`);

    if (withoutSubscriptionId > 0) {
      console.log('\n⚠️  WARNING: Some records are missing stripe_subscription_id!');
      console.log('   This means the webhook did not save the subscription ID.');
      console.log('   Users with missing IDs will NOT have subscriptions cancelled when deleted.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSubscriptionIds();
