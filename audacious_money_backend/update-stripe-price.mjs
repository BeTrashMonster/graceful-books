/**
 * Update Stripe Price ID for a product
 *
 * Updates the stripe_price_id for a product in the database
 * Uses environment variables from .env file
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function updateStripePrice(productSlug, newPriceId) {
  console.log(`🔧 Updating Stripe price ID for ${productSlug}...\n`);

  try {
    // Show current value
    const current = await pool.query(
      'SELECT id, name, slug, stripe_price_id FROM products WHERE slug = $1',
      [productSlug]
    );

    if (current.rowCount === 0) {
      console.log(`❌ Product not found: ${productSlug}`);
      return;
    }

    console.log('📊 Current product:');
    console.log(`   Name: ${current.rows[0].name}`);
    console.log(`   Slug: ${current.rows[0].slug}`);
    console.log(`   Old Price ID: ${current.rows[0].stripe_price_id || '(none)'}`);
    console.log(`   New Price ID: ${newPriceId}\n`);

    // Update the price ID
    await pool.query(
      'UPDATE products SET stripe_price_id = $1 WHERE slug = $2',
      [newPriceId, productSlug]
    );

    console.log('✅ Price ID updated successfully!\n');

    // Verify the update
    const updated = await pool.query(
      'SELECT stripe_price_id FROM products WHERE slug = $1',
      [productSlug]
    );
    console.log(`📋 Verified: ${updated.rows[0].stripe_price_id}`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const productSlug = process.argv[2] || 'cpu-cpg-calculator';
const newPriceId = process.argv[3];

if (!newPriceId) {
  console.log('Usage: node update-stripe-price.mjs <product-slug> <stripe-price-id>');
  console.log('Example: node update-stripe-price.mjs cpu-cpg-calculator price_1ABC123TEST456\n');
  process.exit(1);
}

updateStripePrice(productSlug, newPriceId).catch(console.error);
