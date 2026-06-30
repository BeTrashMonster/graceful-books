/**
 * Fix audreyanne614@gmail.com status to reflect actual Stripe subscription status
 */
import pg from 'pg';
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-09-30.acacia',
});

const client = await pool.connect();
try {
  console.log('🔍 Fetching audreyanne614@gmail.com subscription details...\n');

  // Get the user_product record
  const result = await client.query(`
    SELECT
      up.stripe_subscription_id,
      up.status as current_status,
      u.email
    FROM user_products up
    JOIN users u ON u.id = up.user_id
    WHERE u.email = 'audreyanne614@gmail.com'
  `);

  if (result.rows.length === 0) {
    console.log('❌ No user_product found for audreyanne614@gmail.com');
    process.exit(0);
  }

  const record = result.rows[0];
  console.log(`Current database status: ${record.current_status}`);
  console.log(`Stripe Subscription ID: ${record.stripe_subscription_id}\n`);

  if (!record.stripe_subscription_id) {
    console.log('❌ No Stripe subscription ID found');
    process.exit(0);
  }

  // Fetch actual status from Stripe
  console.log('Fetching subscription from Stripe...');
  const subscription = await stripe.subscriptions.retrieve(record.stripe_subscription_id);

  console.log(`\nStripe subscription status: ${subscription.status}`);
  console.log(`Trial end: ${subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : 'N/A'}`);
  console.log(`Current period: ${new Date(subscription.current_period_start * 1000).toISOString()} → ${new Date(subscription.current_period_end * 1000).toISOString()}`);

  // Update database
  console.log('\n📝 Updating database...');
  await client.query(`
    UPDATE user_products
    SET status = $1,
        current_period_start = to_timestamp($2),
        current_period_end = to_timestamp($3),
        updated_at = NOW()
    WHERE stripe_subscription_id = $4
  `, [subscription.status, subscription.current_period_start, subscription.current_period_end, subscription.id]);

  console.log('✅ Updated successfully!');
  console.log(`\nNew status: ${subscription.status}`);

} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  client.release();
  await pool.end();
}
