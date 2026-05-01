-- Migration 013: Add brand color fields to charities table
-- Allows admins to customize each charity's visual appearance with their official brand colors

ALTER TABLE charities
ADD COLUMN IF NOT EXISTS "brandColorBackground" TEXT,
ADD COLUMN IF NOT EXISTS "brandColorTitle" TEXT,
ADD COLUMN IF NOT EXISTS "brandColorDescription" TEXT;

COMMENT ON COLUMN charities."brandColorBackground" IS 'Hex color code for charity card background (e.g., #4BA9A0)';
COMMENT ON COLUMN charities."brandColorTitle" IS 'Hex color code for charity title/name text (e.g., #FFFFFF)';
COMMENT ON COLUMN charities."brandColorDescription" IS 'Hex color code for charity description text (e.g., #FFFFFF)';
