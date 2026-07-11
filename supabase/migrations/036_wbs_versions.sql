-- Phase 3: WBS Versions Table
-- Core versioning for Work Breakdown Structure with candidate-accept flow
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS wbs_versions CASCADE;
--   DROP TYPE IF EXISTS wbs_status CASCADE;

-- =============================================================================
-- WBS STATUS ENUM
-- =============================================================================

CREATE TYPE wbs_status AS ENUM ('generated_candidate', 'draft', 'active', 'superseded');

-- =============================================================================
-- WBS VERSIONS TABLE
-- =============================================================================
-- Each WBS generation creates a candidate. Candidates become active through acceptance.
-- Only ONE active version per proposal (enforced by partial unique index).

CREATE TABLE wbs_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Parent proposal
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- The structural gate: references an intelligence version
  -- Confirmed intelligence required for generated_candidate or active status
  -- Draft versions may reference draft intelligence
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id),

  -- Versioning
  version_number INTEGER NOT NULL DEFAULT 1,
  status wbs_status NOT NULL DEFAULT 'generated_candidate',

  -- Lineage
  based_on_wbs_version_id UUID REFERENCES wbs_versions(id),
  generation_job_note TEXT,  -- model/prompt identifiers (Phase 4 job infra)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  CONSTRAINT unique_wbs_version_per_proposal UNIQUE (proposal_id, version_number),
  CONSTRAINT activated_at_required_when_active CHECK (
    status != 'active' OR activated_at IS NOT NULL
  ),
  CONSTRAINT superseded_at_required_when_superseded CHECK (
    status != 'superseded' OR superseded_at IS NOT NULL
  )
);

-- At most ONE active version per proposal (partial unique index)
CREATE UNIQUE INDEX idx_one_active_wbs_per_proposal
  ON wbs_versions(proposal_id)
  WHERE status = 'active';

-- Standard indexes
CREATE INDEX idx_wbs_versions_tenant ON wbs_versions(tenant_id);
CREATE INDEX idx_wbs_versions_proposal ON wbs_versions(proposal_id);
CREATE INDEX idx_wbs_versions_status ON wbs_versions(status);
CREATE INDEX idx_wbs_versions_intelligence ON wbs_versions(intelligence_version_id);

-- =============================================================================
-- INTELLIGENCE GATE TRIGGER
-- =============================================================================
-- Confirmed intelligence required for:
-- 1. INSERT with status = 'generated_candidate'
-- 2. Any UPDATE transitioning to status = 'active'
-- Draft WBS versions may reference draft intelligence.

CREATE OR REPLACE FUNCTION v_enforce_intelligence_gate()
RETURNS TRIGGER AS $$
DECLARE
  v_intel_status intelligence_status;
BEGIN
  -- Look up the intelligence version's status
  SELECT status INTO v_intel_status
  FROM intelligence_versions
  WHERE id = NEW.intelligence_version_id;

  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'Intelligence version % does not exist', NEW.intelligence_version_id;
  END IF;

  -- Rule 1: generated_candidate on INSERT requires confirmed intelligence
  IF TG_OP = 'INSERT' AND NEW.status = 'generated_candidate' THEN
    IF v_intel_status != 'confirmed' THEN
      RAISE EXCEPTION 'Cannot create generated_candidate WBS: intelligence version % is not confirmed (status: %)',
        NEW.intelligence_version_id, v_intel_status;
    END IF;
  END IF;

  -- Rule 2: Transition to active requires confirmed intelligence
  IF TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    IF v_intel_status != 'confirmed' THEN
      RAISE EXCEPTION 'Cannot activate WBS version: intelligence version % is not confirmed (status: %)',
        NEW.intelligence_version_id, v_intel_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_versions_intelligence_gate
  BEFORE INSERT OR UPDATE ON wbs_versions
  FOR EACH ROW
  EXECUTE FUNCTION v_enforce_intelligence_gate();

-- =============================================================================
-- ROW VERSION + UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER wbs_versions_row_version
  BEFORE UPDATE ON wbs_versions
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

CREATE OR REPLACE FUNCTION v_update_wbs_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_versions_updated_at
  BEFORE UPDATE ON wbs_versions
  FOR EACH ROW
  EXECUTE FUNCTION v_update_wbs_versions_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE wbs_versions IS 'Versioned WBS with candidate-accept flow; one active per proposal';
COMMENT ON COLUMN wbs_versions.intelligence_version_id IS 'Gate: confirmed intelligence required for generated_candidate or active status';
COMMENT ON COLUMN wbs_versions.based_on_wbs_version_id IS 'Lineage tracking for derived versions';
COMMENT ON COLUMN wbs_versions.generation_job_note IS 'Model/prompt identifiers for generation traceability';
