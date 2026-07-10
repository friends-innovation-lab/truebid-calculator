-- Phase 1: Optimistic Concurrency for Proposals
-- Adds row_version column and auto-increment trigger
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS proposals_row_version_trigger ON proposals;
--   ALTER TABLE proposals DROP COLUMN IF EXISTS row_version;
--   DROP INDEX IF EXISTS idx_proposals_row_version;

-- Add row_version column
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

-- Create trigger to auto-increment row_version on update
-- (function was created in 025_tenants.sql)
DROP TRIGGER IF EXISTS proposals_row_version_trigger ON proposals;

CREATE TRIGGER proposals_row_version_trigger
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- Index for conflict detection (optional, helps with concurrent access patterns)
CREATE INDEX IF NOT EXISTS idx_proposals_row_version ON proposals(id, row_version);

-- Comment
COMMENT ON COLUMN proposals.row_version IS 'Optimistic concurrency control: auto-increments on each update';
