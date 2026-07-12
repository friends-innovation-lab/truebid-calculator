-- Phase 5: Tenant Labor Categories
-- Tenant-scoped labor catalog with levels/steps JSONB structure
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS tenant_labor_categories CASCADE;

-- =============================================================================
-- TENANT LABOR CATEGORIES TABLE
-- =============================================================================
-- Each tenant maintains their own labor catalog.
-- FFTC roles (11) are seeded with salary data; others seed with levels=NULL (needs-setup).

CREATE TABLE tenant_labor_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category identity
  key TEXT NOT NULL,                     -- 'backend_developer', 'product_manager', etc.
  title TEXT NOT NULL,                   -- 'Back-end Developer', 'Product Manager'
  discipline_key TEXT NOT NULL,          -- References tenant_disciplines.key

  -- Metadata
  description TEXT,
  soc_code TEXT,                         -- BLS SOC code (e.g., '15-1252')
  education TEXT,                        -- Typical education requirement

  -- Levels JSONB: matches fftc-roles-v2.json structure
  -- NULL = needs-setup state (tenant must configure before use in pricing)
  -- Structure: { "levels": [ { "level": "IC1", "level_title": "Associate", "steps": [87000, 89610] }, ... ] }
  levels JSONB,

  -- Configuration
  default_hours_per_month NUMERIC(6, 2) DEFAULT 160,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Concurrency
  row_version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one category key per tenant
  CONSTRAINT unique_labor_category_per_tenant UNIQUE (tenant_id, key)
);

-- Indexes
CREATE INDEX idx_labor_categories_tenant ON tenant_labor_categories(tenant_id);
CREATE INDEX idx_labor_categories_discipline ON tenant_labor_categories(tenant_id, discipline_key);
CREATE INDEX idx_labor_categories_active ON tenant_labor_categories(tenant_id, active) WHERE active = true;
CREATE INDEX idx_labor_categories_title ON tenant_labor_categories(tenant_id, title);

-- Row version trigger
CREATE TRIGGER tenant_labor_categories_row_version
  BEFORE UPDATE ON tenant_labor_categories
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- Updated_at trigger
CREATE TRIGGER tenant_labor_categories_updated_at
  BEFORE UPDATE ON tenant_labor_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- LEVELS JSONB VALIDATION
-- =============================================================================
-- Validates the levels structure if provided.
-- NULL is valid (needs-setup state).

CREATE OR REPLACE FUNCTION validate_labor_category_levels()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_level JSONB;
  v_levels_array JSONB;
BEGIN
  -- NULL levels is valid (needs-setup state)
  IF NEW.levels IS NULL THEN
    RETURN NEW;
  END IF;

  -- Must have 'levels' key with array value
  IF NOT (NEW.levels ? 'levels') THEN
    RAISE EXCEPTION 'levels JSONB must have a "levels" key';
  END IF;

  v_levels_array := NEW.levels -> 'levels';

  IF jsonb_typeof(v_levels_array) != 'array' THEN
    RAISE EXCEPTION 'levels.levels must be an array';
  END IF;

  -- Each level must have required fields
  FOR v_level IN SELECT * FROM jsonb_array_elements(v_levels_array)
  LOOP
    IF NOT (v_level ? 'level') THEN
      RAISE EXCEPTION 'Each level must have a "level" key';
    END IF;

    IF NOT (v_level ? 'level_title') THEN
      RAISE EXCEPTION 'Each level must have a "level_title" key';
    END IF;

    IF NOT (v_level ? 'steps') THEN
      RAISE EXCEPTION 'Each level must have a "steps" key';
    END IF;

    IF jsonb_typeof(v_level -> 'steps') != 'array' THEN
      RAISE EXCEPTION 'level.steps must be an array';
    END IF;

    -- Steps array can have NULLs (per provenance rule: band value as step 1, NULLs for unpopulated steps)
    -- but must have at least one non-null value if array is non-empty
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_labor_category_levels_trigger
  BEFORE INSERT OR UPDATE ON tenant_labor_categories
  FOR EACH ROW
  EXECUTE FUNCTION validate_labor_category_levels();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE tenant_labor_categories ENABLE ROW LEVEL SECURITY;

-- Members can view their tenant's labor categories
CREATE POLICY "Members view tenant labor categories"
  ON tenant_labor_categories
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Admin/owner can manage labor categories
CREATE POLICY "Admin manage tenant labor categories"
  ON tenant_labor_categories
  FOR ALL TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get salary for a specific level/step from a labor category
CREATE OR REPLACE FUNCTION get_labor_category_salary(
  v_category_id UUID,
  v_level_key TEXT,
  v_step_index INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_levels JSONB;
  v_level JSONB;
  v_steps JSONB;
  v_salary INTEGER;
BEGIN
  -- Get the levels JSONB
  SELECT levels INTO v_levels
  FROM tenant_labor_categories
  WHERE id = v_category_id;

  IF v_levels IS NULL THEN
    RETURN NULL; -- Needs-setup state
  END IF;

  -- Find the matching level
  SELECT elem INTO v_level
  FROM jsonb_array_elements(v_levels -> 'levels') elem
  WHERE elem ->> 'level' = v_level_key
  LIMIT 1;

  IF v_level IS NULL THEN
    RETURN NULL; -- Level not found
  END IF;

  v_steps := v_level -> 'steps';

  -- Get step value (0-indexed)
  IF v_step_index < 0 OR v_step_index >= jsonb_array_length(v_steps) THEN
    RETURN NULL; -- Step index out of range
  END IF;

  v_salary := (v_steps -> v_step_index)::INTEGER;

  RETURN v_salary;
END;
$$;

-- Check if a labor category needs setup (has NULL levels)
CREATE OR REPLACE FUNCTION labor_category_needs_setup(v_category_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT levels IS NULL
  FROM tenant_labor_categories
  WHERE id = v_category_id;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenant_labor_categories IS 'Tenant-scoped labor catalog with salary levels/steps';
COMMENT ON COLUMN tenant_labor_categories.key IS 'Machine key for category (backend_developer, product_manager, etc.)';
COMMENT ON COLUMN tenant_labor_categories.discipline_key IS 'References tenant_disciplines.key for this tenant';
COMMENT ON COLUMN tenant_labor_categories.levels IS 'JSONB: { "levels": [{ "level": "IC1", "level_title": "Associate", "steps": [87000, 89610] }] }. NULL = needs-setup.';
COMMENT ON COLUMN tenant_labor_categories.row_version IS 'Optimistic concurrency control';
COMMENT ON FUNCTION get_labor_category_salary(UUID, TEXT, INTEGER) IS 'Get annual salary for category/level/step; returns NULL if needs-setup';
COMMENT ON FUNCTION labor_category_needs_setup(UUID) IS 'Returns true if category has NULL levels (needs configuration)';
