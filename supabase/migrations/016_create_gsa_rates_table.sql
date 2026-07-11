-- ============================================================================
-- Create gsa_rates table for GSA ceiling rates
-- ============================================================================

CREATE TABLE IF NOT EXISTS gsa_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL
    REFERENCES companies(id) ON DELETE CASCADE,
  labor_category TEXT NOT NULL,
  sin TEXT NOT NULL,
  schedule_name TEXT DEFAULT 'GSA MAS',
  year_1_rate DECIMAL(10,2),
  year_2_rate DECIMAL(10,2),
  year_3_rate DECIMAL(10,2),
  year_4_rate DECIMAL(10,2),
  year_5_rate DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsa_rates_company
  ON gsa_rates(company_id);

ALTER TABLE gsa_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages GSA rates" ON gsa_rates;
CREATE POLICY "Owner manages GSA rates"
  ON gsa_rates FOR ALL
  USING (company_id IN (
    SELECT id FROM companies
    WHERE owner_id = auth.uid()
  ));
