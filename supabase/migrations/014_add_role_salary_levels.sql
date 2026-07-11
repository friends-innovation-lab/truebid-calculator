-- ============================================================================
-- Add education and salary_levels columns to company_roles
-- ============================================================================

-- Education requirement (e.g., "Bachelor's Degree")
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS education TEXT;

-- Certifications as JSONB array
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';

-- Salary levels as JSONB array with IC levels and steps
-- Structure: [{ level: "IC1", level_title: "Associate", steps: [87000, 89610] }, ...]
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS salary_levels JSONB DEFAULT '[]';
