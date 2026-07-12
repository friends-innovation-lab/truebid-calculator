-- Migration: 043_intelligence_document_set
-- Phase 4B Pillar 1: Link intelligence versions to source document sets
--
-- Adds document_set_hash to track which documents an intelligence version
-- was extracted from. New documents invalidate existing versions.
-- Also adds fact_conflicts to record when documents disagree.

-- Add document_set_hash to intelligence_versions
ALTER TABLE intelligence_versions
ADD COLUMN document_set_hash TEXT;

-- Add fact_conflicts to track when documents disagree on a fact
ALTER TABLE intelligence_versions
ADD COLUMN fact_conflicts JSONB DEFAULT '[]';

-- Add index for document set lookups
CREATE INDEX idx_intelligence_versions_doc_set
  ON intelligence_versions(proposal_id, document_set_hash);

-- Comments documenting the columns
COMMENT ON COLUMN intelligence_versions.document_set_hash IS
  'SHA-256 of sorted document content hashes; new document invalidates existing versions requiring re-extraction';

COMMENT ON COLUMN intelligence_versions.fact_conflicts IS
  'Array of fact conflicts when multiple documents provide different values for the same fact. Structure: [{factKey, documents: [{documentId, documentType, value, precedenceRank}], resolvedValue, resolutionSource}]';

-- Function to compute document set hash for a proposal
-- Returns SHA-256 of sorted content hashes from all extracted documents
CREATE OR REPLACE FUNCTION compute_document_set_hash(v_proposal_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT encode(
    sha256(
      string_agg(content_hash, '|' ORDER BY content_hash)::bytea
    ),
    'hex'
  )
  INTO v_hash
  FROM solicitation_documents
  WHERE proposal_id = v_proposal_id
    AND status = 'extracted'
    AND content_hash IS NOT NULL;

  RETURN v_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if document set has changed since last extraction
-- Returns true if documents have been added/modified/removed
CREATE OR REPLACE FUNCTION document_set_changed(
  v_proposal_id UUID,
  v_current_hash TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_new_hash TEXT;
BEGIN
  v_new_hash := compute_document_set_hash(v_proposal_id);

  -- If no documents yet, no change (nothing to extract from)
  IF v_new_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If no current hash, documents exist so there's been a change
  IF v_current_hash IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_new_hash != v_current_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments on functions
COMMENT ON FUNCTION compute_document_set_hash IS
  'Computes SHA-256 of sorted content hashes from all extracted documents for a proposal';

COMMENT ON FUNCTION document_set_changed IS
  'Returns true if the document set has changed since the given hash was computed';
