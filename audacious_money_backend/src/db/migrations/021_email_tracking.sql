-- Migration: 021_email_tracking
-- Description: Create email tracking infrastructure for Postmark webhooks
-- Author: Claude Sonnet 4.5
-- Date: 2026-06-30

-- =============================================================================
-- EMAIL TRACKING EVENTS TABLE
-- =============================================================================
-- Stores all email tracking events received from Postmark webhooks
-- Supports tracking for all email categories: workshop, billing, notification, marketing, system

CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Postmark identifiers
  message_id TEXT NOT NULL,  -- Postmark MessageID
  message_stream TEXT NOT NULL DEFAULT 'outbound',

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'spam_complaint',
    'subscription_change'
  )),

  -- Recipient & content
  recipient_email TEXT NOT NULL,
  subject TEXT,

  -- Email classification
  email_category TEXT NOT NULL CHECK (email_category IN (
    'workshop',
    'billing',
    'notification',
    'marketing',
    'system'
  )),
  email_type TEXT,  -- e.g., 'welcome', 'reminder', 'week1', 'invoice_reminder'

  -- Context (foreign keys - nullable for flexibility)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,

  -- Event-specific data
  event_metadata JSONB,  -- Click URL, bounce reason, spam report details, etc.

  -- Postmark raw data (for debugging)
  postmark_payload JSONB,

  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL,  -- When event occurred (from Postmark)
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When we received webhook
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (message_id, event_type, event_timestamp)  -- Prevent duplicate events
);

-- =============================================================================
-- INDEXES FOR QUERY PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON email_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_workshop_id ON email_tracking_events(workshop_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_tracking_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_category ON email_tracking_events(email_category);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_tracking_events(event_timestamp DESC);

-- Composite index for workshop email queries (most common use case)
CREATE INDEX IF NOT EXISTS idx_email_events_user_workshop ON email_tracking_events(user_id, workshop_id)
  WHERE email_category = 'workshop';

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE email_tracking_events IS 'Stores all email tracking events received from Postmark webhooks';
COMMENT ON COLUMN email_tracking_events.message_id IS 'Postmark MessageID - unique identifier for each email sent';
COMMENT ON COLUMN email_tracking_events.event_type IS 'Type of event: sent, delivered, opened, clicked, bounced, spam_complaint, subscription_change';
COMMENT ON COLUMN email_tracking_events.email_category IS 'High-level category: workshop, billing, notification, marketing, system';
COMMENT ON COLUMN email_tracking_events.email_type IS 'Specific email type within category (e.g., welcome, reminder, week1)';
COMMENT ON COLUMN email_tracking_events.event_metadata IS 'Event-specific data like clicked URL, bounce reason, etc.';
COMMENT ON COLUMN email_tracking_events.postmark_payload IS 'Full Postmark webhook payload for debugging';

-- =============================================================================
-- MATERIALIZED VIEW FOR AGGREGATED METRICS
-- =============================================================================
-- Provides quick access to aggregated email delivery metrics without scanning all events

CREATE MATERIALIZED VIEW IF NOT EXISTS email_delivery_summary AS
SELECT
  message_id,
  recipient_email,
  user_id,
  workshop_id,
  email_category,
  email_type,
  subject,
  MAX(CASE WHEN event_type = 'sent' THEN event_timestamp END) as sent_at,
  MAX(CASE WHEN event_type = 'delivered' THEN event_timestamp END) as delivered_at,
  MAX(CASE WHEN event_type = 'opened' THEN event_timestamp END) as opened_at,
  MAX(CASE WHEN event_type = 'clicked' THEN event_timestamp END) as clicked_at,
  MAX(CASE WHEN event_type = 'bounced' THEN event_timestamp END) as bounced_at,
  MAX(CASE WHEN event_type = 'spam_complaint' THEN event_timestamp END) as spam_at,
  ARRAY_AGG(DISTINCT event_type ORDER BY event_type) as events,
  COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as click_count,
  MIN(created_at) as first_event_at,
  MAX(created_at) as last_event_at
FROM email_tracking_events
GROUP BY message_id, recipient_email, user_id, workshop_id, email_category, email_type, subject;

-- Indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_summary_message_id ON email_delivery_summary(message_id);
CREATE INDEX IF NOT EXISTS idx_email_summary_user_workshop ON email_delivery_summary(user_id, workshop_id);

COMMENT ON MATERIALIZED VIEW email_delivery_summary IS 'Aggregated email delivery metrics for quick queries';

-- =============================================================================
-- REFRESH FUNCTION FOR MATERIALIZED VIEW
-- =============================================================================
-- The materialized view needs to be refreshed periodically to include new data
-- This can be done via a cron job or manually when needed:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY email_delivery_summary;
