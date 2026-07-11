-- ============================================================================
-- Add content fields to proposal_sections for TipTap editor
-- ============================================================================

ALTER TABLE proposal_sections
  ADD COLUMN IF NOT EXISTS content JSONB DEFAULT NULL,
  -- TipTap JSON document
  ADD COLUMN IF NOT EXISTS content_text TEXT DEFAULT NULL,
  -- Plain text version for coaching/search
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Add locked status option
ALTER TABLE proposal_sections
  DROP CONSTRAINT IF EXISTS proposal_sections_status_check;

ALTER TABLE proposal_sections
  ADD CONSTRAINT proposal_sections_status_check
  CHECK (status IN ('draft', 'in_progress', 'review', 'complete', 'locked'));
