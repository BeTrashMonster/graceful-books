-- Migration: Unified Email Subscribers System
-- Created: 2026-04-10
-- Purpose: Create unified email_subscribers table with tag-based segmentation and conversion tracking

CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  business_name VARCHAR(255),
  tags JSONB DEFAULT '[]'::jsonb NOT NULL,
  status VARCHAR(20) DEFAULT 'subscribed' NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  notified_at TIMESTAMP WITH TIME ZONE,
  converted_to_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_tags ON email_subscribers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_created_at ON email_subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_notified_at ON email_subscribers(notified_at) WHERE notified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_subscribers_converted ON email_subscribers(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_subscribers_updated_at
BEFORE UPDATE ON email_subscribers
FOR EACH ROW
EXECUTE FUNCTION update_email_subscribers_updated_at();

-- Comments
COMMENT ON TABLE email_subscribers IS 'Unified email subscriber list with tag-based segmentation (cpg, home, etc.)';
COMMENT ON COLUMN email_subscribers.tags IS 'JSONB array of tags for segmentation (e.g., ["cpg"], ["home"], ["cpg", "home"])';
COMMENT ON COLUMN email_subscribers.status IS 'Subscription status: subscribed or unsubscribed';
COMMENT ON COLUMN email_subscribers.notified_at IS 'Timestamp when launch notification was sent';
COMMENT ON COLUMN email_subscribers.converted_to_user_id IS 'Set when subscriber converts to full user account';

-- Migrate existing CPG signups to unified table
INSERT INTO email_subscribers (
  email,
  first_name,
  last_name,
  business_name,
  tags,
  status,
  subscribed_at,
  unsubscribed_at,
  notified_at,
  converted_to_user_id,
  created_at
)
SELECT
  email,
  COALESCE(first_name, ''),
  COALESCE(last_name, ''),
  business_name,
  '["cpg"]'::jsonb,
  CASE
    WHEN unsubscribed_at IS NOT NULL THEN 'unsubscribed'
    ELSE 'subscribed'
  END,
  created_at,
  unsubscribed_at,
  notified_at,
  converted_to_user_id,
  created_at
FROM cpg_launch_signups
ON CONFLICT (email) DO NOTHING;

-- Note: We're keeping cpg_launch_signups table for now as backup
-- It can be dropped in a future migration after verifying data integrity
