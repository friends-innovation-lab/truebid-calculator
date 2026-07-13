-- Phase 6B: BOE Artifacts
-- Immutable artifact records capturing BOE document structure
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS boe_citations CASCADE;
--   DROP TABLE IF EXISTS boe_artifacts CASCADE;
--   DROP TABLE IF EXISTS proposal_snapshots CASCADE;
--   DROP TYPE IF EXISTS boe_artifact_status CASCADE;
--   DROP TYPE IF EXISTS citation_target_type CASCADE;
--   ALTER TABLE boe_share_links DROP COLUMN IF EXISTS artifact_id;
--   ALTER TABLE boe_share_links DROP COLUMN IF EXISTS snapshot_id;

-- =============================================================================
-- BOE ARTIFACTS TABLE
-- =============================================================================

CREATE TYPE boe_artifact_status AS ENUM ('generated', 'superseded');

CREATE TABLE boe_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- The exact triple that defines this artifact
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id),
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id),

  -- Status: generated (current) or superseded (replaced by newer artifact)
  status boe_artifact_status NOT NULL DEFAULT 'generated',

  -- Structured document content (sections, tables, line traces)
  content JSONB NOT NULL,

  -- Integrity: SHA-256 of canonical-serialized content
  content_hash TEXT NOT NULL,

  -- Generation metadata
  engine_version TEXT NOT NULL,  -- e.g., 'v1.1.0' from pricing engine
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  superseded_at TIMESTAMPTZ,

  -- Row version for optimistic concurrency (status changes only)
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique: one generated artifact per exact triple
CREATE UNIQUE INDEX unique_artifact_per_triple
  ON boe_artifacts (intelligence_version_id, wbs_version_id, pricing_scenario_id)
  WHERE status = 'generated';

-- Standard indexes
CREATE INDEX idx_boe_artifacts_proposal ON boe_artifacts(proposal_id);
CREATE INDEX idx_boe_artifacts_tenant ON boe_artifacts(tenant_id);
CREATE INDEX idx_boe_artifacts_intel ON boe_artifacts(intelligence_version_id);
CREATE INDEX idx_boe_artifacts_wbs ON boe_artifacts(wbs_version_id);
CREATE INDEX idx_boe_artifacts_scenario ON boe_artifacts(pricing_scenario_id);
CREATE INDEX idx_boe_artifacts_status ON boe_artifacts(status) WHERE status = 'generated';

-- =============================================================================
-- BOE ARTIFACTS IMMUTABILITY TRIGGERS
-- =============================================================================

-- Artifacts are immutable after creation. Only allowed mutation:
-- status: generated → superseded (sets superseded_at, increments row_version)
CREATE OR REPLACE FUNCTION check_boe_artifact_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only status transition from generated to superseded
  IF OLD.status = 'generated' AND NEW.status = 'superseded' THEN
    -- Only superseded_at and row_version may change
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.intelligence_version_id IS DISTINCT FROM OLD.intelligence_version_id
       OR NEW.wbs_version_id IS DISTINCT FROM OLD.wbs_version_id
       OR NEW.pricing_scenario_id IS DISTINCT FROM OLD.pricing_scenario_id
       OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
       OR NEW.generated_at IS DISTINCT FROM OLD.generated_at
       OR NEW.generated_by IS DISTINCT FROM OLD.generated_by THEN
      RAISE EXCEPTION 'Cannot modify artifact fields during supersede (id: %)', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Block all other mutations
  RAISE EXCEPTION 'boe_artifacts are immutable after creation (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_immutable
  BEFORE UPDATE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION check_boe_artifact_immutability();

-- Block deletes entirely
CREATE OR REPLACE FUNCTION prevent_boe_artifact_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_artifacts cannot be deleted (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_no_delete
  BEFORE DELETE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_artifact_delete();

-- Row version trigger
CREATE TRIGGER boe_artifacts_row_version
  BEFORE UPDATE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- =============================================================================
-- BOE ARTIFACTS VALIDATION TRIGGER
-- =============================================================================

-- intelligence_version must be status='confirmed'
-- wbs_version must be status='active' (strictly - no superseded)
-- pricing_scenario must be status='approved'
CREATE OR REPLACE FUNCTION validate_boe_artifact_sources()
RETURNS TRIGGER AS $$
DECLARE
  v_intel_status intelligence_status;
  v_wbs_status wbs_status;
  v_scenario_status pricing_scenario_status;
BEGIN
  -- Check intelligence version is confirmed
  SELECT status INTO v_intel_status FROM intelligence_versions WHERE id = NEW.intelligence_version_id;
  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'intelligence_version_id % not found', NEW.intelligence_version_id;
  END IF;
  IF v_intel_status != 'confirmed' THEN
    RAISE EXCEPTION 'intelligence_version must be confirmed, got: %', v_intel_status;
  END IF;

  -- Check WBS version is active (strictly - no superseded allowed at insert time)
  SELECT status INTO v_wbs_status FROM wbs_versions WHERE id = NEW.wbs_version_id;
  IF v_wbs_status IS NULL THEN
    RAISE EXCEPTION 'wbs_version_id % not found', NEW.wbs_version_id;
  END IF;
  IF v_wbs_status != 'active' THEN
    RAISE EXCEPTION 'wbs_version must be active, got: %', v_wbs_status;
  END IF;

  -- Check pricing scenario is approved
  SELECT status INTO v_scenario_status FROM pricing_scenarios WHERE id = NEW.pricing_scenario_id;
  IF v_scenario_status IS NULL THEN
    RAISE EXCEPTION 'pricing_scenario_id % not found', NEW.pricing_scenario_id;
  END IF;
  IF v_scenario_status != 'approved' THEN
    RAISE EXCEPTION 'pricing_scenario must be approved, got: %', v_scenario_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_validate_sources
  BEFORE INSERT ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_boe_artifact_sources();

-- =============================================================================
-- BOE ARTIFACTS RLS
-- =============================================================================

ALTER TABLE boe_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY boe_artifacts_tenant_isolation ON boe_artifacts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- BOE CITATIONS TABLE
-- =============================================================================

CREATE TYPE citation_target_type AS ENUM ('requirement_link');
-- Note: 'fact_evidence' type reserved for future when fact_evidence table exists

CREATE TABLE boe_citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES boe_artifacts(id) ON DELETE CASCADE,

  -- Which line in the artifact content this citation belongs to
  -- Matches content.sections[].lines[].lineId
  artifact_line_id TEXT NOT NULL,

  -- What this citation points to
  citation_target_type citation_target_type NOT NULL,
  -- ON DELETE RESTRICT: cited requirement_links cannot be deleted
  requirement_link_id UUID REFERENCES requirement_links(id) ON DELETE RESTRICT,
  -- fact_evidence_id UUID REFERENCES fact_evidence(id) -- Future

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique: one citation per (artifact, line, target)
  CONSTRAINT unique_citation_per_line_target UNIQUE (
    artifact_id, artifact_line_id, requirement_link_id
  )
);

-- Indexes
CREATE INDEX idx_boe_citations_artifact ON boe_citations(artifact_id);
CREATE INDEX idx_boe_citations_requirement_link ON boe_citations(requirement_link_id)
  WHERE requirement_link_id IS NOT NULL;

-- =============================================================================
-- BOE CITATIONS IMMUTABILITY TRIGGERS
-- =============================================================================

-- Block updates on citations
CREATE OR REPLACE FUNCTION prevent_boe_citation_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_citations are immutable; create a new artifact for changes';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_citations_immutable
  BEFORE UPDATE ON boe_citations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_citation_update();

-- Block direct deletes on citations
CREATE OR REPLACE FUNCTION prevent_boe_citation_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_citations cannot be deleted directly (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_citations_no_delete
  BEFORE DELETE ON boe_citations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_citation_delete();

-- =============================================================================
-- BOE CITATIONS RLS
-- =============================================================================

ALTER TABLE boe_citations ENABLE ROW LEVEL SECURITY;

-- RLS via parent artifact
CREATE POLICY boe_citations_via_artifact ON boe_citations
  FOR ALL
  USING (
    artifact_id IN (
      SELECT ba.id FROM boe_artifacts ba
      JOIN tenant_memberships tm ON ba.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- PROPOSAL SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE proposal_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Pinned version references
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id),
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id),

  -- Associated artifacts (all must share the same intelligence version)
  artifact_ids UUID[] NOT NULL,

  -- Composite integrity hash over all pinned content hashes
  -- SHA-256(intel.confirmation_hash || artifact1.content_hash || artifact2.content_hash || ...)
  composite_hash TEXT NOT NULL,

  -- Metadata
  label TEXT NOT NULL DEFAULT 'Submission',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proposal_snapshots_proposal ON proposal_snapshots(proposal_id);
CREATE INDEX idx_proposal_snapshots_tenant ON proposal_snapshots(tenant_id);

-- =============================================================================
-- PROPOSAL SNAPSHOTS IMMUTABILITY TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_proposal_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_snapshots are immutable after creation (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_immutable
  BEFORE UPDATE ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_proposal_snapshot_update();

CREATE OR REPLACE FUNCTION prevent_proposal_snapshot_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_snapshots cannot be deleted (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_no_delete
  BEFORE DELETE ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_proposal_snapshot_delete();

-- =============================================================================
-- PROPOSAL SNAPSHOTS VALIDATION TRIGGER (DB-level enforcement)
-- =============================================================================

-- All artifact_ids must:
-- 1. Belong to the same proposal_id
-- 2. Reference the same intelligence_version_id
-- 3. Have status = 'generated'
-- Additionally:
-- 4. The pinned intelligence version must be status = 'confirmed' (not superseded)
CREATE OR REPLACE FUNCTION validate_proposal_snapshot_artifacts()
RETURNS TRIGGER AS $$
DECLARE
  v_artifact RECORD;
  v_artifact_id UUID;
  v_intel_status intelligence_status;
BEGIN
  -- Check intelligence version is confirmed (not superseded)
  SELECT status INTO v_intel_status FROM intelligence_versions WHERE id = NEW.intelligence_version_id;
  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'intelligence_version_id % not found', NEW.intelligence_version_id;
  END IF;
  IF v_intel_status != 'confirmed' THEN
    RAISE EXCEPTION 'snapshot intelligence_version must be confirmed, got: %', v_intel_status;
  END IF;

  -- Check each artifact
  FOREACH v_artifact_id IN ARRAY NEW.artifact_ids
  LOOP
    SELECT proposal_id, intelligence_version_id, status
    INTO v_artifact
    FROM boe_artifacts
    WHERE id = v_artifact_id;

    IF v_artifact IS NULL THEN
      RAISE EXCEPTION 'artifact % not found', v_artifact_id;
    END IF;

    IF v_artifact.proposal_id != NEW.proposal_id THEN
      RAISE EXCEPTION 'artifact % belongs to different proposal', v_artifact_id;
    END IF;

    IF v_artifact.intelligence_version_id != NEW.intelligence_version_id THEN
      RAISE EXCEPTION 'artifact % references different intelligence version', v_artifact_id;
    END IF;

    IF v_artifact.status != 'generated' THEN
      RAISE EXCEPTION 'artifact % must have status=generated, got: %', v_artifact_id, v_artifact.status;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_validate_artifacts
  BEFORE INSERT ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION validate_proposal_snapshot_artifacts();

-- =============================================================================
-- PROPOSAL SNAPSHOTS RLS
-- =============================================================================

ALTER TABLE proposal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_snapshots_tenant_isolation ON proposal_snapshots
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SHARE LINK EXTENSIONS
-- =============================================================================

ALTER TABLE boe_share_links
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES boe_artifacts(id),
  ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES proposal_snapshots(id);

CREATE INDEX IF NOT EXISTS idx_boe_share_links_artifact ON boe_share_links(artifact_id)
  WHERE artifact_id IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE boe_artifacts IS 'Immutable BOE documents generated from confirmed intelligence + active WBS + approved pricing';
COMMENT ON COLUMN boe_artifacts.content IS 'JSONB: structured document with sections, estimate line tables, calc traces';
COMMENT ON COLUMN boe_artifacts.content_hash IS 'SHA-256 of canonical-serialized content for integrity verification';

COMMENT ON TABLE boe_citations IS 'Links artifact estimate lines to requirement_links for evidence chain';
COMMENT ON COLUMN boe_citations.artifact_line_id IS 'Matches content.sections[].lines[].lineId in parent artifact';
COMMENT ON COLUMN boe_citations.requirement_link_id IS 'ON DELETE RESTRICT: cited links cannot be deleted while artifact exists';

COMMENT ON TABLE proposal_snapshots IS 'As-submitted records pinning exact versions; immutable one-shot';
COMMENT ON COLUMN proposal_snapshots.composite_hash IS 'SHA-256 over intelligence.confirmation_hash and all artifact content_hashes';

COMMENT ON COLUMN boe_share_links.artifact_id IS 'When set, link resolves to this specific artifact instead of live proposal data';
COMMENT ON COLUMN boe_share_links.snapshot_id IS 'When set, link resolves to this submission snapshot';
