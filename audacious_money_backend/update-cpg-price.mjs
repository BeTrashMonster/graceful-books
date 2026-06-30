/**
 * Update CPG Tool static price to $20/month
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateCpgPrice() {
  const client = await pool.connect();

  try {
    console.log('Updating CPG Tool price to $20/month...');

    // Check current value
    const current = await client.query(
      `SELECT id, name, slug, price_monthly FROM products WHERE slug = 'cpu-cpg-calculator'`
    );

    if (current.rows.length === 0) {
      console.error('❌ CPG Tool product not found in database');
      return;
    }

    console.log('Current price:', current.rows[0].price_monthly);

    // Update to $20
    const result = await client.query(
      `UPDATE products SET price_monthly = 20 WHERE slug = 'cpu-cpg-calculator' RETURNING id, name, price_monthly`
    );

    console.log('✅ Updated successfully:', result.rows[0]);
    console.log(`   ${result.rows[0].name}: $${result.rows[0].price_monthly}/month`);

  } catch (error) {
    console.error('❌ Error updating price:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateCpgPrice();
