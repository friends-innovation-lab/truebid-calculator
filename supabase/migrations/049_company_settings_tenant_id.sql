-- Phase 5: Company Settings Tenant Link + Writing Voice
-- Adds tenant_id to company_settings and writing-voice columns
--
-- ROLLBACK:
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS tenant_id;
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS voice_description;
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS reading_level;
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS words_to_avoid;

-- =============================================================================
-- ADD TENANT_ID COLUMN
-- =============================================================================
-- Links company_settings directly to tenant for scoping queries.
-- Backfilled from tenants.company_id join.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- =============================================================================
-- ADD WRITING VOICE COLUMNS
-- =============================================================================
-- Tenant-specific writing preferences for AI-generated content.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS voice_description TEXT,
  ADD COLUMN IF NOT EXISTS reading_level TEXT CHECK (reading_level IN ('grade_8', 'grade_10', 'grade_12', 'professional')),
  ADD COLUMN IF NOT EXISTS words_to_avoid TEXT[];

-- =============================================================================
-- BACKFILL TENANT_ID
-- =============================================================================
-- Join through tenants.company_id to populate tenant_id

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE company_settings cs
  SET tenant_id = t.id
  FROM tenants t
  WHERE t.company_id = cs.company_id
    AND cs.tenant_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled tenant_id for % company_settings rows', v_count;
END $$;

-- =============================================================================
-- ADD INDEX
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_company_settings_tenant ON company_settings(tenant_id);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN company_settings.tenant_id IS 'Direct link to tenant for scoped queries';
COMMENT ON COLUMN company_settings.voice_description IS 'Description of company writing voice/tone for AI generation';
COMMENT ON COLUMN company_settings.reading_level IS 'Target reading level: grade_8, grade_10, grade_12, professional';
COMMENT ON COLUMN company_settings.words_to_avoid IS 'Array of words/phrases to avoid in generated content';
