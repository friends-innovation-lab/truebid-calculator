-- ============================================================================
-- Migration 030: Fix indirect rate defaults in company_settings
-- ============================================================================
--
-- Problem: Schema defaults of 0.35/0.15/0.08 for fringe/overhead/ga are wrong.
-- These are plausible-looking but incorrect values that silently substitute
-- for real rates — the same anti-pattern we prohibited at the application layer.
--
-- Fix:
-- 1. Update existing rows that have the wrong defaults to correct FY2026 rates
-- 2. Change schema defaults to NULL to force explicit setup for new tenants
--
-- Impact: This migration updates rate data. Rows with rates matching the known
-- wrong defaults (0.35/0.15/0.08) are corrected. Rows with intentionally set
-- rates (any other values) are left unchanged.
-- ============================================================================

-- Step 1: Update existing rows that have the wrong schema defaults
-- Only update rows where ALL THREE rates match the wrong defaults
-- (to avoid accidentally changing intentionally-set rates)
UPDATE company_settings
SET
  fringe_rate = 0.2116,
  overhead_rate = 0.3426,
  ga_rate = 0.1983,
  updated_at = NOW()
WHERE
  fringe_rate = 0.35
  AND overhead_rate = 0.15
  AND ga_rate = 0.08;

-- Step 2: Change column defaults to NULL
-- New tenant rows should require explicit rate setup, not use fake defaults
ALTER TABLE company_settings
  ALTER COLUMN fringe_rate DROP DEFAULT,
  ALTER COLUMN overhead_rate DROP DEFAULT,
  ALTER COLUMN ga_rate DROP DEFAULT;

-- Note: Columns remain NULLable. Application code must handle NULL rates
-- as a "rates not configured" state and prompt user to set them.
