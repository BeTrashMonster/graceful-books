-- 012_add_display_order_to_charity_analytics.sql
-- Adds display_order to charity_analytics view so it's visible in admin dashboard

-- Drop the existing view first (PostgreSQL doesn't allow column reordering with CREATE OR REPLACE)
DROP VIEW IF EXISTS charity_analytics;

-- Recreate the view with all charity fields plus analytics
CREATE VIEW charity_analytics AS
SELECT
  c.id,
  c.name,
  c.ein,
  c.short_description,
  c.long_description,
  c.website,
  c.category,
  c.logo,
  c.payment_address,
  c.status,
  c.active,
  c.display_order,
  c.verification_notes,
  c.rejection_reason,
  c.created_by,
  c.created_at,
  c.updated_at,
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
-- Distribution stats
LEFT JOIN (
  SELECT
    charity_id,
    SUM(total_amount) FILTER (WHERE status IN ('pending', 'processing')) as pending_amount,
    MAX(confirmed_at) as last_distribution_date
  FROM charity_distributions
  GROUP BY charity_id
) dist ON c.id = dist.charity_id;

COMMENT ON VIEW charity_analytics IS 'Comprehensive charity analytics with full charity details, payments, selections, and distributions';
