-- 005_add_is_beta_flag.sql
-- Add beta user flag to users table

-- Add is_beta column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT false;

-- Add index for beta user queries
CREATE INDEX IF NOT EXISTS idx_users_is_beta
  ON users(is_beta)
  WHERE is_beta = true;
