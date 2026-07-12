-- Phase 5: Intelligence Labor Category FK
-- Adds labor_category_id to intelligence_labor_requirements for matched roles
--
-- ROLLBACK:
--   ALTER TABLE intelligence_labor_requirements DROP COLUMN IF EXISTS labor_category_id;
--   ALTER TABLE intelligence_labor_requirements DROP COLUMN IF EXISTS match_type;
--   ALTER TABLE intelligence_labor_requirements DROP COLUMN IF EXISTS match_confidence;

-- =============================================================================
-- ADD LABOR CATEGORY COLUMNS
-- =============================================================================
-- When extraction matches a role title to a catalog entry, these columns capture the match.
-- NULL labor_category_id = unmapped (first-class outcome, not an error).

ALTER TABLE intelligence_labor_requirements
  ADD COLUMN IF NOT EXISTS labor_category_id UUID REFERENCES tenant_labor_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('exact', 'alias', 'fuzzy', 'unmapped')),
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3, 2);

-- =============================================================================
-- INDEX
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_labor_reqs_category ON intelligence_labor_requirements(labor_category_id);
CREATE INDEX IF NOT EXISTS idx_labor_reqs_unmapped ON intelligence_labor_requirements(version_id)
  WHERE labor_category_id IS NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN intelligence_labor_requirements.labor_category_id IS 'Matched labor category; NULL = unmapped role (valid outcome)';
COMMENT ON COLUMN intelligence_labor_requirements.match_type IS 'How the role title was matched: exact, alias, fuzzy, or unmapped';
COMMENT ON COLUMN intelligence_labor_requirements.match_confidence IS 'Match confidence score (0.0-1.0)';
