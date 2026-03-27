import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

console.log('🌱 Seeding database with initial data...\n');

// Check if data already exists
const charityCount = await client.query('SELECT COUNT(*) FROM charities');
const productCount = await client.query('SELECT COUNT(*) FROM products');

if (parseInt(charityCount.rows[0].count) > 0) {
  console.log(`⚠️  Found ${charityCount.rows[0].count} existing charities - skipping charity seed`);
} else {
  console.log('📝 Inserting charities...');
  await client.query(`
    INSERT INTO charities (name, short_description, ein, website, active) VALUES
      ('One Tree Planted', 'Global reforestation nonprofit planting trees in 80+ countries', '46-4664562', 'https://onetreeplanted.org', true),
      ('The Ocean Cleanup', 'Developing technology to remove plastic from oceans', '82-2606143', 'https://theoceancleanup.com', true),
      ('Rainforest Trust', 'Protecting endangered rainforests worldwide', '13-3500609', 'https://www.rainforesttrust.org', true),
      ('Cool Earth', 'Working with rainforest communities to halt deforestation', 'UK-1089101', 'https://www.coolearth.org', true),
      ('Eden Reforestation Projects', 'Employing locals to plant millions of trees annually', '47-2081836', 'https://www.edenprojects.org', true)
  `);
  console.log('✅ Inserted 5 charities\n');
}

if (parseInt(productCount.rows[0].count) > 0) {
  console.log(`⚠️  Found ${productCount.rows[0].count} existing products - skipping product seed`);
} else {
  console.log('📝 Inserting products...');
  await client.query(`
    INSERT INTO products (name, slug, description, price_usd, billing_cycle, stripe_price_id, active, sort_order) VALUES
      ('Budgeting Tool', 'budgeting', 'Simple budgeting and expense tracking', 10.00, 'monthly', NULL, true, 1),
      ('Debt Management', 'debt', 'Track and manage debt payoff strategies', 20.00, 'monthly', NULL, true, 2),
      ('Service Provider Management', 'service-provider', 'Manage clients, invoices, and service delivery', 30.00, 'monthly', NULL, true, 3),
      ('CPG/Distributor Management', 'cpg', 'Track products, distribution, and sales channels', 30.00, 'monthly', NULL, true, 4),
      ('CPU Calculator', 'cpu-calculator', 'Per-product CPU cost analysis tool', 5.00, 'per_product', NULL, true, 5),
      ('Bookkeeping Suite', 'bookkeeping', 'Full bookkeeping with reconciliation and reports', 40.00, 'monthly', NULL, true, 6),
      ('Fractional CFO', 'cfo', 'Strategic financial planning and analysis', 60.00, 'monthly', NULL, true, 7)
  `);
  console.log('✅ Inserted 7 products\n');
}

// Summary
const finalCharityCount = await client.query('SELECT COUNT(*) FROM charities');
const finalProductCount = await client.query('SELECT COUNT(*) FROM products');

console.log('📊 Database Summary:');
console.log(`   - Charities: ${finalCharityCount.rows[0].count}`);
console.log(`   - Products: ${finalProductCount.rows[0].count}`);

await client.end();

console.log('\n✨ Database seeding complete!');
