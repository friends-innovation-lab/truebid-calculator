-- ============================================================================
-- Add remaining missing columns to companies table
-- ============================================================================

-- Basic info
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name TEXT;

-- Government registration fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sam_uei TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cage_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS duns TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ein TEXT;

-- NAICS codes as JSONB array
ALTER TABLE companies ADD COLUMN IF NOT EXISTS naics_codes JSONB DEFAULT '[]';
