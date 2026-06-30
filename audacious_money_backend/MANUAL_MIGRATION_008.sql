-- MANUAL MIGRATION: Run this directly on your DigitalOcean database
-- This creates the email_subscribers table that the system needs

-- Create table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_tags ON email_subscribers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_created_at ON email_subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_notified_at ON email_subscribers(notified_at) WHERE notified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_subscribers_converted ON email_subscribers(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;

-- Create trigger function
CREATE OR REPLACE FUNCTION update_email_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_email_subscribers_updated_at ON email_subscribers;
CREATE TRIGGER trigger_email_subscribers_updated_at
BEFORE UPDATE ON email_subscribers
FOR EACH ROW
EXECUTE FUNCTION update_email_subscribers_updated_at();

-- Migrate existing CPG signups
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

-- Verify it worked
SELECT
  COUNT(*) as total_subscribers,
  COUNT(*) FILTER (WHERE tags @> '["cpg"]'::jsonb) as cpg_subscribers,
  COUNT(*) FILTER (WHERE tags @> '["home"]'::jsonb) as home_subscribers
FROM email_subscribers;
