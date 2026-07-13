-- Phase UI Prep: Solicitation Brief + Fact Evidence
-- Adds solicitation_brief JSONB column to intelligence_versions
-- Creates fact_evidence table for storing evidence quotes
--
-- ROLLBACK:
--   ALTER TABLE intelligence_versions DROP COLUMN IF EXISTS solicitation_brief;
--   DROP TABLE IF EXISTS fact_evidence CASCADE;

-- =============================================================================
-- FACT EVIDENCE TABLE
-- =============================================================================
-- Stores verbatim quotes from solicitation documents that serve as evidence
-- for extracted facts (e.g., challenge cards in solicitation_brief).
-- Protected by the same immutability trigger as other fact tables.

CREATE TABLE fact_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  source_document_id UUID REFERENCES solicitation_documents(id),
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT quote_not_empty CHECK (length(trim(quote_text)) > 0)
);

CREATE INDEX idx_fact_evidence_version ON fact_evidence(intelligence_version_id);
CREATE INDEX idx_fact_evidence_document ON fact_evidence(source_document_id) WHERE source_document_id IS NOT NULL;

-- Apply immutability trigger (same pattern as other fact tables)
-- Uses existing check_fact_table_parent_draft() from migration 033
CREATE TRIGGER enforce_fact_evidence_parent_draft
  BEFORE INSERT OR UPDATE OR DELETE ON fact_evidence
  FOR EACH ROW
  EXECUTE FUNCTION check_fact_table_parent_draft();

-- =============================================================================
-- SOLICITATION BRIEF COLUMN
-- =============================================================================
-- Structured brief describing what the government wants:
-- {
--   summary: string,           -- 1-2 sentence summary
--   rationale: string,         -- Why this matters to agency
--   challenges: [{             -- 2-4 key challenges
--     title: string,
--     description: string,
--     evidence_refs: UUID[]    -- References to fact_evidence.id
--   }],
--   evaluation_emphasis: string  -- What evaluation prioritizes
-- }

ALTER TABLE intelligence_versions
ADD COLUMN solicitation_brief JSONB DEFAULT NULL;

COMMENT ON COLUMN intelligence_versions.solicitation_brief IS
'Structured brief: { summary, rationale, challenges[], evaluation_emphasis }. Generated at extraction, frozen on confirm, included in confirmation hash.';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE fact_evidence ENABLE ROW LEVEL SECURITY;

-- Inherit isolation from parent intelligence_versions
CREATE POLICY fact_evidence_tenant_isolation ON fact_evidence
  FOR ALL
  USING (
    intelligence_version_id IN (
      SELECT iv.id FROM intelligence_versions iv
      JOIN tenant_memberships tm ON iv.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE fact_evidence IS 'Verbatim quotes from solicitation documents serving as evidence for extracted facts. Protected by immutability trigger - rows frozen once parent version is confirmed.';
COMMENT ON COLUMN fact_evidence.quote_text IS 'Verbatim quote from the source document. Must be non-empty.';
COMMENT ON COLUMN fact_evidence.source_document_id IS 'FK to solicitation_documents if quote is traceable to a specific uploaded document.';
COMMENT ON COLUMN fact_evidence.page_number IS 'Page number in source document where quote appears, if known.';
