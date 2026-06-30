/**
 * Create a test subscription for development/testing
 */
import { config } from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
config();

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

async function createTestSubscription() {
  try {
    console.log('🔍 Finding products...');
    const productsResult = await pool.query('SELECT id, name, slug FROM products');
    console.log('Available products:', productsResult.rows);

    console.log('\n🔍 Finding users...');
    const usersResult = await pool.query('SELECT id, email, first_name FROM users ORDER BY created_at DESC LIMIT 5');
    console.log('Recent users:', usersResult.rows);

    if (usersResult.rows.length === 0) {
      console.log('❌ No users found');
      process.exit(1);
    }

    const user = usersResult.rows[0];
    const cpgProduct = productsResult.rows.find(p => p.slug === 'cpu-cpg-calculator');

    if (!cpgProduct) {
      console.log('❌ CPG product not found');
      process.exit(1);
    }

    console.log(`\n✨ Creating active subscription for ${user.email}...`);
    console.log(`   Product: ${cpgProduct.name}`);

    // Check if subscription already exists
    const existingResult = await pool.query(
      'SELECT id, status FROM user_products WHERE user_id = $1 AND product_id = $2',
      [user.id, cpgProduct.id]
    );

    if (existingResult.rows.length > 0) {
      console.log(`\n⚠️  Subscription already exists with status: ${existingResult.rows[0].status}`);
      console.log('   Updating to active...');
      
      await pool.query(
        `UPDATE user_products 
         SET status = 'active',
             trial_ends_at = NULL,
             trial_converted = true,
             activated_at = NOW(),
             paused_at = NULL,
             resumed_at = NULL,
             grace_period_ends_at = NULL,
             updated_at = NOW()
         WHERE user_id = $1 AND product_id = $2`,
        [user.id, cpgProduct.id]
      );
      
      console.log('✅ Subscription updated to active');
    } else {
      await pool.query(
        `INSERT INTO user_products (
          id, user_id, product_id, device_id, status,
          trial_ends_at, trial_converted, activated_at,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'test-device', 'active',
          NULL, true, NOW(),
          NOW(), NOW()
        )`,
        [user.id, cpgProduct.id]
      );
      
      console.log('✅ Subscription created successfully');
    }

    console.log('\n📊 Subscription Details:');
    const finalResult = await pool.query(
      `SELECT up.*, p.name as product_name 
       FROM user_products up 
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1 AND up.product_id = $2`,
      [user.id, cpgProduct.id]
    );
    console.log(finalResult.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestSubscription();
