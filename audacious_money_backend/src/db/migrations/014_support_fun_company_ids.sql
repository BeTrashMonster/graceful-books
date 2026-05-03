-- Migration 014: Support Fun Company IDs
--
-- Changes the users.id column from UUID to VARCHAR(100) to support:
-- - Existing beta tester UUIDs (36 chars): e.g., "550e8400-e29b-41d4-a716-446655440000"
-- - New fun company IDs (20-30 chars): e.g., "ocean_elephant_614"
--
-- This is backward compatible - all existing UUIDs will continue to work.

BEGIN;

-- Drop foreign key constraints that reference users.id
-- We'll recreate them after the type change

ALTER TABLE user_products DROP CONSTRAINT IF EXISTS user_products_user_id_fkey;
ALTER TABLE user_charity_selections DROP CONSTRAINT IF EXISTS user_charity_selections_user_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE affiliate_conversions DROP CONSTRAINT IF EXISTS affiliate_conversions_user_id_fkey;

-- Change the id column type from UUID to VARCHAR(100)
-- UUID strings are 36 chars, fun IDs are ~20-30 chars
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(100);

-- Also change the foreign key columns in related tables
ALTER TABLE user_products ALTER COLUMN user_id TYPE VARCHAR(100);
ALTER TABLE user_charity_selections ALTER COLUMN user_id TYPE VARCHAR(100);
ALTER TABLE payments ALTER COLUMN user_id TYPE VARCHAR(100);
ALTER TABLE affiliate_conversions ALTER COLUMN user_id TYPE VARCHAR(100);

-- Recreate foreign key constraints
ALTER TABLE user_products
  ADD CONSTRAINT user_products_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_charity_selections
  ADD CONSTRAINT user_charity_selections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add check constraint to ensure IDs are either UUIDs or fun IDs
-- UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
-- Fun ID format: word_word_### (e.g., ocean_elephant_614)
ALTER TABLE users ADD CONSTRAINT users_id_format_check
  CHECK (
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR  -- UUID format
    id ~ '^[a-z]+_[a-z]+_[0-9]{3}$'  -- Fun ID format
  );

COMMIT;

-- Add comment explaining the change
COMMENT ON COLUMN users.id IS 'User ID - either UUID (legacy beta testers) or fun company ID format (nature_animal_###)';
