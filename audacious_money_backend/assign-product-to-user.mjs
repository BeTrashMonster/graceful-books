/**
 * Manually assign a product to a user
 * Usage: node assign-product-to-user.mjs <user_email> <product_slug>
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

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

async function assignProduct(email, productSlug) {
  try {
    // Get user
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rowCount === 0) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    const user = userResult.rows[0];
    console.log(`\n✓ Found user: ${user.first_name} ${user.last_name} (${user.email})`);

    // Get product
    const productResult = await pool.query(
      'SELECT id, name, slug FROM products WHERE slug = $1',
      [productSlug]
    );

    if (productResult.rowCount === 0) {
      console.log(`❌ No product found with slug: ${productSlug}`);
      console.log('\nAvailable products:');
      const allProducts = await pool.query('SELECT name, slug FROM products WHERE active = true ORDER BY name');
      allProducts.rows.forEach((p) => console.log(`  - ${p.name} (${p.slug})`));
      return;
    }

    const product = productResult.rows[0];
    console.log(`✓ Found product: ${product.name} (${product.slug})`);

    // Check if already assigned
    const existingResult = await pool.query(
      'SELECT id, status FROM user_products WHERE user_id = $1 AND product_id = $2',
      [user.id, product.id]
    );

    if (existingResult.rowCount > 0) {
      console.log(`\n⚠️  User already has this product (status: ${existingResult.rows[0].status})`);
      console.log('Updating to active status...');

      await pool.query(
        `UPDATE user_products
         SET status = 'active',
             activated_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1 AND product_id = $2`,
        [user.id, product.id]
      );

      console.log('✓ Product status updated to active');
    } else {
      console.log('\nAssigning product to user...');

      await pool.query(
        `INSERT INTO user_products (user_id, product_id, status, activated_at)
         VALUES ($1, $2, 'active', NOW())`,
        [user.id, product.id]
      );

      console.log('✓ Product assigned successfully!');
    }

    // Show user's current products
    console.log('\n=== User\'s Current Products ===');
    const productsResult = await pool.query(
      `SELECT p.name, p.slug, up.status, up.activated_at
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.activated_at DESC`,
      [user.id]
    );

    productsResult.rows.forEach((p, index) => {
      console.log(`${index + 1}. ${p.name} (${p.slug}) - Status: ${p.status}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const email = process.argv[2];
const productSlug = process.argv[3];

if (!email || !productSlug) {
  console.log('Usage: node assign-product-to-user.mjs <user_email> <product_slug>');
  console.log('\nExample:');
  console.log('  node assign-product-to-user.mjs user@example.com cpu-cpg-calculator');
  console.log('  node assign-product-to-user.mjs user@example.com bookkeeping-suite');
  process.exit(1);
}

assignProduct(email, productSlug);
