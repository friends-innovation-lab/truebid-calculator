-- Phase 5: Staffing Pricing Columns
-- Adds labor catalog link and pricing override columns to staffing_assignments
--
-- ROLLBACK:
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS labor_category_id;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS level_key;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS step_index;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS salary_override_cents;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS bill_rate_override_cents;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS profit_margin_override;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS rate_source;
--   DROP TYPE IF EXISTS rate_source_type CASCADE;

-- =============================================================================
-- RATE SOURCE ENUM
-- =============================================================================

CREATE TYPE rate_source_type AS ENUM (
  'catalog',        -- Salary from tenant labor catalog
  'manual',         -- Manually entered salary/rate
  'gsa_schedule',   -- GSA schedule rate
  'subcontractor'   -- Subcontractor quote
);

-- =============================================================================
-- ADD PRICING COLUMNS TO STAFFING_ASSIGNMENTS
-- =============================================================================

ALTER TABLE staffing_assignments
  -- Labor catalog link (nullable - can be unmapped)
  ADD COLUMN IF NOT EXISTS labor_category_id UUID REFERENCES tenant_labor_categories(id) ON DELETE SET NULL,

  -- Level/step selection within catalog category
  ADD COLUMN IF NOT EXISTS level_key TEXT,        -- 'IC1', 'IC2', etc.
  ADD COLUMN IF NOT EXISTS step_index INTEGER,    -- 0-based step index

  -- Override columns (in cents for precision, NULL = use catalog/computed)
  ADD COLUMN IF NOT EXISTS salary_override_cents BIGINT,
  ADD COLUMN IF NOT EXISTS bill_rate_override_cents BIGINT,
  ADD COLUMN IF NOT EXISTS profit_margin_override NUMERIC(5, 4),

  -- Rate source tracking
  ADD COLUMN IF NOT EXISTS rate_source rate_source_type;

-- =============================================================================
-- CONSTRAINTS
-- =============================================================================

-- Level/step only valid with a labor category
ALTER TABLE staffing_assignments
  ADD CONSTRAINT level_requires_category CHECK (
    level_key IS NULL OR labor_category_id IS NOT NULL
  );

ALTER TABLE staffing_assignments
  ADD CONSTRAINT step_requires_level CHECK (
    step_index IS NULL OR level_key IS NOT NULL
  );

-- Step index must be non-negative
ALTER TABLE staffing_assignments
  ADD CONSTRAINT step_index_non_negative CHECK (
    step_index IS NULL OR step_index >= 0
  );

-- Salary override must be positive
ALTER TABLE staffing_assignments
  ADD CONSTRAINT salary_override_positive CHECK (
    salary_override_cents IS NULL OR salary_override_cents > 0
  );

-- Bill rate override must be positive
ALTER TABLE staffing_assignments
  ADD CONSTRAINT bill_rate_override_positive CHECK (
    bill_rate_override_cents IS NULL OR bill_rate_override_cents > 0
  );

-- Profit margin must be in valid range (0-100%)
ALTER TABLE staffing_assignments
  ADD CONSTRAINT profit_margin_valid CHECK (
    profit_margin_override IS NULL OR (profit_margin_override >= 0 AND profit_margin_override <= 1)
  );

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_staffing_labor_category ON staffing_assignments(labor_category_id);
CREATE INDEX IF NOT EXISTS idx_staffing_rate_source ON staffing_assignments(rate_source);

-- =============================================================================
-- HELPER FUNCTION: Get effective salary for a staffing assignment
-- =============================================================================
-- Returns salary in cents. Prefers override, then catalog lookup.

CREATE OR REPLACE FUNCTION get_staffing_effective_salary_cents(v_assignment_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_assignment RECORD;
  v_catalog_salary INTEGER;
BEGIN
  SELECT
    salary_override_cents,
    labor_category_id,
    level_key,
    step_index
  INTO v_assignment
  FROM staffing_assignments
  WHERE id = v_assignment_id;

  -- 1. Override takes precedence
  IF v_assignment.salary_override_cents IS NOT NULL THEN
    RETURN v_assignment.salary_override_cents;
  END IF;

  -- 2. Catalog lookup
  IF v_assignment.labor_category_id IS NOT NULL AND v_assignment.level_key IS NOT NULL THEN
    v_catalog_salary := get_labor_category_salary(
      v_assignment.labor_category_id,
      v_assignment.level_key,
      COALESCE(v_assignment.step_index, 0)
    );

    IF v_catalog_salary IS NOT NULL THEN
      RETURN v_catalog_salary * 100; -- Convert dollars to cents
    END IF;
  END IF;

  -- 3. No salary determinable
  RETURN NULL;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TYPE rate_source_type IS 'Source of pricing data: catalog, manual, gsa_schedule, or subcontractor';
COMMENT ON COLUMN staffing_assignments.labor_category_id IS 'Link to tenant labor catalog; NULL = unmapped role';
COMMENT ON COLUMN staffing_assignments.level_key IS 'Selected level within category (IC1, IC2, etc.)';
COMMENT ON COLUMN staffing_assignments.step_index IS '0-based step index within level';
COMMENT ON COLUMN staffing_assignments.salary_override_cents IS 'Manual salary override in cents; takes precedence over catalog';
COMMENT ON COLUMN staffing_assignments.bill_rate_override_cents IS 'Manual bill rate override in cents';
COMMENT ON COLUMN staffing_assignments.profit_margin_override IS 'Override profit margin (0.0-1.0)';
COMMENT ON COLUMN staffing_assignments.rate_source IS 'Indicates how pricing was determined';
COMMENT ON FUNCTION get_staffing_effective_salary_cents(UUID) IS 'Returns effective salary: override > catalog > NULL';
