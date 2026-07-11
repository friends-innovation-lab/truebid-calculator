-- ============================================================================
-- Add address and other missing columns to companies table
-- ============================================================================

-- Address as JSONB to store street, city, state, zip, businessSize
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}';

-- GSA contract fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gsa_contract_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gsa_mas_schedule BOOLEAN DEFAULT false;

-- IDIQ contracts as JSONB array
ALTER TABLE companies ADD COLUMN IF NOT EXISTS idiq_contracts JSONB DEFAULT '[]';
