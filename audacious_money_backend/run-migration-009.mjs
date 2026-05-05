import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
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

const client = await pool.connect();
try {
  console.log('🚀 Running Migration 009: Update status constraint\n');

  // Drop old constraint
  console.log('Dropping old constraint...');
  await client.query('ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_status_check');

  // Add new constraint
  console.log('Adding new constraint with Stripe statuses...');
  await client.query(`
    ALTER TABLE user_products ADD CONSTRAINT user_products_status_check
      CHECK (status IN (
        'trial',
        'trialing',
        'active',
        'past_due',
        'paused',
        'cancelled',
        'canceled',
        'expired',
        'payment_failed',
        'incomplete',
        'incomplete_expired',
        'unpaid'
      ))
  `);

  // Update existing records
  console.log('Updating existing trial records...');
  const result = await client.query("UPDATE user_products SET status = 'trialing' WHERE status = 'trial'");
  console.log(`Updated ${result.rowCount} records`);

  console.log('\n✅ Migration 009 completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  throw error;
} finally {
  client.release();
  await pool.end();
}
