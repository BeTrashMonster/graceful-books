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
  console.log('🔍 Checking user_products status and email verification...\n');

  const result = await client.query(`
    SELECT
      u.email,
      u.email_verified,
      up.status,
      up.stripe_subscription_id,
      up.current_period_end
    FROM user_products up
    JOIN users u ON u.id = up.user_id
    ORDER BY up.created_at DESC
    LIMIT 5
  `);

  console.log('User Products Status:');
  result.rows.forEach(row => {
    console.log(`Email: ${row.email}`);
    console.log(`Email Verified: ${row.email_verified}`);
    console.log(`Product Status: ${row.status}`);
    console.log(`Subscription ID: ${row.stripe_subscription_id}`);
    console.log(`Period End: ${row.current_period_end}`);
    console.log('---');
  });
} finally {
  client.release();
  await pool.end();
}
