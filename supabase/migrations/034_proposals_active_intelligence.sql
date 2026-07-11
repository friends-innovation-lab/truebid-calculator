-- Phase 2: Add active_intelligence_version_id to proposals
-- Links proposals to their currently active (confirmed) intelligence version
--
-- ROLLBACK:
--   ALTER TABLE proposals DROP COLUMN IF EXISTS active_intelligence_version_id;

-- =============================================================================
-- ADD ACTIVE INTELLIGENCE VERSION FK
-- =============================================================================

ALTER TABLE proposals
  ADD COLUMN active_intelligence_version_id UUID
    REFERENCES intelligence_versions(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX idx_proposals_active_intelligence
  ON proposals(active_intelligence_version_id)
  WHERE active_intelligence_version_id IS NOT NULL;

-- =============================================================================
-- CONSTRAINT: Active version must be confirmed
-- =============================================================================
-- This is enforced at the application layer (command) rather than DB trigger
-- because the confirmation process sets both the status and the FK atomically.
-- A deferred constraint could work but adds complexity.

-- =============================================================================
-- CONSTRAINT: Active version must belong to this proposal
-- =============================================================================
-- Enforce that active_intelligence_version_id references a version that
-- actually belongs to this proposal.

CREATE OR REPLACE FUNCTION check_active_intelligence_version_ownership()
RETURNS TRIGGER AS $$
DECLARE
  version_proposal_id UUID;
BEGIN
  IF NEW.active_intelligence_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT proposal_id INTO version_proposal_id
  FROM intelligence_versions
  WHERE id = NEW.active_intelligence_version_id;

  IF version_proposal_id IS NULL THEN
    -- Let FK constraint handle missing version
    RETURN NEW;
  END IF;

  IF version_proposal_id != NEW.id THEN
    RAISE EXCEPTION 'active_intelligence_version_id must reference a version belonging to this proposal (proposal: %, version proposal: %)',
      NEW.id, version_proposal_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_active_intelligence_version_ownership
  BEFORE INSERT OR UPDATE OF active_intelligence_version_id ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION check_active_intelligence_version_ownership();

-- Comments
COMMENT ON COLUMN proposals.active_intelligence_version_id IS 'Currently active (confirmed) intelligence version for WBS generation';
