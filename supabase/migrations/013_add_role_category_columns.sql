-- ============================================================================
-- Add category, labor_category, and notes columns to company_roles
-- ============================================================================

-- Category (Engineering, Design, Product, etc.)
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS category TEXT;

-- Labor category (IC1 Associate, IC2 Intermediate, etc.)
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS labor_category TEXT;

-- Notes for additional context
ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS notes TEXT;
