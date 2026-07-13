-- Fix: fact_evidence trigger uses intelligence_version_id, not version_id
--
-- Migration 061 applied check_fact_table_parent_draft() to fact_evidence,
-- but that function expects a column named "version_id". The fact_evidence
-- table uses "intelligence_version_id" for clarity (matching the FK target).
--
-- This migration creates a dedicated trigger function for fact_evidence.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS enforce_fact_evidence_parent_draft ON fact_evidence;
--   DROP FUNCTION IF EXISTS check_fact_evidence_parent_draft();
--   -- Then re-apply the original trigger from 061 (which won't work)

-- =============================================================================
-- FACT_EVIDENCE PARENT DRAFT CHECK
-- =============================================================================
-- Same logic as check_fact_table_parent_draft() but uses intelligence_version_id

CREATE OR REPLACE FUNCTION check_fact_evidence_parent_draft()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_status intelligence_status;
BEGIN
  -- Get parent version status using intelligence_version_id
  SELECT status INTO v_parent_status
  FROM intelligence_versions
  WHERE id = COALESCE(NEW.intelligence_version_id, OLD.intelligence_version_id);

  IF v_parent_status IS NULL THEN
    -- Parent doesn't exist, let FK constraint handle it
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only allow modifications when parent is draft
  IF v_parent_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify fact_evidence when parent intelligence version is % (intelligence_version_id: %)',
      v_parent_status, COALESCE(NEW.intelligence_version_id, OLD.intelligence_version_id)
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- For DELETE, return OLD; for INSERT/UPDATE, return NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the broken trigger from migration 061
DROP TRIGGER IF EXISTS enforce_fact_evidence_parent_draft ON fact_evidence;

-- Create the working trigger
CREATE TRIGGER enforce_fact_evidence_parent_draft
  BEFORE INSERT OR UPDATE OR DELETE ON fact_evidence
  FOR EACH ROW
  EXECUTE FUNCTION check_fact_evidence_parent_draft();

-- Comment
COMMENT ON FUNCTION check_fact_evidence_parent_draft() IS
  'Ensures fact_evidence rows can only be modified when parent intelligence version is draft. Uses intelligence_version_id column.';
