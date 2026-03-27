import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

try {
  await client.connect();
  const result = await client.query('SELECT id, name, slug, stripe_price_id, price_monthly, active FROM products ORDER BY name');

  console.log('Current Products in Database:');
  console.log('='.repeat(100));
  result.rows.forEach(row => {
    console.log(`Name: ${row.name}`);
    console.log(`  Slug: ${row.slug}`);
    console.log(`  Price ID: ${row.stripe_price_id || 'NULL'}`);
    console.log(`  Monthly Price: $${row.price_monthly}`);
    console.log(`  Active: ${row.active}`);
    console.log(`  ID: ${row.id}`);
    console.log('');
  });

  await client.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
