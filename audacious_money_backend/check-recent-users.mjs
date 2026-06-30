import pg from 'pg';
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

const client = await pool.connect();
try {
  console.log('🔍 Most Recent Users:\n');

  const users = await client.query(`
    SELECT email, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
  `);

  users.rows.forEach(row => {
    console.log(`${row.email} - ${row.created_at}`);
  });

  console.log('\n🔍 Most Recent User Products:\n');

  const products = await client.query(`
    SELECT
      u.email,
      up.status,
      up.stripe_subscription_id,
      up.current_period_end,
      up.created_at
    FROM user_products up
    JOIN users u ON u.id = up.user_id
    ORDER BY up.created_at DESC
    LIMIT 10
  `);

  products.rows.forEach(row => {
    console.log(`Email: ${row.email}`);
    console.log(`Status: ${row.status}`);
    console.log(`Stripe Sub ID: ${row.stripe_subscription_id || 'NULL'}`);
    console.log(`Created: ${row.created_at}`);
    console.log('---');
  });
} finally {
  client.release();
  await pool.end();
}
