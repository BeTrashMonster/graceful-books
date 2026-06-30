/**
 * ONE-TIME SCRIPT: Update CPU/CPG Calculator Stripe Price ID
 *
 * Run with: node update-stripe-cpu-cpg.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

async function updateStripePriceId() {
  const client = await pool.connect();

  try {
    console.log('\n🔄 Connecting to production database...\n');

    // Show current state
    console.log('📋 BEFORE UPDATE:');
    const beforeResult = await client.query(
      'SELECT id, slug, name, price_monthly, stripe_price_id FROM products WHERE slug = $1',
      ['cpu-cpg-calculator']
    );

    if (beforeResult.rows.length === 0) {
      console.error('❌ ERROR: Product "cpu-cpg-calculator" not found in database');
      console.error('Available products:');
      const allProducts = await client.query('SELECT slug, name FROM products ORDER BY name');
      console.table(allProducts.rows);
      return;
    }

    console.table(beforeResult.rows);

    // Update the Stripe price ID
    console.log('\n🔄 Updating Stripe Price ID...\n');
    const updateResult = await client.query(
      `UPDATE products
       SET stripe_price_id = $1, updated_at = NOW()
       WHERE slug = $2
       RETURNING id, slug, name, price_monthly, stripe_price_id, updated_at`,
      ['price_1TTGwPDAS9U3cd2IJj6TtyM7', 'cpu-cpg-calculator']
    );

    if (updateResult.rowCount === 0) {
      console.error('❌ ERROR: No rows were updated');
      return;
    }

    console.log('✅ UPDATE SUCCESSFUL!\n');
    console.log('📋 AFTER UPDATE:');
    console.table(updateResult.rows);

    console.log('\n✨ Done! Your CPU/CPG Calculator is now connected to Stripe.');
    console.log('   Stripe Product ID: prod_USBJJO9wbpzzE7');
    console.log('   Stripe Price ID: price_1TTGwPDAS9U3cd2IJj6TtyM7\n');

  } catch (error) {
    console.error('\n❌ DATABASE ERROR:', error.message);
    console.error('\nFull error details:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  STRIPE PRODUCT ID UPDATER');
console.log('  Product: CPU/CPG Calculator ([AM] Product Costing Tool)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

updateStripePriceId()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
