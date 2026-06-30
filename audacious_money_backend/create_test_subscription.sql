-- First, show available products
SELECT id, name, slug, price_monthly FROM products;

-- Show current user (assuming you're logged in - we'll get the most recent user)
SELECT id, email, first_name FROM users ORDER BY created_at DESC LIMIT 5;
