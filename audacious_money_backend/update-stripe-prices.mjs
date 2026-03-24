/**
 * Update Database with Stripe Price IDs and Correct Prices
 *
 * This script updates the products table with the actual Stripe price IDs
 * and adjusts prices to match what's in Stripe.
 */

import pg from 'pg';
const { Client } = pg;

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Stripe product mapping
// Note: price_monthly includes charity_amount ($5) + revenue_amount
const stripeProducts = [
  {
    slug: 'budgeting',
    name: '[AM] Budgeting Tool',
    stripePriceId: 'price_1TEXJoDAS9U3cd2IHtO2Zxv6',
    priceMonthly: 10.00,
    charityAmount: 5.00,
    revenueAmount: 5.00
  },
  {
    slug: 'debt-management',
    name: '[AM] Debt Management',
    stripePriceId: 'price_1TEXKCDAS9U3cd2I7ltla67f',
    priceMonthly: 20.00,
    charityAmount: 5.00,
    revenueAmount: 15.00
  },
  {
    slug: 'service-provider-management',
    name: '[AM] Service Management',
    stripePriceId: 'price_1TEXKoDAS9U3cd2Io9N8HOfD',
    priceMonthly: 30.00,
    charityAmount: 5.00,
    revenueAmount: 25.00
  },
  {
    slug: 'bookkeeping-suite',
    name: '[AM] Bookkeeping Suite',
    stripePriceId: 'price_1TEXLEDAS9U3cd2InL0ZU18M',
    priceMonthly: 40.00,
    charityAmount: 5.00,
    revenueAmount: 35.00
  },
  {
    slug: 'cpu-cpg-calculator',
    name: 'CPG Costing Tool',
    stripePriceId: 'price_1TEXLjDAS9U3cd2IbqasLUtm',
    priceMonthly: 15.00,
    charityAmount: 5.00,
    revenueAmount: 10.00
  }
];

async function updateProducts() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check current products
    const currentProducts = await client.query(
      'SELECT id, slug, name, price_monthly, charity_amount, revenue_amount, stripe_price_id FROM products ORDER BY display_order'
    );

    console.log('Current products in database:');
    console.table(currentProducts.rows);
    console.log('');

    // Update each product
    for (const product of stripeProducts) {
      const result = await client.query(
        `UPDATE products
         SET stripe_price_id = $1,
             price_monthly = $2,
             charity_amount = $3,
             revenue_amount = $4,
             name = $5,
             updated_at = NOW()
         WHERE slug = $6
         RETURNING id, slug, name, price_monthly, stripe_price_id`,
        [
          product.stripePriceId,
          product.priceMonthly,
          product.charityAmount,
          product.revenueAmount,
          product.name,
          product.slug
        ]
      );

      if (result.rowCount > 0) {
        console.log(`✓ Updated ${product.slug}:`);
        console.log(`  - Name: ${product.name}`);
        console.log(`  - Price: $${product.priceMonthly}/mo`);
        console.log(`  - Stripe Price ID: ${product.stripePriceId}`);
      } else {
        console.log(`✗ Product not found: ${product.slug}`);
      }
      console.log('');
    }

    // Show final state
    const updatedProducts = await client.query(
      'SELECT id, slug, name, price_monthly, charity_amount, revenue_amount, stripe_price_id, active FROM products ORDER BY display_order'
    );

    console.log('\nFinal products in database:');
    console.table(updatedProducts.rows);

    // Check for products without Stripe price IDs
    const productsWithoutStripe = updatedProducts.rows.filter(p => !p.stripe_price_id);
    if (productsWithoutStripe.length > 0) {
      console.log('\n⚠️  Products still missing Stripe price IDs:');
      productsWithoutStripe.forEach(p => {
        console.log(`  - ${p.slug}: ${p.name} ($${p.price_monthly})`);
      });
      console.log('\nYou need to create these products in Stripe or remove them from the database.');
    }

    console.log('\n✓ Update complete!');

  } catch (error) {
    console.error('Error updating products:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Additional info about discrepancies
console.log('='.repeat(70));
console.log('STRIPE PRICE UPDATE SCRIPT');
console.log('='.repeat(70));
console.log('\nNOTE: This script will update prices to match Stripe:');
console.log('  - Budgeting Tool: $10/mo (matches)');
console.log('  - Debt Management: $20/mo (matches)');
console.log('  - Service Management: $30/mo (matches)');
console.log('  - Bookkeeping Suite: $40/mo (matches)');
console.log('  - CPG Calculator: $15/mo (matches)');
console.log('\nProducts NOT YET in Stripe:');
console.log('  - CPU Calculator');
console.log('  - Fractional CFO');
console.log('\nAdditional Stripe product found:');
console.log('  - Full number suite: $60/mo (price_1TEXNDDAS9U3cd2IeUJzpkL7)');
console.log('    This is not in the database. Should it be added?');
console.log('\n' + '='.repeat(70) + '\n');

updateProducts();
