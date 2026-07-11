-- Phase 3: WBS Immutability Triggers
-- Prevent mutations on superseded versions; prevent delete of active version
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS wbs_versions_block_active_delete ON wbs_versions;
--   DROP TRIGGER IF EXISTS wbs_versions_block_superseded_update ON wbs_versions;
--   DROP TRIGGER IF EXISTS wbs_tasks_block_superseded_mutation ON wbs_tasks;
--   DROP TRIGGER IF EXISTS staffing_block_superseded_mutation ON staffing_assignments;
--   DROP FUNCTION IF EXISTS v_block_active_wbs_delete();
--   DROP FUNCTION IF EXISTS v_block_superseded_wbs_mutation();
--   DROP FUNCTION IF EXISTS v_block_child_mutation_on_superseded();

-- =============================================================================
-- BLOCK DELETE OF ACTIVE WBS VERSION
-- =============================================================================
-- Active versions cannot be deleted directly; they must be superseded first.

CREATE OR REPLACE FUNCTION v_block_active_wbs_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'active' THEN
    RAISE EXCEPTION 'Cannot delete active WBS version %. Supersede it first.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_versions_block_active_delete
  BEFORE DELETE ON wbs_versions
  FOR EACH ROW
  EXECUTE FUNCTION v_block_active_wbs_delete();

-- =============================================================================
-- BLOCK MUTATIONS ON SUPERSEDED WBS VERSIONS
-- =============================================================================
-- Superseded versions are fully immutable (history mechanism).

CREATE OR REPLACE FUNCTION v_block_superseded_wbs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify superseded WBS version %. History is immutable.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_versions_block_superseded_update
  BEFORE UPDATE ON wbs_versions
  FOR EACH ROW
  EXECUTE FUNCTION v_block_superseded_wbs_mutation();

-- =============================================================================
-- BLOCK TASK/ASSIGNMENT MUTATIONS ON SUPERSEDED PARENT
-- =============================================================================
-- Tasks and assignments inherit immutability from their parent wbs_version.

CREATE OR REPLACE FUNCTION v_block_child_mutation_on_superseded()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_status wbs_status;
  v_version_id UUID;
BEGIN
  -- Determine the version_id based on operation and table
  IF TG_TABLE_NAME = 'wbs_tasks' THEN
    v_version_id := COALESCE(NEW.wbs_version_id, OLD.wbs_version_id);
  ELSIF TG_TABLE_NAME = 'staffing_assignments' THEN
    -- staffing_assignments references wbs_tasks, need to look up
    IF TG_OP = 'DELETE' THEN
      SELECT wt.wbs_version_id INTO v_version_id
      FROM wbs_tasks wt
      WHERE wt.id = OLD.wbs_task_id;
    ELSE
      SELECT wt.wbs_version_id INTO v_version_id
      FROM wbs_tasks wt
      WHERE wt.id = NEW.wbs_task_id;
    END IF;
  END IF;

  -- Look up parent version status
  SELECT status INTO v_parent_status
  FROM wbs_versions
  WHERE id = v_version_id;

  IF v_parent_status = 'superseded' THEN
    RAISE EXCEPTION 'Cannot modify % on superseded WBS version. History is immutable.',
      TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_tasks_block_superseded_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON wbs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION v_block_child_mutation_on_superseded();

CREATE TRIGGER staffing_block_superseded_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON staffing_assignments
  FOR EACH ROW
  EXECUTE FUNCTION v_block_child_mutation_on_superseded();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION v_block_active_wbs_delete() IS 'Prevents direct deletion of active WBS versions';
COMMENT ON FUNCTION v_block_superseded_wbs_mutation() IS 'Ensures superseded versions are fully immutable';
COMMENT ON FUNCTION v_block_child_mutation_on_superseded() IS 'Cascades immutability to tasks and assignments';
