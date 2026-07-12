-- Phase 6A: Pricing Scenarios & Lines
-- Pricing as explicit bounded context with full calculation trace
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS pricing_lines CASCADE;
--   DROP TABLE IF EXISTS pricing_scenarios CASCADE;
--   DROP TYPE IF EXISTS pricing_scenario_status CASCADE;
--   DROP TYPE IF EXISTS salary_source_type CASCADE;
--   DROP TYPE IF EXISTS profit_source_type CASCADE;
--   DROP TYPE IF EXISTS pricing_line_type CASCADE;
--   DROP FUNCTION IF EXISTS check_wbs_version_status() CASCADE;
--   DROP FUNCTION IF EXISTS prevent_pricing_line_update() CASCADE;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE pricing_scenario_status AS ENUM ('draft', 'approved', 'superseded');
CREATE TYPE salary_source_type AS ENUM ('catalog', 'override');
CREATE TYPE profit_source_type AS ENUM ('explicit', 'contract_default');
CREATE TYPE pricing_line_type AS ENUM ('wbs_estimate', 'labor_loading');

-- =============================================================================
-- PRICING SCENARIOS TABLE
-- =============================================================================

CREATE TABLE pricing_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),

  label TEXT NOT NULL DEFAULT 'Primary',
  status pricing_scenario_status NOT NULL DEFAULT 'draft',

  -- Rate config snapshot: indirect rates + profit targets + escalation in effect at compute time
  -- Schema: { fringe, overhead, ga, defaultProfitRate, escalationRate, snapshotAt, sourceSettingsRowVersion }
  rate_config_snapshot JSONB NOT NULL,

  -- Computation metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine_version TEXT NOT NULL,  -- e.g., 'v1.1.0'
  created_by UUID REFERENCES auth.users(id),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique: one approved scenario per proposal
CREATE UNIQUE INDEX idx_pricing_scenarios_one_approved
  ON pricing_scenarios(proposal_id)
  WHERE status = 'approved';

-- Standard indexes
CREATE INDEX idx_pricing_scenarios_proposal ON pricing_scenarios(proposal_id);
CREATE INDEX idx_pricing_scenarios_tenant ON pricing_scenarios(tenant_id);
CREATE INDEX idx_pricing_scenarios_wbs ON pricing_scenarios(wbs_version_id);

-- =============================================================================
-- PRICING LINES TABLE (The Line IS the Ledger)
-- =============================================================================

CREATE TABLE pricing_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id) ON DELETE CASCADE,

  -- Line type: wbs_estimate (from staffing assignments) or labor_loading (from intelligence)
  line_type pricing_line_type NOT NULL DEFAULT 'wbs_estimate',

  -- Source references (one will be set based on line_type)
  -- wbs_estimate: staffing_assignment_id is set
  -- labor_loading: intelligence_labor_requirement_id and intelligence_period_id are set
  staffing_assignment_id UUID REFERENCES staffing_assignments(id),
  intelligence_labor_requirement_id UUID REFERENCES intelligence_labor_requirements(id),
  intelligence_period_id UUID REFERENCES intelligence_periods(id),

  -- Period and hours
  period_label TEXT NOT NULL,
  hours NUMERIC(10,2) NOT NULL,

  -- Resolved salary with provenance
  resolved_salary_cents BIGINT NOT NULL,
  salary_source salary_source_type NOT NULL,
  level_key TEXT,
  step_index INTEGER,

  -- FULL CALCULATION TRACE (the line IS the ledger)
  -- All intermediate values stored at 6 decimal precision
  base_hourly NUMERIC(12,6) NOT NULL,
  fringe_amount NUMERIC(12,6) NOT NULL,
  overhead_base NUMERIC(12,6) NOT NULL,    -- afterFringe in engine terms
  overhead_amount NUMERIC(12,6) NOT NULL,
  ga_amount NUMERIC(12,6) NOT NULL,
  cost_before_profit NUMERIC(12,6) NOT NULL,

  profit_rate NUMERIC(5,4) NOT NULL,
  profit_source profit_source_type NOT NULL,
  profit_amount NUMERIC(12,6) NOT NULL,

  -- Final rate (2 decimal precision) and escalation
  fully_burdened NUMERIC(12,2) NOT NULL,
  escalation_rate_applied NUMERIC(6,4),      -- null for GSA or year 1
  escalation_year_index INTEGER,              -- null for GSA

  -- Extended cost (hours × fully_burdened)
  extended_cost NUMERIC(15,2) NOT NULL,

  -- Timestamps (no updated_at — immutable)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Check constraint: source references match line_type
ALTER TABLE pricing_lines ADD CONSTRAINT pricing_lines_source_check CHECK (
  (line_type = 'wbs_estimate' AND staffing_assignment_id IS NOT NULL
    AND intelligence_labor_requirement_id IS NULL AND intelligence_period_id IS NULL)
  OR
  (line_type = 'labor_loading' AND staffing_assignment_id IS NULL
    AND intelligence_labor_requirement_id IS NOT NULL AND intelligence_period_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_pricing_lines_scenario ON pricing_lines(pricing_scenario_id);
CREATE INDEX idx_pricing_lines_assignment ON pricing_lines(staffing_assignment_id) WHERE staffing_assignment_id IS NOT NULL;
CREATE INDEX idx_pricing_lines_labor_req ON pricing_lines(intelligence_labor_requirement_id) WHERE intelligence_labor_requirement_id IS NOT NULL;
CREATE INDEX idx_pricing_lines_period ON pricing_lines(intelligence_period_id) WHERE intelligence_period_id IS NOT NULL;
CREATE INDEX idx_pricing_lines_tenant ON pricing_lines(tenant_id);
CREATE INDEX idx_pricing_lines_type ON pricing_lines(pricing_scenario_id, line_type);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- WBS version status check: scenarios can only reference active or superseded versions
CREATE OR REPLACE FUNCTION check_wbs_version_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status wbs_status;
BEGIN
  SELECT status INTO v_status FROM wbs_versions WHERE id = NEW.wbs_version_id;
  IF v_status NOT IN ('active', 'superseded') THEN
    RAISE EXCEPTION 'pricing_scenarios can only reference active or superseded WBS versions, got: %', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_scenario_wbs_status_check
  BEFORE INSERT OR UPDATE ON pricing_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION check_wbs_version_status();

-- Immutability: pricing_lines are write-once per scenario
CREATE OR REPLACE FUNCTION prevent_pricing_line_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pricing_lines are immutable; corrections require a new scenario';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_lines_immutable
  BEFORE UPDATE ON pricing_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_pricing_line_update();

-- Row version trigger for scenarios
CREATE TRIGGER pricing_scenarios_row_version
  BEFORE UPDATE ON pricing_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- Updated_at trigger for scenarios
CREATE OR REPLACE FUNCTION v_update_pricing_scenarios_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_scenarios_updated_at
  BEFORE UPDATE ON pricing_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION v_update_pricing_scenarios_timestamp();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE pricing_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_lines ENABLE ROW LEVEL SECURITY;

-- pricing_scenarios: tenant isolation via company membership
CREATE POLICY pricing_scenarios_tenant_isolation ON pricing_scenarios
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- pricing_lines: tenant isolation
CREATE POLICY pricing_lines_tenant_isolation ON pricing_lines
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE pricing_scenarios IS 'Pricing scenario for a proposal, capturing rate config at compute time';
COMMENT ON COLUMN pricing_scenarios.rate_config_snapshot IS 'JSONB: { fringe, overhead, ga, defaultProfitRate, escalationRate, snapshotAt, sourceSettingsRowVersion }';
COMMENT ON COLUMN pricing_scenarios.engine_version IS 'Formula version string from pricing engine (e.g., v1.1.0)';
COMMENT ON COLUMN pricing_scenarios.wbs_version_id IS 'FK to wbs_versions; staleness = this != proposal.active WBS version';

COMMENT ON TABLE pricing_lines IS 'Immutable pricing line with full calculation trace; the line IS the ledger';
COMMENT ON COLUMN pricing_lines.line_type IS 'wbs_estimate: from staffing assignments; labor_loading: from confirmed intelligence utilization';
COMMENT ON COLUMN pricing_lines.staffing_assignment_id IS 'Source assignment for wbs_estimate lines; NULL for labor_loading';
COMMENT ON COLUMN pricing_lines.intelligence_labor_requirement_id IS 'Source labor requirement for labor_loading lines; NULL for wbs_estimate';
COMMENT ON COLUMN pricing_lines.intelligence_period_id IS 'Period for labor_loading lines; NULL for wbs_estimate';
COMMENT ON COLUMN pricing_lines.overhead_base IS 'afterFringe in engine terms (base_hourly + fringe_amount)';
COMMENT ON COLUMN pricing_lines.escalation_rate_applied IS 'Null for GSA contracts or base year; decimal (0.03 = 3%)';
COMMENT ON COLUMN pricing_lines.escalation_year_index IS 'Null for GSA contracts; 1 = base year, 2+ = escalation applied';
