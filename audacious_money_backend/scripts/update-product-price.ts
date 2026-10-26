/**
 * Update Product Price in Database
 *
 * Updates the price_monthly for a product.
 *
 * Usage: npx ts-node scripts/update-product-price.ts
 *    or: bun run scripts/update-product-price.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ============================================================
// CONFIGURATION - Edit these values
// ============================================================
const PRODUCT_SLUG = 'cpu-cpg-calculator';  // The product to update
const NEW_PRICE_MONTHLY = 20;               // New price in dollars
// ============================================================

async function updateProductPrice() {
  const client = await pool.connect();

  try {
    console.log('Connecting to database...');

    // First, show current state
    console.log('\nCurrent product state:');
    const beforeResult = await client.query(
      'SELECT id, slug, name, price_monthly, price_annual FROM products WHERE slug = $1',
      [PRODUCT_SLUG]
    );

    if (beforeResult.rows.length === 0) {
      console.error(`ERROR: Product with slug "${PRODUCT_SLUG}" not found in database`);
      console.log('\nAvailable products:');
      const allProducts = await client.query('SELECT slug, name, price_monthly FROM products');
      console.table(allProducts.rows);
      return;
    }

    console.table(beforeResult.rows);

    const currentPrice = beforeResult.rows[0].price_monthly;
    console.log(`\nUpdating price from $${currentPrice} to $${NEW_PRICE_MONTHLY}...`);

    // Update the price
    const updateResult = await client.query(
      `UPDATE products
       SET price_monthly = $1, updated_at = NOW()
       WHERE slug = $2
       RETURNING id, slug, name, price_monthly, price_annual`,
      [NEW_PRICE_MONTHLY, PRODUCT_SLUG]
    );

    if (updateResult.rowCount === 0) {
      console.error('ERROR: No rows were updated');
      return;
    }

    console.log('\nSuccessfully updated!');
    console.log('\nUpdated product state:');
    console.table(updateResult.rows);

    console.log(`\nDone! Price for "${PRODUCT_SLUG}" is now $${NEW_PRICE_MONTHLY}/month.`);

  } catch (error) {
    console.error('Error updating database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateProductPrice()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
