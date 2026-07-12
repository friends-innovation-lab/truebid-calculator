-- Phase 5: Backfill Staffing Pricing
-- Migrates existing staffing_assignments to use labor catalog
-- NOTE: Actual backfill done via scripts/backfill-staffing-pricing.ts
--
-- This migration:
-- 1. Creates snapshot table for rate conservation verification
-- 2. Backfills discipline mappings (devops → engineering, management → delivery/program-management)
-- 3. Documents the backfill strategy
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS backfill_rate_snapshot CASCADE;

-- =============================================================================
-- RATE CONSERVATION SNAPSHOT TABLE
-- =============================================================================
-- Captures current pricing state before backfill for verification.

CREATE TABLE IF NOT EXISTS backfill_rate_snapshot (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES staffing_assignments(id) ON DELETE CASCADE,

  -- Context
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Current state
  role_title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  current_salary_cents BIGINT,           -- From working_data or roles table
  bill_rate_base_cents BIGINT,           -- Calculated bill rate (ground truth)
  selected_level TEXT,                   -- If known
  selected_step INTEGER,                 -- If known
  profit_margin NUMERIC(5, 4) NOT NULL DEFAULT 0.10,
  resolution_path TEXT NOT NULL,         -- 'working_data' | 'company_roles' | 'default'

  -- Indirect rates (for independent verification)
  fringe_rate NUMERIC(6, 4) NOT NULL,
  overhead_rate NUMERIC(6, 4) NOT NULL,
  ga_rate NUMERIC(6, 4) NOT NULL,

  -- Backfill results (populated after backfill)
  matched_category_id UUID,
  match_type TEXT,
  new_salary_cents BIGINT,
  new_bill_rate_cents BIGINT,
  has_override BOOLEAN DEFAULT false,
  discrepancy_cents BIGINT,

  -- Flags
  requires_manual_review BOOLEAN DEFAULT false,
  review_reason TEXT,

  -- Timestamps
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  backfill_at TIMESTAMPTZ,

  UNIQUE(assignment_id)
);

-- Index for finding issues
CREATE INDEX idx_snapshot_review ON backfill_rate_snapshot(requires_manual_review) WHERE requires_manual_review = true;
CREATE INDEX idx_snapshot_discrepancy ON backfill_rate_snapshot(discrepancy_cents) WHERE discrepancy_cents != 0;

-- =============================================================================
-- DISCIPLINE BACKFILL
-- =============================================================================
-- Per Phase 5 spec:
-- - devops → engineering (all cases)
-- - management → delivery (if title contains "Delivery")
-- - management → program-management (default for management)

DO $$
DECLARE
  v_devops_count INTEGER := 0;
  v_delivery_count INTEGER := 0;
  v_program_count INTEGER := 0;
BEGIN
  -- DevOps → Engineering (all cases)
  UPDATE staffing_assignments
  SET discipline = 'engineering'
  WHERE discipline = 'devops';
  GET DIAGNOSTICS v_devops_count = ROW_COUNT;

  -- Management → Delivery (title contains 'Delivery')
  UPDATE staffing_assignments
  SET discipline = 'delivery'
  WHERE discipline = 'management'
    AND (LOWER(role_title) LIKE '%delivery%');
  GET DIAGNOSTICS v_delivery_count = ROW_COUNT;

  -- Management → Program Management (default)
  UPDATE staffing_assignments
  SET discipline = 'program-management'
  WHERE discipline = 'management';
  GET DIAGNOSTICS v_program_count = ROW_COUNT;

  RAISE NOTICE 'Discipline backfill: devops→engineering: %, management→delivery: %, management→program-management: %',
    v_devops_count, v_delivery_count, v_program_count;
END $$;

-- =============================================================================
-- UPDATE INTELLIGENCE_DISCIPLINES CHECK CONSTRAINT
-- =============================================================================
-- Add new disciplines (data, security) to the CHECK constraint

ALTER TABLE intelligence_disciplines
  DROP CONSTRAINT IF EXISTS intelligence_disciplines_discipline_check;

ALTER TABLE intelligence_disciplines
  ADD CONSTRAINT intelligence_disciplines_discipline_check
  CHECK (discipline IN (
    'engineering', 'design', 'research', 'product', 'delivery',
    'program-management', 'content', 'accessibility', 'data', 'security'
  ));

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backfill_rate_snapshot IS 'Pre-backfill snapshot for rate conservation verification';
COMMENT ON COLUMN backfill_rate_snapshot.discrepancy_cents IS 'Difference between old and new bill rates; 0 = conserved';
COMMENT ON COLUMN backfill_rate_snapshot.requires_manual_review IS 'True if discipline was ambiguous or role unmapped';
