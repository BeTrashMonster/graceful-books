-- Update CPU/CPG Calculator product with Stripe IDs
-- Live Price ID: price_1TTGwPDAS9U3cd2IJj6TtyM7

UPDATE products
SET
  stripe_price_id = 'price_1TTGwPDAS9U3cd2IJj6TtyM7',
  updated_at = NOW()
WHERE slug = 'cpu-cpg-calculator';

-- Verify the update
SELECT id, slug, name, price_monthly, stripe_price_id, active
FROM products
WHERE slug = 'cpu-cpg-calculator';
