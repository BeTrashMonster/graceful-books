/**
 * Check what products a user has access to
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

async function checkUserProducts(email) {
  try {
    // Get user
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rowCount === 0) {
      console.log(`No user found with email: ${email}`);
      return;
    }

    const user = userResult.rows[0];
    console.log('\n=== User Info ===');
    console.log(`Name: ${user.first_name} ${user.last_name}`);
    console.log(`Email: ${user.email}`);
    console.log(`ID: ${user.id}`);

    // Get user's products
    const productsResult = await pool.query(
      `SELECT up.*, p.name, p.slug, p.description
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.created_at DESC`,
      [user.id]
    );

    console.log('\n=== User Products ===');
    console.log(`Found ${productsResult.rowCount} product(s)\n`);

    if (productsResult.rowCount === 0) {
      console.log('User has no products assigned.');
    } else {
      productsResult.rows.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (${product.slug})`);
        console.log(`   Status: ${product.status}`);
        console.log(`   Activated: ${product.activated_at}`);
        console.log(`   Stripe Subscription: ${product.stripe_subscription_id || 'None'}`);
        console.log('');
      });
    }

    // Also list all available products
    const allProductsResult = await pool.query(
      'SELECT id, name, slug, active FROM products ORDER BY name'
    );

    console.log('=== All Available Products ===');
    allProductsResult.rows.forEach((product) => {
      console.log(`- ${product.name} (${product.slug}) - ${product.active ? 'Active' : 'Inactive'}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node check-user-products.mjs <email>');
  process.exit(1);
}

checkUserProducts(email);
