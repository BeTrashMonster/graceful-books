-- 001_initial_schema.sql
-- Initial database schema for Audacious Money platform
--
-- Note: This migration represents the current state of the database
-- which has already been created. This file serves as:
-- 1. Documentation of the initial schema
-- 2. A starting point for future migrations
-- 3. A reference for the schema_migrations table
--
-- If the database is already set up, this migration will be marked
-- as executed during the first `migrate:status` or `migrate:up` run.

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  company_name VARCHAR(255),
  support_key VARCHAR(50) NOT NULL UNIQUE,
  account_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'cancelled')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  charity_amount DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  revenue_amount DECIMAL(10, 2) NOT NULL,
  is_usage_based BOOLEAN NOT NULL DEFAULT false,
  usage_unit_price DECIMAL(10, 2),
  usage_max_price DECIMAL(10, 2),
  stripe_price_id VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure pricing integrity
  CONSTRAINT check_pricing CHECK (price_monthly = charity_amount + revenue_amount)
);

-- User Products (Subscriptions)
CREATE TABLE IF NOT EXISTS user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  trial_converted BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Prevent duplicate subscriptions
  UNIQUE(user_id, product_id)
);

-- Charities table
CREATE TABLE IF NOT EXISTS charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  short_description TEXT,
  long_description TEXT,
  website VARCHAR(500),
  ein VARCHAR(20),
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User Charity Selections
CREATE TABLE IF NOT EXISTS user_charity_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  charity_id UUID NOT NULL REFERENCES charities(id),
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  total_amount DECIMAL(10, 2) NOT NULL,
  charity_amount DECIMAL(10, 2) NOT NULL,
  revenue_amount DECIMAL(10, 2) NOT NULL,
  charity_id UUID REFERENCES charities(id),
  charity_paid BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure payment amounts match
  CONSTRAINT check_payment_amounts CHECK (total_amount = charity_amount + revenue_amount)
);

-- Admin Users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'support', 'finance')),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Affiliate Conversions
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  first_payment_amount DECIMAL(10, 2),
  commission_earned DECIMAL(10, 2),
  commission_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE & SECURITY (IDOR PREVENTION)
-- =============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_support_key ON users(support_key);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status) WHERE account_status = 'active';

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;

-- User Products indexes (IDOR prevention)
CREATE INDEX IF NOT EXISTS idx_user_products_user_id ON user_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_user_product ON user_products(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_user_products_status ON user_products(status);
CREATE INDEX IF NOT EXISTS idx_user_products_stripe ON user_products(stripe_subscription_id);

-- Charities indexes
CREATE INDEX IF NOT EXISTS idx_charities_active ON charities(active) WHERE active = true;

-- User Charity Selections indexes (IDOR prevention)
CREATE INDEX IF NOT EXISTS idx_charity_selections_user_id ON user_charity_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_charity_selections_active ON user_charity_selections(user_id, effective_until) WHERE effective_until IS NULL;

-- Payments indexes (IDOR prevention)
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_charity ON payments(charity_id, charity_paid) WHERE charity_paid = false;
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Admin Audit Log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- Affiliates indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_active ON affiliates(active) WHERE active = true;

-- Affiliate Conversions indexes
CREATE INDEX IF NOT EXISTS idx_conversions_affiliate ON affiliate_conversions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_conversions_user ON affiliate_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_unpaid ON affiliate_conversions(commission_paid) WHERE commission_paid = false;

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_products_updated_at
  BEFORE UPDATE ON user_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charities_updated_at
  BEFORE UPDATE ON charities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_conversions_updated_at
  BEFORE UPDATE ON affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique support keys
CREATE OR REPLACE FUNCTION generate_support_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: XXXX-XXXX-XXXX (12 chars, no ambiguous characters)
    key := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4)
    );

    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE support_key = key) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN key;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate support key on user insert
CREATE OR REPLACE FUNCTION set_user_support_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.support_key IS NULL OR NEW.support_key = '' THEN
    NEW.support_key := generate_support_key();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_support_key_trigger
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_support_key();

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- Insert default products (if not already present)
INSERT INTO products (slug, name, description, price_monthly, charity_amount, revenue_amount, display_order)
VALUES
  ('budgeting', 'Budgeting', 'Track your income and expenses with ease', 10.00, 5.00, 5.00, 1),
  ('debt-management', 'Debt Management', 'Get out of debt faster with smart strategies', 20.00, 5.00, 15.00, 2),
  ('service-provider-management', 'Service Provider Management', 'Manage all your service providers in one place', 30.00, 5.00, 25.00, 3),
  ('cpu-cpg-calculator', 'CPU/CPG Calculator', 'Calculate cost per use and cost per guest', 15.00, 5.00, 10.00, 4),
  ('bookkeeping-suite', 'Bookkeeping Suite', 'Complete bookkeeping solution for small business', 40.00, 5.00, 35.00, 5),
  ('fractional-cfo', 'Fractional CFO', 'Strategic financial guidance and planning', 60.00, 5.00, 55.00, 6)
ON CONFLICT (slug) DO NOTHING;

-- Insert default charities (examples - replace with actual charities)
INSERT INTO charities (name, short_description, website, active, display_order)
VALUES
  ('American Red Cross', 'Humanitarian organization providing emergency assistance', 'https://www.redcross.org', true, 1),
  ('Feeding America', 'Nationwide network of food banks fighting hunger', 'https://www.feedingamerica.org', true, 2),
  ('St. Jude Children''s Research Hospital', 'Pediatric treatment and research facility', 'https://www.stjude.org', true, 3),
  ('World Wildlife Fund', 'Conservation organization protecting endangered species', 'https://www.worldwildlife.org', true, 4),
  ('Habitat for Humanity', 'Building affordable housing worldwide', 'https://www.habitat.org', true, 5)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE users IS 'User accounts for the Audacious Money platform';
COMMENT ON TABLE products IS 'Available subscription products';
COMMENT ON TABLE user_products IS 'User product subscriptions and entitlements';
COMMENT ON TABLE charities IS 'Charitable organizations that receive donations';
COMMENT ON TABLE user_charity_selections IS 'User charity preferences over time';
COMMENT ON TABLE payments IS 'Payment records and transaction history';
COMMENT ON TABLE admin_users IS 'Administrative user accounts';
COMMENT ON TABLE admin_audit_log IS 'Audit trail for all administrative actions';
COMMENT ON TABLE affiliates IS 'Affiliate partners and their commission structures';
COMMENT ON TABLE affiliate_conversions IS 'Tracking of affiliate-referred conversions';

COMMENT ON COLUMN users.support_key IS 'Unique support key for customer service lookup';
COMMENT ON COLUMN products.charity_amount IS 'Amount from subscription going to charity ($5/month)';
COMMENT ON COLUMN products.revenue_amount IS 'Amount from subscription going to Audacious Money';
COMMENT ON COLUMN user_products.status IS 'Current subscription status: trial, active, cancelled, or expired';
COMMENT ON COLUMN payments.charity_paid IS 'Whether the charity portion has been paid out';
