-- Phase 2: Intelligence Immutability Triggers
-- Enforce immutability on confirmed versions and their fact tables
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS enforce_intelligence_version_immutability ON intelligence_versions;
--   DROP TRIGGER IF EXISTS enforce_period_parent_draft ON intelligence_periods;
--   DROP TRIGGER IF EXISTS enforce_discipline_parent_draft ON intelligence_disciplines;
--   DROP TRIGGER IF EXISTS enforce_labor_req_parent_draft ON intelligence_labor_requirements;
--   DROP FUNCTION IF EXISTS check_intelligence_version_immutability();
--   DROP FUNCTION IF EXISTS check_fact_table_parent_draft();

-- =============================================================================
-- INTELLIGENCE VERSION IMMUTABILITY
-- =============================================================================
-- Once a version is confirmed, only these transitions are allowed:
-- - confirmed -> superseded (via supersede endpoint)
-- No other mutations allowed on confirmed/superseded versions.

CREATE OR REPLACE FUNCTION check_intelligence_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow transition from confirmed to superseded
  IF OLD.status = 'confirmed' AND NEW.status = 'superseded' THEN
    -- Only superseded_at should change
    IF NEW.confirmation_hash IS DISTINCT FROM OLD.confirmation_hash
       OR NEW.facts_json IS DISTINCT FROM OLD.facts_json
       OR NEW.contract_type IS DISTINCT FROM OLD.contract_type
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    THEN
      RAISE EXCEPTION 'Cannot modify confirmed intelligence version fields during supersede transition'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Block all other mutations on confirmed versions
  IF OLD.status = 'confirmed' THEN
    RAISE EXCEPTION 'Cannot modify confirmed intelligence version (id: %)', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Block all mutations on superseded versions
  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify superseded intelligence version (id: %)', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Allow mutations on draft versions
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_intelligence_version_immutability
  BEFORE UPDATE ON intelligence_versions
  FOR EACH ROW
  EXECUTE FUNCTION check_intelligence_version_immutability();

-- =============================================================================
-- FACT TABLE PARENT DRAFT CHECK
-- =============================================================================
-- Fact tables (periods, disciplines, labor_requirements) can only be modified
-- if the parent intelligence_version is still in draft status.

CREATE OR REPLACE FUNCTION check_fact_table_parent_draft()
RETURNS TRIGGER AS $$
DECLARE
  parent_status intelligence_status;
BEGIN
  -- Get parent version status
  SELECT status INTO parent_status
  FROM intelligence_versions
  WHERE id = COALESCE(NEW.version_id, OLD.version_id);

  IF parent_status IS NULL THEN
    -- Parent doesn't exist, let FK constraint handle it
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only allow modifications when parent is draft
  IF parent_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify fact table when parent intelligence version is % (version_id: %)',
      parent_status, COALESCE(NEW.version_id, OLD.version_id)
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- For DELETE, return OLD; for INSERT/UPDATE, return NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to periods
CREATE TRIGGER enforce_period_parent_draft
  BEFORE INSERT OR UPDATE OR DELETE ON intelligence_periods
  FOR EACH ROW
  EXECUTE FUNCTION check_fact_table_parent_draft();

-- Apply to disciplines
CREATE TRIGGER enforce_discipline_parent_draft
  BEFORE INSERT OR UPDATE OR DELETE ON intelligence_disciplines
  FOR EACH ROW
  EXECUTE FUNCTION check_fact_table_parent_draft();

-- Apply to labor requirements
CREATE TRIGGER enforce_labor_req_parent_draft
  BEFORE INSERT OR UPDATE OR DELETE ON intelligence_labor_requirements
  FOR EACH ROW
  EXECUTE FUNCTION check_fact_table_parent_draft();

-- =============================================================================
-- DELETE PROTECTION
-- =============================================================================
-- Confirmed/superseded versions cannot be deleted

CREATE OR REPLACE FUNCTION check_intelligence_version_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('confirmed', 'superseded') THEN
    RAISE EXCEPTION 'Cannot delete % intelligence version (id: %)', OLD.status, OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_intelligence_version_no_delete
  BEFORE DELETE ON intelligence_versions
  FOR EACH ROW
  EXECUTE FUNCTION check_intelligence_version_delete();

-- Comments
COMMENT ON FUNCTION check_intelligence_version_immutability() IS 'Enforces immutability on confirmed/superseded intelligence versions';
COMMENT ON FUNCTION check_fact_table_parent_draft() IS 'Ensures fact tables can only be modified when parent version is draft';
