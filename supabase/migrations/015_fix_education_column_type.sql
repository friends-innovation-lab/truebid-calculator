-- ============================================================================
-- Change education column to JSONB to store structured data
-- ============================================================================

-- Convert existing TEXT data to JSONB
ALTER TABLE company_roles
  ALTER COLUMN education TYPE JSONB
  USING CASE
    WHEN education IS NULL THEN NULL
    WHEN education::text LIKE '{%' THEN education::jsonb
    ELSE jsonb_build_object('minimum', education)
  END;
