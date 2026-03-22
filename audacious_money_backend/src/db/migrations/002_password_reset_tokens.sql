-- 002_password_reset_tokens.sql
-- Add password_reset_tokens table for secure password reset flow

-- =============================================================================
-- PASSWORD RESET TOKENS TABLE
-- =============================================================================

-- Table for storing password reset tokens
-- Tokens are single-use and expire after 1 hour
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure token is used before expiry
  CONSTRAINT check_used_before_expiry CHECK (used_at IS NULL OR used_at <= expires_at + INTERVAL '1 day')
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE & SECURITY
-- =============================================================================

-- Index for token lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Index for user_id lookup (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens with 1-hour expiry and single-use enforcement';
COMMENT ON COLUMN password_reset_tokens.token IS 'Cryptographically secure random token (32 bytes hex)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';
