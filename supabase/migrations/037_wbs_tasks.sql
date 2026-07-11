-- Phase 3: WBS Tasks Table
-- Normalized WBS elements with hierarchical structure
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS wbs_tasks CASCADE;
--   DROP TYPE IF EXISTS wbs_task_source CASCADE;

-- =============================================================================
-- WBS TASK SOURCE ENUM
-- =============================================================================

CREATE TYPE wbs_task_source AS ENUM ('generated', 'user_added');

-- =============================================================================
-- WBS TASKS TABLE
-- =============================================================================
-- Each task belongs to a WBS version. Tasks can have parent tasks for hierarchy.
-- user_modified flag tracks whether user has edited a generated task.

CREATE TABLE wbs_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Parent version
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id) ON DELETE CASCADE,

  -- Hierarchy (optional parent for nested WBS)
  parent_task_id UUID REFERENCES wbs_tasks(id) ON DELETE CASCADE,

  -- WBS structure
  wbs_code TEXT NOT NULL,          -- e.g., "1.2.3"
  title TEXT NOT NULL,
  description TEXT,
  deliverable TEXT,

  -- SOW reference
  sow_reference TEXT,

  -- Period bounds (cumulative contract months, 1-indexed)
  start_month INTEGER CHECK (start_month IS NULL OR start_month >= 1),
  end_month INTEGER CHECK (end_month IS NULL OR end_month >= 1),
  CONSTRAINT valid_month_range CHECK (
    start_month IS NULL OR end_month IS NULL OR end_month >= start_month
  ),

  -- Ordering within parent
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Provenance
  source wbs_task_source NOT NULL DEFAULT 'generated',
  user_modified BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX idx_wbs_tasks_version ON wbs_tasks(wbs_version_id);
CREATE INDEX idx_wbs_tasks_parent ON wbs_tasks(parent_task_id);
CREATE INDEX idx_wbs_tasks_code ON wbs_tasks(wbs_version_id, wbs_code);
CREATE INDEX idx_wbs_tasks_sort ON wbs_tasks(wbs_version_id, sort_order);

-- =============================================================================
-- ROW VERSION + UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER wbs_tasks_row_version
  BEFORE UPDATE ON wbs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

CREATE OR REPLACE FUNCTION v_update_wbs_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_tasks_updated_at
  BEFORE UPDATE ON wbs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION v_update_wbs_tasks_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE wbs_tasks IS 'Normalized WBS elements with hierarchical structure';
COMMENT ON COLUMN wbs_tasks.wbs_code IS 'WBS code like "1.2.3" for hierarchical numbering';
COMMENT ON COLUMN wbs_tasks.parent_task_id IS 'Optional parent for nested WBS structure';
COMMENT ON COLUMN wbs_tasks.start_month IS 'Start month (cumulative contract months, 1-indexed)';
COMMENT ON COLUMN wbs_tasks.end_month IS 'End month (cumulative contract months, 1-indexed)';
COMMENT ON COLUMN wbs_tasks.source IS 'generated = from AI, user_added = manually created';
COMMENT ON COLUMN wbs_tasks.user_modified IS 'True if user has edited a generated task';
