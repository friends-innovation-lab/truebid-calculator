-- Phase 3: Staffing Assignments Table
-- Per-task, per-period labor allocations with discipline binding
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS staffing_assignments CASCADE;
--   DROP TYPE IF EXISTS staffing_source CASCADE;
--   DROP TYPE IF EXISTS prime_or_sub CASCADE;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE staffing_source AS ENUM ('generated', 'user_added');
CREATE TYPE prime_or_sub AS ENUM ('prime', 'sub');

-- =============================================================================
-- STAFFING ASSIGNMENTS TABLE
-- =============================================================================
-- Each assignment represents labor allocation for a specific role on a specific
-- task for a specific period. This replaces the laborEstimates array.

CREATE TABLE staffing_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Parent task
  wbs_task_id UUID NOT NULL REFERENCES wbs_tasks(id) ON DELETE CASCADE,

  -- Role identification (TEXT now, tenant labor catalog Phase 5)
  role_title TEXT NOT NULL,
  discipline TEXT NOT NULL,           -- Must match intelligence_disciplines

  -- FAR requirement: prime or subcontractor
  prime_or_sub prime_or_sub NOT NULL,
  subcontractor_name TEXT,            -- Required when prime_or_sub = 'sub'

  -- Hours allocation
  period_label TEXT NOT NULL,         -- Matches intelligence_periods.name
  hours NUMERIC(10, 2) NOT NULL CHECK (hours >= 0),
  hours_per_month NUMERIC(8, 2),

  -- Notes and rationale
  rationale TEXT,

  -- Provenance
  source staffing_source NOT NULL DEFAULT 'generated',
  user_modified BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1,

  -- Constraint: subcontractor_name required when sub
  CONSTRAINT sub_requires_name CHECK (
    prime_or_sub != 'sub' OR subcontractor_name IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_staffing_task ON staffing_assignments(wbs_task_id);
CREATE INDEX idx_staffing_role ON staffing_assignments(role_title);
CREATE INDEX idx_staffing_period ON staffing_assignments(period_label);
CREATE INDEX idx_staffing_discipline ON staffing_assignments(discipline);
CREATE INDEX idx_staffing_task_role ON staffing_assignments(wbs_task_id, role_title);

-- =============================================================================
-- ROW VERSION + UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER staffing_assignments_row_version
  BEFORE UPDATE ON staffing_assignments
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

CREATE OR REPLACE FUNCTION v_update_staffing_assignments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staffing_assignments_updated_at
  BEFORE UPDATE ON staffing_assignments
  FOR EACH ROW
  EXECUTE FUNCTION v_update_staffing_assignments_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE staffing_assignments IS 'Per-task, per-period labor allocations replacing laborEstimates arrays';
COMMENT ON COLUMN staffing_assignments.role_title IS 'Role name (tenant labor catalog FK in Phase 5)';
COMMENT ON COLUMN staffing_assignments.discipline IS 'Must match intelligence_disciplines for the WBS version';
COMMENT ON COLUMN staffing_assignments.prime_or_sub IS 'FAR requirement: prime contractor or subcontractor labor';
COMMENT ON COLUMN staffing_assignments.period_label IS 'Matches intelligence_periods.name (e.g., "Base Period")';
COMMENT ON COLUMN staffing_assignments.hours IS 'Total hours for this role on this task in this period';
COMMENT ON COLUMN staffing_assignments.hours_per_month IS 'Optional monthly utilization rate';
COMMENT ON COLUMN staffing_assignments.source IS 'generated = from AI, user_added = manually created';
COMMENT ON COLUMN staffing_assignments.user_modified IS 'True if user has edited a generated assignment';
