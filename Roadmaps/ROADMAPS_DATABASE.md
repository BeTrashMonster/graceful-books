# Audacious Money - Database Schema

> Complete PostgreSQL schema for the Business Backend

## Overview

This schema covers the **business operations** database only. User financial data (transactions, budgets, etc.) is stored client-side in IndexedDB and synced encrypted to the sync relay.

**What this database contains:**
- User accounts
- Subscriptions & payments
- Product entitlements
- Charity selections
- Affiliate tracking
- Support sessions
- Admin operations
- Discount codes

**What this database DOES NOT contain:**
- User financial transactions (zero-knowledge, client-side only)
- Decryption keys (master passphrase never sent to server)

---

## Complete Schema (PostgreSQL)

```sql
-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Argon2id or bcrypt
  support_key VARCHAR(20) UNIQUE NOT NULL, -- e.g., "AM-7K3M-9PQR"

  -- Recovery
  encrypted_master_key TEXT, -- Master key encrypted with account password
  recovery_codes_hash TEXT[], -- Array of hashed recovery codes

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),

  -- Status
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMP,
  account_status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'deleted'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,

  -- Indexes
  INDEX idx_users_email (email),
  INDEX idx_users_support_key (support_key),
  INDEX idx_users_account_status (account_status)
);

COMMENT ON TABLE users IS 'User accounts - does NOT contain financial data (zero-knowledge)';
COMMENT ON COLUMN users.encrypted_master_key IS 'Master encryption key encrypted with account password for quick access';
COMMENT ON COLUMN users.support_key IS 'Unique key users provide to support for account lookup (e.g., AM-7K3M-9PQR)';

-- =====================================================
-- PRODUCTS & PRICING
-- =====================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL, -- 'budgeting', 'debt_management', 'cpg', etc.
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Pricing
  price_monthly DECIMAL(10,2) NOT NULL, -- Total price per month
  charity_amount DECIMAL(10,2) NOT NULL, -- Amount going to charity
  revenue_amount DECIMAL(10,2) NOT NULL, -- Amount going to Audacious Money

  -- Special pricing
  is_usage_based BOOLEAN DEFAULT false, -- TRUE for CPU ($5/product)
  usage_unit_price DECIMAL(10,2), -- For CPU: 5.00
  usage_max_price DECIMAL(10,2), -- For CPU: 50.00

  -- Features
  includes_products UUID[], -- Array of product IDs included (for Bookkeeping/CFO)
  stripe_price_id VARCHAR(255), -- Stripe price ID

  -- Status
  active BOOLEAN DEFAULT true,
  display_order INTEGER,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_products_slug (slug),
  INDEX idx_products_active (active)
);

COMMENT ON TABLE products IS 'Product catalog with pricing and features';
COMMENT ON COLUMN products.includes_products IS 'For suite products: array of included product IDs';

-- Initial product data
INSERT INTO products (slug, name, price_monthly, charity_amount, revenue_amount, display_order) VALUES
  ('budgeting', 'Budgeting Tool', 10.00, 5.00, 5.00, 1),
  ('debt_management', 'Debt Management', 20.00, 5.00, 15.00, 2),
  ('service_provider', 'Service Provider Management', 30.00, 5.00, 25.00, 3),
  ('cpg', 'CPG/Distributor Management', 30.00, 5.00, 25.00, 4),
  ('cpu', 'CPU Calculator', 0.00, 5.00, 0.00, 5), -- Usage-based pricing
  ('bookkeeping', 'Bookkeeping Suite', 40.00, 5.00, 35.00, 6),
  ('fractional_cfo', 'Fractional CFO', 60.00, 5.00, 55.00, 7);

UPDATE products SET is_usage_based = true, usage_unit_price = 5.00, usage_max_price = 50.00
WHERE slug = 'cpu';

-- =====================================================
-- USER PRODUCTS (Entitlements)
-- =====================================================

CREATE TABLE user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),

  -- Subscription status
  status VARCHAR(20) NOT NULL, -- 'trial', 'active', 'cancelled', 'expired'

  -- Trial tracking
  trial_ends_at TIMESTAMP,
  trial_converted BOOLEAN DEFAULT false,

  -- Lifecycle
  activated_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  reactivated_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- Stripe
  stripe_subscription_id VARCHAR(255),
  stripe_subscription_item_id VARCHAR(255), -- For usage-based (CPU)

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (user_id, product_id),
  INDEX idx_user_products_user (user_id),
  INDEX idx_user_products_status (status),
  INDEX idx_user_products_trial_ends (trial_ends_at)
);

COMMENT ON TABLE user_products IS 'User product entitlements and trial tracking (14 days per product)';

-- =====================================================
-- CHARITIES
-- =====================================================

CREATE TABLE charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  short_description TEXT NOT NULL,

  -- Legal/Contact
  ein VARCHAR(20), -- Tax ID
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Internal
  notes TEXT,
  active BOOLEAN DEFAULT true,
  display_order INTEGER,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_charities_active (active)
);

COMMENT ON TABLE charities IS 'Curated list of charities users can select (5 to start)';

-- =====================================================
-- USER CHARITY SELECTIONS
-- =====================================================

CREATE TABLE user_charity_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  charity_id UUID NOT NULL REFERENCES charities(id),

  -- Effective dates
  selected_at TIMESTAMP DEFAULT NOW(),
  effective_from TIMESTAMP DEFAULT NOW(), -- When this selection becomes active
  effective_until TIMESTAMP, -- NULL if current selection

  -- Metadata
  previous_charity_id UUID REFERENCES charities(id),

  INDEX idx_user_charity_user (user_id),
  INDEX idx_user_charity_effective (effective_from, effective_until)
);

COMMENT ON TABLE user_charity_selections IS 'Tracks user charity selections over time (changes apply to next payment)';

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID REFERENCES products(id),

  -- Stripe data
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_invoice_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),

  -- Amounts
  total_amount DECIMAL(10,2) NOT NULL,
  charity_amount DECIMAL(10,2) NOT NULL,
  revenue_amount DECIMAL(10,2) NOT NULL,

  -- Charity allocation
  charity_id UUID REFERENCES charities(id),
  charity_paid BOOLEAN DEFAULT false,
  charity_paid_at TIMESTAMP,

  -- Status
  status VARCHAR(20) NOT NULL, -- 'succeeded', 'failed', 'refunded', 'disputed'
  payment_method VARCHAR(50), -- 'card', 'bank_transfer', etc.

  -- Timestamps
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_payments_user (user_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_charity (charity_id),
  INDEX idx_payments_charity_paid (charity_paid),
  INDEX idx_payments_stripe_intent (stripe_payment_intent_id)
);

COMMENT ON TABLE payments IS 'All payment transactions with charity allocation tracking';

-- =====================================================
-- CHARITY PAYOUTS
-- =====================================================

CREATE TABLE charity_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id UUID NOT NULL REFERENCES charities(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  total_amount DECIMAL(10,2) NOT NULL,
  payment_count INTEGER NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at TIMESTAMP,
  payment_method VARCHAR(50), -- 'check', 'bank_transfer', 'paypal', etc.
  payment_reference VARCHAR(255), -- Check number, transaction ID, etc.

  -- Notes
  notes TEXT,

  -- Timestamps
  generated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_charity_payouts_charity (charity_id),
  INDEX idx_charity_payouts_status (status),
  INDEX idx_charity_payouts_period (period_start, period_end)
);

COMMENT ON TABLE charity_payouts IS 'Monthly charity payout tracking (auto-generated, paid quarterly)';

-- =====================================================
-- AFFILIATES
-- =====================================================

CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., "PARTNER123"

  -- Contact
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,

  -- Commission structure
  commission_type VARCHAR(20) NOT NULL, -- 'percentage' or 'flat'
  commission_value DECIMAL(10,2) NOT NULL, -- 20.00 for 20% or 10.00 for $10
  commission_duration INTEGER DEFAULT 1, -- Months of recurring commission (1 = first payment only)

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_affiliates_code (code),
  INDEX idx_affiliates_active (active)
);

COMMENT ON TABLE affiliates IS 'Affiliate partners with custom commission structures';
COMMENT ON COLUMN affiliates.commission_duration IS 'Number of months to pay commission (1 = first payment only, 12 = first year, etc.)';

-- =====================================================
-- AFFILIATE CONVERSIONS
-- =====================================================

CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),

  -- Conversion tracking
  clicked_at TIMESTAMP, -- When they clicked affiliate link
  signed_up_at TIMESTAMP, -- When they created account
  converted_at TIMESTAMP, -- When they paid

  -- Payment data
  first_payment_amount DECIMAL(10,2),
  commission_earned DECIMAL(10,2),

  -- Payout status
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMP,
  payout_reference VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_affiliate_conversions_affiliate (affiliate_id),
  INDEX idx_affiliate_conversions_user (user_id),
  INDEX idx_affiliate_conversions_paid (commission_paid)
);

COMMENT ON TABLE affiliate_conversions IS 'Tracks affiliate signups, conversions, and commission payouts';

-- =====================================================
-- DISCOUNT CODES
-- =====================================================

CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,

  -- Discount details
  discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount', 'trial_extension'
  discount_value DECIMAL(10,2), -- 20.00 for 20% off or $20 off
  trial_extension_days INTEGER, -- e.g., 7 for 7 extra days

  -- Restrictions
  product_ids UUID[], -- NULL = all products, otherwise specific products
  max_uses INTEGER, -- NULL = unlimited
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,

  -- Validity
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  active BOOLEAN DEFAULT true,

  -- Stripe
  stripe_coupon_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),

  INDEX idx_discount_codes_code (code),
  INDEX idx_discount_codes_active (active)
);

COMMENT ON TABLE discount_codes IS 'Promotional discount codes (%, fixed amount, or trial extension)';

-- =====================================================
-- DISCOUNT CODE USAGE
-- =====================================================

CREATE TABLE discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID REFERENCES products(id),

  -- Usage details
  used_at TIMESTAMP DEFAULT NOW(),
  discount_amount DECIMAL(10,2), -- Actual amount discounted

  INDEX idx_discount_usage_code (discount_code_id),
  INDEX idx_discount_usage_user (user_id)
);

COMMENT ON TABLE discount_code_usage IS 'Tracks discount code redemptions';

-- =====================================================
-- SUPPORT SESSIONS
-- =====================================================

CREATE TABLE support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Session token (user provides to support)
  session_token VARCHAR(64) UNIQUE NOT NULL,

  -- Access type
  access_type VARCHAR(20) NOT NULL, -- 'admin_only' or 'books_access'
  decryption_key TEXT, -- Only if books_access, contains encrypted master key

  -- Lifecycle
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- 24 hours from granted_at
  revoked_at TIMESTAMP,

  -- Admin tracking
  accessed_by UUID REFERENCES admin_users(id),
  accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,

  -- Notes
  user_notes TEXT, -- Why they requested support
  admin_notes TEXT, -- Support notes

  INDEX idx_support_sessions_user (user_id),
  INDEX idx_support_sessions_token (session_token),
  INDEX idx_support_sessions_expires (expires_at)
);

COMMENT ON TABLE support_sessions IS 'Temporary support access sessions (user-granted, 24hr expiry)';
COMMENT ON COLUMN support_sessions.decryption_key IS 'Encrypted master key that support can decrypt to view user data (only if books_access)';

-- =====================================================
-- ADMIN USERS
-- =====================================================

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),

  -- Permissions
  role VARCHAR(50) NOT NULL, -- 'super_admin', 'admin', 'support', 'finance'
  permissions TEXT[], -- Array of permission strings

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,

  INDEX idx_admin_users_email (email),
  INDEX idx_admin_users_role (role),
  INDEX idx_admin_users_active (active)
);

COMMENT ON TABLE admin_users IS 'Admin dashboard users (separate from regular users)';

-- =====================================================
-- ADMIN AUDIT LOG
-- =====================================================

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id),

  -- Action details
  action VARCHAR(100) NOT NULL, -- 'user_suspended', 'discount_created', etc.
  resource_type VARCHAR(50), -- 'user', 'discount', 'charity', etc.
  resource_id UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_admin_audit_admin (admin_user_id),
  INDEX idx_admin_audit_action (action),
  INDEX idx_admin_audit_resource (resource_type, resource_id),
  INDEX idx_admin_audit_created (created_at)
);

COMMENT ON TABLE admin_audit_log IS 'Comprehensive audit trail of all admin actions';

-- =====================================================
-- EMAIL VERIFICATION TOKENS
-- =====================================================

CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,

  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_email_verification_token (token),
  INDEX idx_email_verification_user (user_id)
);

-- =====================================================
-- PASSWORD RESET TOKENS
-- =====================================================

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,

  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_password_reset_token (token),
  INDEX idx_password_reset_user (user_id)
);

-- =====================================================
-- SYNC METADATA (For sync relay)
-- =====================================================

CREATE TABLE sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Device info
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'

  -- Sync tracking
  last_sync_at TIMESTAMP,
  last_sync_version BIGINT,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_sync_devices_user (user_id),
  INDEX idx_sync_devices_device_id (device_id)
);

COMMENT ON TABLE sync_devices IS 'Tracks user devices for sync relay (encrypted data only)';

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  data_type VARCHAR(20), -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id)
);

COMMENT ON TABLE system_settings IS 'System-wide configuration settings';

-- Example settings
INSERT INTO system_settings (key, value, data_type, description) VALUES
  ('trial_duration_days', '14', 'number', 'Default trial duration per product'),
  ('support_session_duration_hours', '24', 'number', 'Support session expiry (hours)'),
  ('max_recovery_codes', '5', 'number', 'Number of recovery codes per user'),
  ('charity_payout_frequency', 'quarterly', 'string', 'How often to pay charities (monthly, quarterly, annual)');

-- =====================================================
-- VIEWS (For easier querying)
-- =====================================================

-- Active subscriptions with product details
CREATE VIEW active_user_products AS
SELECT
  up.user_id,
  u.email,
  u.support_key,
  p.slug AS product_slug,
  p.name AS product_name,
  up.status,
  up.trial_ends_at,
  up.activated_at,
  up.stripe_subscription_id
FROM user_products up
JOIN users u ON up.user_id = u.id
JOIN products p ON up.product_id = p.id
WHERE up.status IN ('trial', 'active')
ORDER BY u.email, p.display_order;

-- Charity donations owed (unpaid)
CREATE VIEW charity_donations_owed AS
SELECT
  c.id AS charity_id,
  c.name AS charity_name,
  COUNT(p.id) AS payment_count,
  SUM(p.charity_amount) AS total_owed
FROM charities c
JOIN payments p ON p.charity_id = c.id
WHERE p.charity_paid = false
  AND p.status = 'succeeded'
GROUP BY c.id, c.name
ORDER BY total_owed DESC;

-- Affiliate performance
CREATE VIEW affiliate_performance AS
SELECT
  a.id AS affiliate_id,
  a.code,
  a.name,
  COUNT(ac.id) AS total_conversions,
  SUM(ac.first_payment_amount) AS total_revenue_generated,
  SUM(ac.commission_earned) AS total_commission_earned,
  SUM(CASE WHEN ac.commission_paid = false THEN ac.commission_earned ELSE 0 END) AS commission_owed
FROM affiliates a
LEFT JOIN affiliate_conversions ac ON a.id = ac.affiliate_id
GROUP BY a.id, a.code, a.name
ORDER BY total_conversions DESC;

-- User lifetime value
CREATE VIEW user_lifetime_value AS
SELECT
  u.id AS user_id,
  u.email,
  u.support_key,
  COUNT(DISTINCT up.product_id) AS products_owned,
  COUNT(p.id) AS payment_count,
  SUM(p.total_amount) AS total_paid,
  MIN(p.paid_at) AS first_payment_date,
  MAX(p.paid_at) AS last_payment_date
FROM users u
LEFT JOIN user_products up ON u.id = up.user_id
LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'succeeded'
GROUP BY u.id, u.email, u.support_key;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate unique support key (AM-XXXX-XXXX-XXXX)
CREATE OR REPLACE FUNCTION generate_support_key()
RETURNS VARCHAR(20) AS $$
DECLARE
  key VARCHAR(20);
  exists BOOLEAN;
BEGIN
  LOOP
    key := 'AM-' ||
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    SELECT EXISTS(SELECT 1 FROM users WHERE support_key = key) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;

  RETURN key;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate support key on user insert
CREATE OR REPLACE FUNCTION set_support_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.support_key IS NULL THEN
    NEW.support_key := generate_support_key();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_support_key
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_support_key();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_charities_updated_at BEFORE UPDATE ON charities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_affiliates_updated_at BEFORE UPDATE ON affiliates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_payments_user_status ON payments(user_id, status);
CREATE INDEX idx_payments_charity_unpaid ON payments(charity_id, charity_paid) WHERE charity_paid = false;
CREATE INDEX idx_user_products_user_status ON user_products(user_id, status);
CREATE INDEX idx_user_charity_current ON user_charity_selections(user_id) WHERE effective_until IS NULL;

-- =====================================================
-- CONSTRAINTS
-- =====================================================

-- Ensure charity donation amounts make sense
ALTER TABLE payments ADD CONSTRAINT check_payment_amounts
  CHECK (total_amount = charity_amount + revenue_amount);

-- Ensure trial ends in future
ALTER TABLE user_products ADD CONSTRAINT check_trial_future
  CHECK (trial_ends_at IS NULL OR trial_ends_at > created_at);

-- Ensure discount values are positive
ALTER TABLE discount_codes ADD CONSTRAINT check_discount_positive
  CHECK (discount_value IS NULL OR discount_value > 0);

```

---

## Database Migrations Strategy

### Migration Tool Recommendation: **Kysely**
- TypeScript-native query builder
- Type-safe migrations
- Works great with Bun
- No ORM overhead

### Migration File Structure:
```
src/db/migrations/
├── 001_initial_schema.sql
├── 002_add_charities.sql
├── 003_add_affiliates.sql
└── ...
```

---

## Key Relationships

```
users (1) ----< (many) user_products
users (1) ----< (many) payments
users (1) ----< (many) user_charity_selections
users (1) ----< (many) support_sessions

products (1) ----< (many) user_products
products (1) ----< (many) payments

charities (1) ----< (many) user_charity_selections
charities (1) ----< (many) payments
charities (1) ----< (many) charity_payouts

affiliates (1) ----< (many) affiliate_conversions

admin_users (1) ----< (many) admin_audit_log
admin_users (1) ----< (many) support_sessions (accessed_by)
```

---

## Data Retention Policies

| Table | Retention | Notes |
|-------|-----------|-------|
| `users` | Indefinite | Even after account deletion, anonymize but keep for accounting |
| `payments` | 7 years | Legal requirement for financial records |
| `user_products` | Indefinite | Subscription history |
| `support_sessions` | 1 year | Audit trail |
| `admin_audit_log` | 7 years | Legal/compliance |
| `email_verification_tokens` | 7 days | Auto-delete after use or expiry |
| `password_reset_tokens` | 1 hour | Auto-delete after use or expiry |

---

## Backup Strategy

**Frequency:**
- Automated daily backups (Digital Ocean managed PostgreSQL)
- Point-in-time recovery (PITR) enabled
- 30-day retention for daily backups
- 7-day retention for PITR

**Testing:**
- Monthly restore testing to verify backups work
- Disaster recovery plan documented

---

## Next Steps

1. See **ROADMAPS_API.md** for how this data is accessed via endpoints
2. See **ROADMAPS_STRIPE.md** for how payments populate this schema
3. See **ROADMAPS_DEPLOYMENT.md** for setting up PostgreSQL on Digital Ocean

---

**Last Updated:** 2026-03-20
