/**
 * Update Stripe Product/Price IDs in Database
 *
 * Usage: bun run scripts/update-stripe-product-id.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

async function updateStripeProductId() {
  const client = await pool.connect();

  try {
    console.log('🔄 Connecting to database...');

    // First, show current state
    console.log('\n📋 Current product state:');
    const beforeResult = await client.query(
      'SELECT id, slug, name, price_monthly, stripe_price_id FROM products WHERE slug = $1',
      ['cpu-cpg-calculator']
    );
    console.table(beforeResult.rows);

    if (beforeResult.rows.length === 0) {
      console.error('❌ ERROR: Product with slug "cpu-cpg-calculator" not found in database');
      return;
    }

    // Update the stripe_price_id
    console.log('\n🔄 Updating Stripe Price ID...');
    const updateResult = await client.query(
      `UPDATE products
       SET stripe_price_id = $1, updated_at = NOW()
       WHERE slug = $2
       RETURNING id, slug, name, stripe_price_id`,
      ['price_1TTGwPDAS9U3cd2IJj6TtyM7', 'cpu-cpg-calculator']
    );

    if (updateResult.rowCount === 0) {
      console.error('❌ ERROR: No rows were updated');
      return;
    }

    console.log('✅ Successfully updated!');
    console.log('\n📋 Updated product state:');
    console.table(updateResult.rows);

    console.log('\n✨ Done! Your CPU/CPG Calculator product is now linked to Stripe.');
    console.log('   Product ID: prod_USBJJO9wbpzzE7');
    console.log('   Price ID: price_1TTGwPDAS9U3cd2IJj6TtyM7');

  } catch (error) {
    console.error('❌ Error updating database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateStripeProductId()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
