-- Migration: 033_create_user_notes_table.sql
-- Description: Internal support notes on users for CRM-like functionality
-- Notes are visible only to admin staff, not to users

CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Note content
  note TEXT NOT NULL,
  note_type VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (note_type IN (
    'general',    -- General observations
    'support',    -- Support interaction notes
    'billing',    -- Billing-related notes
    'technical'   -- Technical issues/troubleshooting
  )),

  -- Who created/modified it
  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_user_notes_user ON user_notes(user_id);
CREATE INDEX idx_user_notes_created ON user_notes(created_at DESC);
CREATE INDEX idx_user_notes_type ON user_notes(note_type);

-- Comments
COMMENT ON TABLE user_notes IS 'Internal support notes on users - not visible to users';
COMMENT ON COLUMN user_notes.note_type IS 'Category: general, support, billing, or technical';
COMMENT ON COLUMN user_notes.created_by_admin_id IS 'Admin who created this note';
