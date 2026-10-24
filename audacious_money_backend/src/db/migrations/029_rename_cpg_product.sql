-- 029_rename_cpg_product.sql
-- Rename "CPU/CPG Calculator" to "Product Costing Tool"
-- This is the user-facing name for the CPG costing product

UPDATE products
SET name = 'Product Costing Tool',
    updated_at = NOW()
WHERE name = 'CPU/CPG Calculator';

-- Also update if it was named differently (catch variations)
UPDATE products
SET name = 'Product Costing Tool',
    updated_at = NOW()
WHERE slug = 'cpu-cpg' AND name != 'Product Costing Tool';
