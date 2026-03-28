-- Add working_data JSONB column to proposals table
-- This stores the full proposal workspace state (solicitation details,
-- selected roles, subcontractors, WBS elements, etc.) that was previously
-- stored in localStorage under `truebid-proposal-data-{id}`.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS working_data JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN proposals.working_data IS 'Full proposal workspace state: solicitation, selectedRoles, subcontractors, teamingPartners, estimateWbsElements, rateJustifications, odcs, perDiem';
