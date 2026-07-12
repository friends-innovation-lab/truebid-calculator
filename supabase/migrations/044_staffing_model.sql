-- Migration: 044_staffing_model
-- Phase 4B Pillar 2: Prescribed Staffing Constraint
--
-- Adds staffing_model to track whether a solicitation prescribes exact roles
-- (closed vocabulary) or expects offeror-proposed staffing.
-- For prescribed contracts, AI-generated roles must match the vocabulary.

-- Staffing model type
CREATE TYPE staffing_model AS ENUM (
  'prescribed',       -- RFP specifies exact roles (use as closed vocabulary)
  'offeror_proposed', -- Offeror proposes team composition (current behavior)
  'unclear'           -- Needs user clarification before WBS generation
);

-- Add staffing_model to intelligence_versions
ALTER TABLE intelligence_versions
ADD COLUMN staffing_model staffing_model NOT NULL DEFAULT 'unclear';

-- Add is_prescribed flag to labor requirements
-- True when role is explicitly named in RFP (key personnel), not inferred
ALTER TABLE intelligence_labor_requirements
ADD COLUMN is_prescribed BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering prescribed roles
CREATE INDEX idx_labor_reqs_prescribed
  ON intelligence_labor_requirements(version_id, is_prescribed)
  WHERE is_prescribed = true;

-- Comments
COMMENT ON COLUMN intelligence_versions.staffing_model IS
  'Whether the RFP prescribes specific roles (closed vocabulary) or expects offeror-proposed staffing. ''unclear'' requires user resolution before WBS generation.';

COMMENT ON COLUMN intelligence_labor_requirements.is_prescribed IS
  'True if this role is explicitly named in the RFP as key personnel or required position, not inferred from scope of work.';

-- Function to get prescribed roles for a proposal
-- Returns role titles that form the closed vocabulary for prescribed contracts
CREATE OR REPLACE FUNCTION get_prescribed_roles(v_proposal_id UUID)
RETURNS TABLE(title TEXT, labor_category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.title,
    lr.labor_category
  FROM intelligence_labor_requirements lr
  JOIN intelligence_versions iv ON lr.version_id = iv.id
  JOIN proposals p ON iv.id = p.active_intelligence_version_id
  WHERE p.id = v_proposal_id
    AND lr.is_prescribed = true
  ORDER BY lr.title;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_prescribed_roles TO authenticated;

COMMENT ON FUNCTION get_prescribed_roles IS
  'Returns prescribed roles for a proposal. Used by WBS validator to enforce role vocabulary on prescribed contracts.';
