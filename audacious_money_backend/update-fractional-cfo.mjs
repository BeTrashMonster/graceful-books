import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

await client.query(`
  UPDATE products
  SET stripe_price_id = 'price_1TEXNDDAS9U3cd2IeUJzpkL7',
      name = 'Full Number Suite',
      updated_at = NOW()
  WHERE slug = 'fractional-cfo'
`);

const result = await client.query('SELECT slug, name, price_monthly, stripe_price_id FROM products WHERE slug = \'fractional-cfo\'');
console.log('✓ Updated Fractional CFO:');
console.table(result.rows);

await client.end();
