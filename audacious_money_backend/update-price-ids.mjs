import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

try {
  await client.connect();

  console.log('Updating Stripe Price IDs to LIVE mode...\n');

  // Update CPG Costing Tool
  const cpgResult = await client.query(
    `UPDATE products
     SET stripe_price_id = $1
     WHERE slug = 'cpu-cpg-calculator'
     RETURNING name, slug, stripe_price_id`,
    ['price_1TEXLjDAS9U3cd2IbqasLUtm']
  );

  if (cpgResult.rows.length > 0) {
    console.log('✅ Updated CPG Costing Tool:');
    console.log(`   Old: price_1TEDk9DAS9U3cd2IcZjfFMna`);
    console.log(`   New: ${cpgResult.rows[0].stripe_price_id}\n`);
  }

  // Update Debt Management
  const debtResult = await client.query(
    `UPDATE products
     SET stripe_price_id = $1
     WHERE slug = 'debt-management'
     RETURNING name, slug, stripe_price_id`,
    ['price_1TEXKoDAS9U3cd2Io9N8HOfD']
  );

  if (debtResult.rows.length > 0) {
    console.log('✅ Updated Debt Management:');
    console.log(`   Old: price_1TEXKCDAS9U3cd2I7ltla67f`);
    console.log(`   New: ${debtResult.rows[0].stripe_price_id}\n`);
  }

  console.log('All price IDs updated successfully!');
  console.log('\nVerifying all products...');

  const verifyResult = await client.query(
    'SELECT name, slug, stripe_price_id FROM products ORDER BY name'
  );

  verifyResult.rows.forEach(row => {
    console.log(`${row.name}: ${row.stripe_price_id}`);
  });

  await client.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
