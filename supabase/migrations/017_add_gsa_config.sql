-- ============================================================================
-- Add gsa_config JSONB column to companies table
-- Stores GSA schedule configuration including SINs and ceiling rates
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS gsa_config JSONB DEFAULT '{}';

COMMENT ON COLUMN companies.gsa_config IS 'GSA Schedule configuration: {
  gsaMasSchedule: boolean,
  gsaContractNumber: string,
  gsaEscalationRate: number,
  gsaBaseYear: number,
  gsaSins: [{ id, sin, title, laborCategories: [{ id, laborCategory, hourlyRate, ... }] }]
}';
