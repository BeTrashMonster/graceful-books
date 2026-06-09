-- Update CPG Tool static price from $15 to $20/month
-- This ensures the fallback price matches the actual Stripe subscription price

-- Check current value
SELECT id, name, slug, price_monthly
FROM products
WHERE slug = 'cpu-cpg-calculator';

-- Update to $20
UPDATE products
SET price_monthly = 20,
    updated_at = NOW()
WHERE slug = 'cpu-cpg-calculator';

-- Verify the change
SELECT id, name, slug, price_monthly
FROM products
WHERE slug = 'cpu-cpg-calculator';
