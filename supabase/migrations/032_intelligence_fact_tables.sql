-- Phase 2: Intelligence Fact Tables
-- Load-bearing tables for periods, disciplines, and labor requirements
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS intelligence_labor_requirements CASCADE;
--   DROP TABLE IF EXISTS intelligence_disciplines CASCADE;
--   DROP TABLE IF EXISTS intelligence_periods CASCADE;

-- =============================================================================
-- INTELLIGENCE PERIODS
-- =============================================================================
-- Contract periods extracted from the RFP (Base Period, Option 1, etc.)

CREATE TABLE intelligence_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES intelligence_versions(id) ON DELETE CASCADE,

  -- Period details
  name TEXT NOT NULL,
  months NUMERIC(5, 2) NOT NULL,
  cumulative_months_end NUMERIC(6, 2) NOT NULL,
  gsa_rate_year INTEGER NOT NULL CHECK (gsa_rate_year BETWEEN 1 AND 5),

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_intelligence_periods_version ON intelligence_periods(version_id);
CREATE INDEX idx_intelligence_periods_sort ON intelligence_periods(version_id, sort_order);

-- Updated_at trigger
CREATE TRIGGER intelligence_periods_updated_at
  BEFORE UPDATE ON intelligence_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_intelligence_versions_timestamp();

-- =============================================================================
-- INTELLIGENCE DISCIPLINES
-- =============================================================================
-- Required disciplines extracted from the RFP

CREATE TABLE intelligence_disciplines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES intelligence_versions(id) ON DELETE CASCADE,

  -- Discipline type (engineering, design, research, etc.)
  discipline TEXT NOT NULL CHECK (discipline IN (
    'engineering', 'design', 'research', 'product', 'delivery',
    'program-management', 'content', 'accessibility'
  )),

  -- Confidence and source
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  source_text TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint per version
  CONSTRAINT unique_discipline_per_version UNIQUE (version_id, discipline)
);

-- Indexes
CREATE INDEX idx_intelligence_disciplines_version ON intelligence_disciplines(version_id);

-- =============================================================================
-- INTELLIGENCE LABOR REQUIREMENTS
-- =============================================================================
-- Extracted roles/positions from the RFP

CREATE TABLE intelligence_labor_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES intelligence_versions(id) ON DELETE CASCADE,

  -- Role details
  title TEXT NOT NULL,
  labor_category TEXT,
  hours_per_month NUMERIC(8, 2),
  utilization_pct NUMERIC(5, 2) CHECK (utilization_pct >= 0 AND utilization_pct <= 100),

  -- Period mapping (references period names, not IDs, for flexibility)
  appears_in_periods TEXT[] DEFAULT '{}',

  -- Confidence and source
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  source_text TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_intelligence_labor_reqs_version ON intelligence_labor_requirements(version_id);
CREATE INDEX idx_intelligence_labor_reqs_title ON intelligence_labor_requirements(version_id, title);

-- Updated_at trigger
CREATE TRIGGER intelligence_labor_reqs_updated_at
  BEFORE UPDATE ON intelligence_labor_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_intelligence_versions_timestamp();

-- =============================================================================
-- RLS POLICIES (inherit from parent version's tenant)
-- =============================================================================

ALTER TABLE intelligence_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_labor_requirements ENABLE ROW LEVEL SECURITY;

-- Helper function to get tenant from version
CREATE OR REPLACE FUNCTION get_intelligence_version_tenant(check_version_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM intelligence_versions WHERE id = check_version_id;
$$;

-- Periods policies
CREATE POLICY "Members view intelligence periods"
  ON intelligence_periods
  FOR SELECT TO authenticated
  USING (is_tenant_member(get_intelligence_version_tenant(version_id)));

CREATE POLICY "Estimators manage intelligence periods"
  ON intelligence_periods
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Disciplines policies
CREATE POLICY "Members view intelligence disciplines"
  ON intelligence_disciplines
  FOR SELECT TO authenticated
  USING (is_tenant_member(get_intelligence_version_tenant(version_id)));

CREATE POLICY "Estimators manage intelligence disciplines"
  ON intelligence_disciplines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Labor requirements policies
CREATE POLICY "Members view intelligence labor reqs"
  ON intelligence_labor_requirements
  FOR SELECT TO authenticated
  USING (is_tenant_member(get_intelligence_version_tenant(version_id)));

CREATE POLICY "Estimators manage intelligence labor reqs"
  ON intelligence_labor_requirements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = get_intelligence_version_tenant(version_id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE intelligence_periods IS 'Contract periods (Base, Option 1, etc.) extracted from RFP';
COMMENT ON TABLE intelligence_disciplines IS 'Required disciplines (engineering, design, etc.) extracted from RFP';
COMMENT ON TABLE intelligence_labor_requirements IS 'Extracted role/position requirements from RFP';
COMMENT ON COLUMN intelligence_labor_requirements.appears_in_periods IS 'Array of period names where this role is required';
