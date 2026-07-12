-- Phase 5: Labor Category Aliases
-- Enables role title matching via aliases (e.g., "HCD Lead" -> ux_researcher)
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS labor_category_aliases CASCADE;

-- =============================================================================
-- LABOR CATEGORY ALIASES TABLE
-- =============================================================================
-- Maps alternative role titles to canonical labor categories.
-- Used during RFP extraction to resolve extracted titles to catalog entries.

CREATE TABLE labor_category_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_category_id UUID NOT NULL REFERENCES tenant_labor_categories(id) ON DELETE CASCADE,

  -- Alias details
  alias TEXT NOT NULL,                   -- 'HCD Lead', 'Scrum Master', etc.
  context_note TEXT,                     -- Disambiguation guidance for umbrella aliases

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one alias per category (case-insensitive matching done at app layer)
  CONSTRAINT unique_alias_per_category UNIQUE (labor_category_id, alias)
);

-- Indexes
CREATE INDEX idx_labor_aliases_category ON labor_category_aliases(labor_category_id);
CREATE INDEX idx_labor_aliases_alias ON labor_category_aliases(alias);
CREATE INDEX idx_labor_aliases_alias_lower ON labor_category_aliases(LOWER(alias));

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Inherit access from parent labor category's tenant

ALTER TABLE labor_category_aliases ENABLE ROW LEVEL SECURITY;

-- Helper function to get tenant from labor category
CREATE OR REPLACE FUNCTION get_labor_category_tenant(v_category_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_labor_categories WHERE id = v_category_id;
$$;

-- Members can view aliases for their tenant's categories
CREATE POLICY "Members view labor category aliases"
  ON labor_category_aliases
  FOR SELECT TO authenticated
  USING (is_tenant_member(get_labor_category_tenant(labor_category_id)));

-- Admin/owner can manage aliases
CREATE POLICY "Admin manage labor category aliases"
  ON labor_category_aliases
  FOR ALL TO authenticated
  USING (is_tenant_admin(get_labor_category_tenant(labor_category_id)))
  WITH CHECK (is_tenant_admin(get_labor_category_tenant(labor_category_id)));

-- =============================================================================
-- ALIAS RESOLUTION FUNCTION
-- =============================================================================
-- Resolves a role title to a labor category within a tenant.
-- Returns: category_id, match_type ('exact', 'alias', 'fuzzy', 'unmapped'), confidence

CREATE TYPE labor_category_match AS (
  category_id UUID,
  match_type TEXT,
  confidence NUMERIC(3, 2)
);

CREATE OR REPLACE FUNCTION resolve_labor_category(
  v_tenant_id UUID,
  v_role_title TEXT
)
RETURNS labor_category_match
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result labor_category_match;
  v_normalized_title TEXT;
BEGIN
  v_normalized_title := LOWER(TRIM(v_role_title));

  -- 1. Exact title match
  SELECT id, 'exact'::TEXT, 1.0::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM tenant_labor_categories
  WHERE tenant_id = v_tenant_id
    AND active = true
    AND LOWER(title) = v_normalized_title
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 2. Alias match
  SELECT lc.id, 'alias'::TEXT, 0.95::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM labor_category_aliases lca
  JOIN tenant_labor_categories lc ON lc.id = lca.labor_category_id
  WHERE lc.tenant_id = v_tenant_id
    AND lc.active = true
    AND LOWER(lca.alias) = v_normalized_title
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 3. Fuzzy match (contains or similar) - lower confidence
  -- First try: input contains category title
  SELECT id, 'fuzzy'::TEXT, 0.70::NUMERIC(3,2)
  INTO v_result.category_id, v_result.match_type, v_result.confidence
  FROM tenant_labor_categories
  WHERE tenant_id = v_tenant_id
    AND active = true
    AND (
      v_normalized_title LIKE '%' || LOWER(title) || '%'
      OR LOWER(title) LIKE '%' || v_normalized_title || '%'
    )
  ORDER BY LENGTH(title) DESC  -- Prefer longer matches
  LIMIT 1;

  IF v_result.category_id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- 4. No match found
  v_result.category_id := NULL;
  v_result.match_type := 'unmapped';
  v_result.confidence := 0.0;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE labor_category_aliases IS 'Alternative titles that map to canonical labor categories';
COMMENT ON COLUMN labor_category_aliases.alias IS 'Alternative role title (HCD Lead, Scrum Master, etc.)';
COMMENT ON COLUMN labor_category_aliases.context_note IS 'Disambiguation guidance for umbrella aliases like HCD Lead';
COMMENT ON TYPE labor_category_match IS 'Result of role title resolution: category_id, match_type, confidence';
COMMENT ON FUNCTION resolve_labor_category(UUID, TEXT) IS 'Resolves role title to labor category with match type and confidence';
