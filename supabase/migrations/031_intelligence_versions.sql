-- Phase 2: Versioned Contract Intelligence
-- Core intelligence_versions table for tracking extraction versions
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS intelligence_versions CASCADE;
--   DROP TYPE IF EXISTS intelligence_status CASCADE;

-- =============================================================================
-- INTELLIGENCE VERSIONS TABLE
-- =============================================================================
-- Each extraction creates a new version. Versions can be draft, confirmed, or superseded.
-- Once confirmed, the version is immutable (enforced by triggers in 033).

CREATE TYPE intelligence_status AS ENUM ('draft', 'confirmed', 'superseded');

CREATE TABLE intelligence_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Parent proposal
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Versioning
  version_number INTEGER NOT NULL DEFAULT 1,
  status intelligence_status NOT NULL DEFAULT 'draft',

  -- Confirmation hash (SHA-256, computed from canonical serialization of facts)
  -- NULL when draft, set on confirmation, verified by guard before WBS generation
  confirmation_hash TEXT,

  -- Core facts stored as JSONB (for fields that don't need relational queries)
  -- Contains: documentType, vehicle, contractType, setAside, rateSource (with confidence)
  facts_json JSONB NOT NULL DEFAULT '{}',

  -- Denormalized contract type for efficient querying
  contract_type TEXT CHECK (contract_type IN ('FFP', 'T&M', 'IDIQ', 'BPA', 'CPFF', 'unknown')),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_version_per_proposal UNIQUE (proposal_id, version_number),
  CONSTRAINT hash_required_when_confirmed CHECK (
    status != 'confirmed' OR confirmation_hash IS NOT NULL
  ),
  CONSTRAINT confirmed_at_required_when_confirmed CHECK (
    status != 'confirmed' OR confirmed_at IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_intelligence_versions_tenant ON intelligence_versions(tenant_id);
CREATE INDEX idx_intelligence_versions_proposal ON intelligence_versions(proposal_id);
CREATE INDEX idx_intelligence_versions_status ON intelligence_versions(status);
CREATE INDEX idx_intelligence_versions_proposal_status ON intelligence_versions(proposal_id, status);

-- Row version trigger
CREATE TRIGGER intelligence_versions_row_version
  BEFORE UPDATE ON intelligence_versions
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_intelligence_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intelligence_versions_updated_at
  BEFORE UPDATE ON intelligence_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_intelligence_versions_timestamp();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE intelligence_versions ENABLE ROW LEVEL SECURITY;

-- Helper function to check tenant membership (avoids recursion)
CREATE OR REPLACE FUNCTION is_tenant_member(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Members can view versions in their tenant
CREATE POLICY "Members view intelligence versions"
  ON intelligence_versions
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Only owner/admin/estimator can insert
CREATE POLICY "Estimators create intelligence versions"
  ON intelligence_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = intelligence_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Only owner/admin/estimator can update (immutability enforced by trigger)
CREATE POLICY "Estimators update intelligence versions"
  ON intelligence_versions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = intelligence_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_id = intelligence_versions.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'estimator')
        AND status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE intelligence_versions IS 'Versioned contract intelligence extractions with immutability guarantees';
COMMENT ON COLUMN intelligence_versions.confirmation_hash IS 'SHA-256 hash of canonical serialization, computed from fresh DB read-back on confirmation';
COMMENT ON COLUMN intelligence_versions.facts_json IS 'JSONB containing documentType, vehicle, contractType, setAside, rateSource with confidence';
