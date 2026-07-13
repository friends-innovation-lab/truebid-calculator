-- Phase UI Prep: Proposed Requirement Links
-- Adds status tracking to requirement_links for AI-proposed vs accepted links
-- Accepted links feed the citation gate for BOE generation
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS enforce_requirement_link_status_transition ON requirement_links;
--   DROP FUNCTION IF EXISTS check_requirement_link_status_transition();
--   DROP INDEX IF EXISTS idx_requirement_links_status;
--   ALTER TABLE requirement_links
--     DROP COLUMN IF EXISTS status,
--     DROP COLUMN IF EXISTS suggesting_evidence,
--     DROP COLUMN IF EXISTS proposed_at,
--     DROP COLUMN IF EXISTS resolved_at,
--     DROP COLUMN IF EXISTS resolved_by;
--   DROP TYPE IF EXISTS requirement_link_status CASCADE;

-- =============================================================================
-- STATUS ENUM
-- =============================================================================

CREATE TYPE requirement_link_status AS ENUM ('proposed', 'accepted', 'rejected');

-- =============================================================================
-- ADD COLUMNS TO REQUIREMENT_LINKS
-- =============================================================================

-- Add status column with 'accepted' as default so existing links remain valid
ALTER TABLE requirement_links
ADD COLUMN status requirement_link_status NOT NULL DEFAULT 'accepted';

-- Add evidence column for AI-proposed links
ALTER TABLE requirement_links
ADD COLUMN suggesting_evidence TEXT;

-- Add tracking columns
ALTER TABLE requirement_links
ADD COLUMN proposed_at TIMESTAMPTZ,
ADD COLUMN resolved_at TIMESTAMPTZ,
ADD COLUMN resolved_by UUID REFERENCES auth.users(id);

-- Index for efficient queries on proposed links
CREATE INDEX idx_requirement_links_status ON requirement_links(status) WHERE status = 'proposed';

-- =============================================================================
-- BC-3: STATUS TRANSITION TRIGGER
-- =============================================================================
-- Only proposed -> accepted|rejected transitions are permitted.
-- Once a link is accepted or rejected, its status cannot change.
-- This ensures the citation gate integrity: accepted links feed BOE generation.

CREATE OR REPLACE FUNCTION check_requirement_link_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Cannot change status of non-proposed links
  IF OLD.status != 'proposed' THEN
    RAISE EXCEPTION 'Cannot change status of non-proposed requirement link (id: %, current status: %)',
      OLD.id, OLD.status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Proposed links can only transition to accepted or rejected
  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Proposed links can only transition to accepted or rejected, not %', NEW.status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Auto-set resolved_at if not provided
  IF NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_requirement_link_status_transition
  BEFORE UPDATE OF status ON requirement_links
  FOR EACH ROW
  EXECUTE FUNCTION check_requirement_link_status_transition();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN requirement_links.status IS 'proposed: AI-suggested, pending review. accepted: user-approved, counts for citation gate. rejected: user-declined, does not count.';
COMMENT ON COLUMN requirement_links.suggesting_evidence IS 'For AI-proposed links: the source passage that suggested this task satisfies this requirement.';
COMMENT ON COLUMN requirement_links.proposed_at IS 'When the link was proposed (for AI-generated links).';
COMMENT ON COLUMN requirement_links.resolved_at IS 'When the link was accepted or rejected.';
COMMENT ON COLUMN requirement_links.resolved_by IS 'User who accepted or rejected the link.';
COMMENT ON FUNCTION check_requirement_link_status_transition() IS 'BC-3: Enforces that only proposed->accepted|rejected transitions are permitted. Accepted links feed the citation gate.';
