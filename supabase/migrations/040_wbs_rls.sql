-- Phase 3: WBS Row Level Security
-- RLS policies for wbs_versions, wbs_tasks, and staffing_assignments
--
-- ROLLBACK:
--   -- Drop all policies, then ALTER TABLE ... DISABLE ROW LEVEL SECURITY

-- =============================================================================
-- WBS VERSIONS RLS
-- =============================================================================

ALTER TABLE wbs_versions ENABLE ROW LEVEL SECURITY;

-- Members can view WBS versions in their tenant
CREATE POLICY "Members view wbs versions"
  ON wbs_versions
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Only owner/admin/estimator can create WBS versions
CREATE POLICY "Estimators create wbs versions"
  ON wbs_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Only owner/admin/estimator can update WBS versions (immutability enforced by triggers)
CREATE POLICY "Estimators update wbs versions"
  ON wbs_versions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Only owner/admin/estimator can delete WBS versions (active delete blocked by trigger)
CREATE POLICY "Estimators delete wbs versions"
  ON wbs_versions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- =============================================================================
-- WBS TASKS RLS
-- =============================================================================

ALTER TABLE wbs_tasks ENABLE ROW LEVEL SECURITY;

-- Members can view tasks in their tenant
CREATE POLICY "Members view wbs tasks"
  ON wbs_tasks
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Estimators can manage tasks (immutability enforced by triggers)
CREATE POLICY "Estimators manage wbs tasks"
  ON wbs_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_tasks.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = wbs_tasks.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- =============================================================================
-- STAFFING ASSIGNMENTS RLS
-- =============================================================================

ALTER TABLE staffing_assignments ENABLE ROW LEVEL SECURITY;

-- Members can view assignments in their tenant
CREATE POLICY "Members view staffing assignments"
  ON staffing_assignments
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Estimators can manage assignments (immutability enforced by triggers)
CREATE POLICY "Estimators manage staffing assignments"
  ON staffing_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = staffing_assignments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = staffing_assignments.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON POLICY "Members view wbs versions" ON wbs_versions IS 'All tenant members can view WBS versions';
COMMENT ON POLICY "Estimators create wbs versions" ON wbs_versions IS 'Owner/admin/estimator can create WBS versions';
COMMENT ON POLICY "Estimators update wbs versions" ON wbs_versions IS 'Owner/admin/estimator can update (triggers enforce immutability)';
COMMENT ON POLICY "Estimators delete wbs versions" ON wbs_versions IS 'Owner/admin/estimator can delete (trigger blocks active deletion)';
