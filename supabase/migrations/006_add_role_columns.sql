-- Add missing columns to company_roles table

-- Description field
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS description TEXT;

-- Functional responsibilities for labor category descriptions
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS functional_responsibilities TEXT;

-- SOC/BLS title (we already have soc_code)
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS soc_title TEXT;

-- GSA mapping
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS gsa_labor_category TEXT;
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS gsa_sin TEXT;

-- Service Contract Act fields
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS sca_code TEXT;
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS sca_occupation TEXT;
