-- 011_charity_management_system.sql
-- Adds comprehensive charity management including phase-in/phase-out, notifications, and admin controls

-- =============================================================================
-- ENHANCE CHARITIES TABLE
-- =============================================================================

-- Add new columns to charities table for better management
ALTER TABLE charities
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'INACTIVE')),
  ADD COLUMN IF NOT EXISTS logo VARCHAR(500),
  ADD COLUMN IF NOT EXISTS payment_address TEXT, -- ENCRYPTED - ACH/check/wire payment details
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id);

-- Add check constraint for category
ALTER TABLE charities
  ADD CONSTRAINT check_charity_category CHECK (
    category IS NULL OR category IN (
      'EDUCATION', 'ENVIRONMENT', 'HEALTH', 'POVERTY',
      'ANIMAL_WELFARE', 'HUMAN_RIGHTS', 'DISASTER_RELIEF',
      'ARTS_CULTURE', 'COMMUNITY', 'OTHER'
    )
  );

-- Update existing charities to have VERIFIED status (they're already active)
UPDATE charities SET status = 'VERIFIED' WHERE active = true AND status IS NULL;
UPDATE charities SET status = 'INACTIVE' WHERE active = false AND status IS NULL;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_charities_status ON charities(status) WHERE status = 'VERIFIED';
CREATE INDEX IF NOT EXISTS idx_charities_category ON charities(category);

COMMENT ON COLUMN charities.category IS 'Charity category for filtering and organization';
COMMENT ON COLUMN charities.status IS 'Verification and availability status';
COMMENT ON COLUMN charities.logo IS 'URL or path to charity logo';
COMMENT ON COLUMN charities.payment_address IS 'Encrypted payment details for distributing funds';
COMMENT ON COLUMN charities.verification_notes IS 'Admin notes during verification process';
COMMENT ON COLUMN charities.rejection_reason IS 'Reason for rejection if status is REJECTED';
COMMENT ON COLUMN charities.created_by IS 'Admin user who added/verified the charity';

-- =============================================================================
-- CHARITY PHASE TRANSITIONS TABLE
-- =============================================================================

-- Tracks scheduled phase-in/phase-out transitions for charities
CREATE TABLE IF NOT EXISTS charity_phase_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id UUID NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  replacement_charity_id UUID REFERENCES charities(id) ON DELETE SET NULL,
  phase_out_date TIMESTAMP WITH TIME ZONE NOT NULL,
  phase_in_date TIMESTAMP WITH TIME ZONE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'notified', 'in_progress', 'completed', 'cancelled')),
  reason TEXT,
  admin_notes TEXT,
  created_by UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure phase-in date is after or equal to phase-out date
  CONSTRAINT check_phase_dates CHECK (phase_in_date IS NULL OR phase_in_date >= phase_out_date),

  -- Prevent duplicate active transitions for the same charity
  CONSTRAINT unique_active_transition UNIQUE (charity_id, status)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_phase_transitions_charity ON charity_phase_transitions(charity_id);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_replacement ON charity_phase_transitions(replacement_charity_id);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_status ON charity_phase_transitions(status);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_phase_out_date ON charity_phase_transitions(phase_out_date);

-- Auto-update trigger
CREATE TRIGGER update_charity_phase_transitions_updated_at
  BEFORE UPDATE ON charity_phase_transitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE charity_phase_transitions IS 'Scheduled phase-in/phase-out transitions for charities';
COMMENT ON COLUMN charity_phase_transitions.charity_id IS 'Charity being phased out';
COMMENT ON COLUMN charity_phase_transitions.replacement_charity_id IS 'Charity being phased in (optional)';
COMMENT ON COLUMN charity_phase_transitions.phase_out_date IS 'Date when charity will be unavailable for new selections';
COMMENT ON COLUMN charity_phase_transitions.phase_in_date IS 'Date when replacement charity becomes available';
COMMENT ON COLUMN charity_phase_transitions.notification_sent_at IS 'When affected users were notified';
COMMENT ON COLUMN charity_phase_transitions.status IS 'Current status of the transition';
COMMENT ON COLUMN charity_phase_transitions.reason IS 'User-facing reason for the phase-out';
COMMENT ON COLUMN charity_phase_transitions.admin_notes IS 'Internal admin notes (not shown to users)';

-- =============================================================================
-- USER CHARITY NOTIFICATIONS TABLE
-- =============================================================================

-- Tracks notifications sent to users about charity changes
CREATE TABLE IF NOT EXISTS user_charity_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  charity_phase_transition_id UUID NOT NULL REFERENCES charity_phase_transitions(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL DEFAULT 'charity_phase_out' CHECK (notification_type IN ('charity_phase_out', 'charity_phase_in', 'charity_update')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  new_charity_selected_id UUID REFERENCES charities(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance and IDOR prevention
CREATE INDEX IF NOT EXISTS idx_charity_notifications_user ON user_charity_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_charity_notifications_transition ON user_charity_notifications(charity_phase_transition_id);
CREATE INDEX IF NOT EXISTS idx_charity_notifications_unread ON user_charity_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_charity_notifications_unacknowledged ON user_charity_notifications(user_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- Auto-update trigger
CREATE TRIGGER update_user_charity_notifications_updated_at
  BEFORE UPDATE ON user_charity_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_charity_notifications IS 'Notifications sent to users about charity changes';
COMMENT ON COLUMN user_charity_notifications.user_id IS 'User receiving the notification';
COMMENT ON COLUMN user_charity_notifications.charity_phase_transition_id IS 'The phase transition that triggered this notification';
COMMENT ON COLUMN user_charity_notifications.notification_type IS 'Type of notification sent';
COMMENT ON COLUMN user_charity_notifications.sent_at IS 'When the notification was sent';
COMMENT ON COLUMN user_charity_notifications.read_at IS 'When the user viewed the notification';
COMMENT ON COLUMN user_charity_notifications.acknowledged_at IS 'When the user took action (selected new charity)';
COMMENT ON COLUMN user_charity_notifications.new_charity_selected_id IS 'Which charity the user selected as replacement';

-- =============================================================================
-- CHARITY DISTRIBUTION TRACKING TABLE
-- =============================================================================

-- Tracks monthly charity distributions and payment status
CREATE TABLE IF NOT EXISTS charity_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id UUID NOT NULL REFERENCES charities(id),
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  total_amount DECIMAL(10, 2) NOT NULL,
  contributor_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'confirmed', 'failed')),
  payment_method VARCHAR(50) CHECK (payment_method IN ('ach', 'check', 'wire', 'other')),
  payment_reference VARCHAR(255), -- Check number, ACH confirmation, etc.
  sent_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Prevent duplicate distributions for the same charity/month
  UNIQUE(charity_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_charity_distributions_charity ON charity_distributions(charity_id);
CREATE INDEX IF NOT EXISTS idx_charity_distributions_month ON charity_distributions(month DESC);
CREATE INDEX IF NOT EXISTS idx_charity_distributions_status ON charity_distributions(status);
CREATE INDEX IF NOT EXISTS idx_charity_distributions_pending ON charity_distributions(charity_id, status) WHERE status = 'pending';

-- Auto-update trigger
CREATE TRIGGER update_charity_distributions_updated_at
  BEFORE UPDATE ON charity_distributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE charity_distributions IS 'Monthly distribution tracking for charity payments';
COMMENT ON COLUMN charity_distributions.month IS 'Month of distribution in YYYY-MM format';
COMMENT ON COLUMN charity_distributions.total_amount IS 'Total amount to be distributed to this charity';
COMMENT ON COLUMN charity_distributions.contributor_count IS 'Number of users contributing to this charity';
COMMENT ON COLUMN charity_distributions.status IS 'Current status of the distribution';
COMMENT ON COLUMN charity_distributions.payment_method IS 'Method used to send payment';
COMMENT ON COLUMN charity_distributions.payment_reference IS 'Reference number for tracking payment';

-- =============================================================================
-- FUNCTIONS FOR CHARITY MANAGEMENT
-- =============================================================================

-- Function to automatically create notifications when a phase transition is scheduled
CREATE OR REPLACE FUNCTION notify_users_of_charity_phase_out()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notifications when status changes to 'notified'
  IF NEW.status = 'notified' AND (OLD.status IS NULL OR OLD.status != 'notified') THEN
    -- Insert notification for all users currently using this charity
    INSERT INTO user_charity_notifications (user_id, charity_phase_transition_id, notification_type, sent_at)
    SELECT DISTINCT
      ucs.user_id,
      NEW.id,
      'charity_phase_out',
      NOW()
    FROM user_charity_selections ucs
    WHERE ucs.charity_id = NEW.charity_id
      AND ucs.effective_until IS NULL; -- Only current selections

    -- Update notification_sent_at timestamp
    NEW.notification_sent_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_charity_phase_out
  BEFORE UPDATE ON charity_phase_transitions
  FOR EACH ROW
  EXECUTE FUNCTION notify_users_of_charity_phase_out();

-- Function to automatically complete phase transitions
CREATE OR REPLACE FUNCTION complete_charity_phase_transitions()
RETURNS void AS $$
BEGIN
  -- Mark transitions as completed when phase-out date has passed
  UPDATE charity_phase_transitions
  SET status = 'completed'
  WHERE status IN ('scheduled', 'notified', 'in_progress')
    AND phase_out_date < NOW();

  -- Mark phased-out charities as INACTIVE
  UPDATE charities c
  SET status = 'INACTIVE', active = false
  WHERE EXISTS (
    SELECT 1 FROM charity_phase_transitions cpt
    WHERE cpt.charity_id = c.id
      AND cpt.status = 'completed'
      AND cpt.phase_out_date < NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_charity_phase_transitions IS 'Automatically completes phase transitions when phase-out date passes';

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- View for charity analytics dashboard
CREATE OR REPLACE VIEW charity_analytics AS
SELECT
  c.id,
  c.name,
  c.ein,
  c.category,
  c.status,
  c.active,
  -- Current month stats
  COALESCE(current_month.payment_count, 0) as current_month_payments,
  COALESCE(current_month.total_amount, 0) as current_month_total,
  COALESCE(current_month.contributor_count, 0) as current_month_contributors,
  -- Lifetime stats
  COALESCE(lifetime.payment_count, 0) as lifetime_payments,
  COALESCE(lifetime.total_amount, 0) as lifetime_total,
  COALESCE(lifetime.contributor_count, 0) as lifetime_contributors,
  -- Selection stats
  COALESCE(selections.active_selections, 0) as active_user_selections,
  COALESCE(selections.total_selections, 0) as total_historical_selections,
  -- Distribution stats
  COALESCE(dist.pending_amount, 0) as pending_distribution_amount,
  COALESCE(dist.last_distribution_date, NULL) as last_distribution_date
FROM charities c
-- Current month payments
LEFT JOIN (
  SELECT
    charity_id,
    COUNT(*) as payment_count,
    SUM(charity_amount) as total_amount,
    COUNT(DISTINCT user_id) as contributor_count
  FROM payments
  WHERE status = 'succeeded'
    AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())
  GROUP BY charity_id
) current_month ON c.id = current_month.charity_id
-- Lifetime payments
LEFT JOIN (
  SELECT
    charity_id,
    COUNT(*) as payment_count,
    SUM(charity_amount) as total_amount,
    COUNT(DISTINCT user_id) as contributor_count
  FROM payments
  WHERE status = 'succeeded'
  GROUP BY charity_id
) lifetime ON c.id = lifetime.charity_id
-- User selections
LEFT JOIN (
  SELECT
    charity_id,
    COUNT(*) FILTER (WHERE effective_until IS NULL) as active_selections,
    COUNT(*) as total_selections
  FROM user_charity_selections
  GROUP BY charity_id
) selections ON c.id = selections.charity_id
-- Distribution tracking
LEFT JOIN (
  SELECT
    charity_id,
    SUM(total_amount) FILTER (WHERE status = 'pending') as pending_amount,
    MAX(confirmed_at) as last_distribution_date
  FROM charity_distributions
  GROUP BY charity_id
) dist ON c.id = dist.charity_id;

COMMENT ON VIEW charity_analytics IS 'Comprehensive analytics view for charity performance tracking';

-- View for phase transition management
CREATE OR REPLACE VIEW charity_phase_transition_details AS
SELECT
  cpt.id,
  cpt.status as transition_status,
  cpt.phase_out_date,
  cpt.phase_in_date,
  cpt.reason,
  cpt.notification_sent_at,
  -- Charity being phased out
  c_out.id as charity_out_id,
  c_out.name as charity_out_name,
  c_out.status as charity_out_status,
  -- Replacement charity
  c_in.id as replacement_charity_id,
  c_in.name as replacement_charity_name,
  c_in.status as replacement_charity_status,
  -- User impact
  COUNT(DISTINCT ucs.user_id) as affected_users_count,
  COUNT(DISTINCT ucn.id) FILTER (WHERE ucn.acknowledged_at IS NOT NULL) as users_acknowledged_count,
  -- Admin info
  au.email as created_by_email,
  au.first_name || ' ' || au.last_name as created_by_name,
  cpt.created_at,
  cpt.updated_at
FROM charity_phase_transitions cpt
JOIN charities c_out ON cpt.charity_id = c_out.id
LEFT JOIN charities c_in ON cpt.replacement_charity_id = c_in.id
LEFT JOIN user_charity_selections ucs ON ucs.charity_id = cpt.charity_id AND ucs.effective_until IS NULL
LEFT JOIN user_charity_notifications ucn ON ucn.charity_phase_transition_id = cpt.id
LEFT JOIN admin_users au ON cpt.created_by = au.id
GROUP BY cpt.id, c_out.id, c_in.id, au.email, au.first_name, au.last_name;

COMMENT ON VIEW charity_phase_transition_details IS 'Detailed view of charity phase transitions with user impact';
