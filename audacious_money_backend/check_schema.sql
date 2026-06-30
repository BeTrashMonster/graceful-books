SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_products' 
AND column_name IN ('paused_at', 'resumed_at', 'grace_period_ends_at')
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'stripe_customer_id';
