-- Migration: 034_create_user_tags_table.sql
-- Description: Internal tags for categorizing users (CRM-like functionality)
-- Tags are visible only to admin staff, not to users

CREATE TABLE user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tag (lowercase, no spaces - use hyphens)
  tag VARCHAR(50) NOT NULL,

  -- Who added it
  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user can only have each tag once
  UNIQUE(user_id, tag)
);

-- Indexes for common queries
CREATE INDEX idx_user_tags_user ON user_tags(user_id);
CREATE INDEX idx_user_tags_tag ON user_tags(tag);

-- Comments
COMMENT ON TABLE user_tags IS 'Internal tags for categorizing users - e.g., VIP, needs-followup, technical-issues';
COMMENT ON COLUMN user_tags.tag IS 'Tag name (lowercase, hyphenated) - e.g., vip, case-study-candidate, bakery';

-- Create a view for common tag statistics
CREATE OR REPLACE VIEW user_tag_stats AS
SELECT
  tag,
  COUNT(*) as user_count,
  MAX(created_at) as last_used_at
FROM user_tags
GROUP BY tag
ORDER BY user_count DESC;

COMMENT ON VIEW user_tag_stats IS 'Statistics for each tag - useful for autocomplete and management';
