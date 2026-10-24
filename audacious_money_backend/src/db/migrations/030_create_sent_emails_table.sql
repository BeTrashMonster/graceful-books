-- Migration: 030_create_sent_emails_table.sql
-- Description: Store all rendered emails sent to users for support diagnostics
-- This enables support staff to see exactly what emails users received

CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who received it
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,  -- Capture email at time of send

  -- Email details
  email_type VARCHAR(50) NOT NULL,  -- 'welcome', 'reminder', 'week1', etc.
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,       -- Full rendered HTML
  text_content TEXT,                -- Plain text version (optional)

  -- Context
  workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
  workshop_enrollment_id UUID REFERENCES workshop_enrollments(id) ON DELETE SET NULL,

  -- Trigger source (what caused this email to be sent)
  triggered_by VARCHAR(50) NOT NULL DEFAULT 'system',  -- 'system', 'cron', 'webhook', 'manual', 'admin'
  triggered_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  -- Delivery tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(30) DEFAULT 'sent',  -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'spam_complaint'
  delivery_status_updated_at TIMESTAMPTZ,

  -- Bounce details
  bounce_type VARCHAR(20),  -- 'soft', 'hard'
  bounce_reason TEXT,

  -- Engagement tracking
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,

  -- Provider details
  delivery_provider VARCHAR(50),    -- 'resend', 'sendgrid', etc.
  provider_message_id VARCHAR(255), -- External tracking ID

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_sent_emails_user_id ON sent_emails(user_id);
CREATE INDEX idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);
CREATE INDEX idx_sent_emails_workshop ON sent_emails(workshop_id) WHERE workshop_id IS NOT NULL;
CREATE INDEX idx_sent_emails_type ON sent_emails(email_type);
CREATE INDEX idx_sent_emails_status ON sent_emails(delivery_status);
CREATE INDEX idx_sent_emails_bounced ON sent_emails(delivery_status) WHERE delivery_status IN ('bounced', 'failed', 'spam_complaint');
CREATE INDEX idx_sent_emails_provider_msg ON sent_emails(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- Comments
COMMENT ON TABLE sent_emails IS 'Stores all rendered emails sent to users for support diagnostics';
COMMENT ON COLUMN sent_emails.html_content IS 'Complete rendered HTML as received by user';
COMMENT ON COLUMN sent_emails.triggered_by IS 'What initiated this email: system automation, cron job, webhook, manual action, or admin';
COMMENT ON COLUMN sent_emails.delivery_status IS 'Current delivery status from email provider';
COMMENT ON COLUMN sent_emails.bounce_type IS 'For bounced emails: soft (temporary) or hard (permanent)';
