-- ============================================================================
-- Add years_experience, education, and education_substitution columns to gsa_rates
-- ============================================================================

ALTER TABLE gsa_rates
  ADD COLUMN IF NOT EXISTS years_experience INTEGER,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS education_substitution TEXT;
