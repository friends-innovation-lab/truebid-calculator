-- Phase 6A: Proposal Columns & Charge Codes
-- Add notes, tags columns; create proposal_charge_codes table
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS proposal_charge_codes CASCADE;
--   ALTER TABLE proposals DROP COLUMN IF EXISTS notes;
--   ALTER TABLE proposals DROP COLUMN IF EXISTS tags;
--   -- Note: due_date already exists as DATE, keep it

-- =============================================================================
-- PROPOSALS TABLE ENHANCEMENTS
-- =============================================================================

-- Add notes column for free-form proposal notes
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add tags array for categorization/filtering
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Upgrade due_date from DATE to TIMESTAMPTZ if needed
-- Note: This is a type change, so we need to handle it carefully
-- First check if it's still DATE type
DO $$
BEGIN
  -- If due_date is DATE, convert to TIMESTAMPTZ
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals'
    AND column_name = 'due_date'
    AND data_type = 'date'
  ) THEN
    ALTER TABLE proposals ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::TIMESTAMPTZ;
  END IF;
END $$;

-- Index for tags (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_proposals_tags ON proposals USING GIN (tags);

-- =============================================================================
-- PROPOSAL CHARGE CODES TABLE
-- =============================================================================

CREATE TABLE proposal_charge_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wbs_task_id UUID REFERENCES wbs_tasks(id) ON DELETE SET NULL,

  code TEXT NOT NULL,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_charge_code_per_proposal UNIQUE (proposal_id, code)
);

CREATE INDEX idx_charge_codes_proposal ON proposal_charge_codes(proposal_id);
CREATE INDEX idx_charge_codes_tenant ON proposal_charge_codes(tenant_id);
CREATE INDEX idx_charge_codes_task ON proposal_charge_codes(wbs_task_id);

-- Triggers
CREATE TRIGGER proposal_charge_codes_updated_at
  BEFORE UPDATE ON proposal_charge_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE proposal_charge_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY charge_codes_tenant_isolation ON proposal_charge_codes
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN proposals.notes IS 'Free-form notes for the proposal';
COMMENT ON COLUMN proposals.tags IS 'Array of tags for categorization and filtering';
COMMENT ON TABLE proposal_charge_codes IS 'Charge codes for proposal cost tracking, optionally linked to WBS tasks';
