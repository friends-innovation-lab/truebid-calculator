-- Phase 6A: Requirements Normalization
-- Add tenant_id, intelligence_version_id to requirements; create requirement_links
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS requirement_links CASCADE;
--   DROP TYPE IF EXISTS link_source_type CASCADE;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS tenant_id;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS intelligence_version_id;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS source_document_id;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS source_section;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS compliance_strength;
--   ALTER TABLE requirements DROP COLUMN IF EXISTS row_version;

-- =============================================================================
-- REQUIREMENTS TABLE ENHANCEMENTS
-- =============================================================================

-- Add new columns
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS intelligence_version_id UUID REFERENCES intelligence_versions(id),
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES solicitation_documents(id),
  ADD COLUMN IF NOT EXISTS source_section TEXT,
  ADD COLUMN IF NOT EXISTS compliance_strength TEXT CHECK (compliance_strength IN ('shall', 'should', 'may', 'info')),
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

-- Backfill tenant_id from tenants via proposals.company_id
-- Note: tenant.company_id references the company, not tenant.id = company.id
UPDATE requirements r
SET tenant_id = (
  SELECT t.id FROM tenants t
  JOIN proposals p ON t.company_id = p.company_id
  WHERE p.id = r.proposal_id
)
WHERE r.tenant_id IS NULL;

-- Make tenant_id NOT NULL after backfill
ALTER TABLE requirements ALTER COLUMN tenant_id SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_requirements_intelligence ON requirements(intelligence_version_id);
CREATE INDEX IF NOT EXISTS idx_requirements_tenant ON requirements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requirements_document ON requirements(source_document_id);

-- Row version trigger
CREATE TRIGGER requirements_row_version
  BEFORE UPDATE ON requirements
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- =============================================================================
-- REQUIREMENT LINKS TABLE
-- =============================================================================

CREATE TYPE link_source_type AS ENUM ('ai', 'user');

CREATE TABLE requirement_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  wbs_task_id UUID NOT NULL REFERENCES wbs_tasks(id) ON DELETE CASCADE,

  link_source link_source_type NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique pair
  CONSTRAINT unique_requirement_task_link UNIQUE (requirement_id, wbs_task_id)
);

CREATE INDEX idx_requirement_links_req ON requirement_links(requirement_id);
CREATE INDEX idx_requirement_links_task ON requirement_links(wbs_task_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- requirements: update existing policy to use tenant_id
-- First drop existing policies if any
DROP POLICY IF EXISTS requirements_tenant_isolation ON requirements;

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirements_tenant_isolation ON requirements
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- requirement_links: inherit isolation from parent requirement
ALTER TABLE requirement_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_links_via_requirement ON requirement_links
  FOR ALL
  USING (
    requirement_id IN (
      SELECT r.id FROM requirements r
      JOIN tenant_memberships tm ON r.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE requirement_links IS 'Links requirements to WBS tasks; source tracks AI vs user origin';
COMMENT ON COLUMN requirements.intelligence_version_id IS 'FK to intelligence_versions; requirements are extracted facts versioned with intelligence';
COMMENT ON COLUMN requirements.compliance_strength IS 'Shall/should/may/info classification from source document';
COMMENT ON COLUMN requirements.source_section IS 'E.g., "Section C.3.2"';
