import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

try {
  await client.connect();

  // Get user ID
  const userResult = await client.query(
    'SELECT id, email FROM users WHERE email = $1',
    ['audreyheesch614@gmail.com']
  );

  if (userResult.rows.length === 0) {
    console.log('User not found');
    process.exit(1);
  }

  const user = userResult.rows[0];
  console.log(`Found user: ${user.email} (${user.id})`);

  // Get CPG product ID
  const productResult = await client.query(
    'SELECT id, name, slug FROM products WHERE slug = $1',
    ['cpu-cpg-calculator']
  );

  if (productResult.rows.length === 0) {
    console.log('CPG product not found');
    process.exit(1);
  }

  const product = productResult.rows[0];
  console.log(`Found product: ${product.name} (${product.id})`);

  // Check if already assigned
  const existingResult = await client.query(
    'SELECT id FROM user_products WHERE user_id = $1 AND product_id = $2',
    [user.id, product.id]
  );

  if (existingResult.rows.length > 0) {
    console.log('Product already assigned to user');
    process.exit(0);
  }

  // Assign product
  await client.query(
    `INSERT INTO user_products (user_id, product_id, status, activated_at)
     VALUES ($1, $2, 'active', NOW())`,
    [user.id, product.id]
  );

  console.log(`✅ Successfully assigned ${product.name} to ${user.email}`);

  await client.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
