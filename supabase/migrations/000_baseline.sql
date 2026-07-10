-- ============================================================================
-- BASELINE MIGRATION
-- ============================================================================
-- This migration creates the base schema that was originally created via
-- the Supabase dashboard. It must run before all other migrations.
--
-- Tables created:
--   - companies
--   - company_roles
--   - company_settings
--   - proposals (without working_data - added by 001)
--   - requirements
--   - wbs_elements
--   - wbs_submissions
--   - compliance_items
--   - content_library
--   - boe_share_links
--
-- Note: This migration uses IF NOT EXISTS to be idempotent for existing databases.
-- ============================================================================

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  sam_uei TEXT,
  cage_code TEXT,
  duns_number TEXT,
  duns TEXT,
  ein TEXT,
  naics_codes TEXT[],
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  address JSONB DEFAULT '{}'::JSONB,
  gsa_contract_number TEXT,
  gsa_mas_schedule BOOLEAN DEFAULT false,
  gsa_config JSONB DEFAULT '{}'::JSONB,
  idiq_contracts JSONB DEFAULT '[]'::JSONB,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN companies.gsa_config IS 'GSA Schedule configuration: { gsaMasSchedule, gsaContractNumber, gsaEscalationRate, gsaBaseYear, gsaSins }';

-- ============================================================================
-- COMPANY ROLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  labor_category TEXT,
  gsa_labor_category TEXT,
  gsa_sin TEXT,
  soc_code TEXT,
  soc_title TEXT,
  sca_code TEXT,
  sca_occupation TEXT,
  category TEXT,
  education JSONB,
  certifications TEXT[],
  min_years_experience INTEGER,
  base_salary NUMERIC(10,2),
  level_salaries JSONB DEFAULT '{}'::JSONB,
  salary_levels JSONB DEFAULT '[]'::JSONB,
  functional_responsibilities TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- COMPANY SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  fringe_rate NUMERIC(5,4) DEFAULT 0.35,
  overhead_rate NUMERIC(5,4) DEFAULT 0.15,
  ga_rate NUMERIC(5,4) DEFAULT 0.08,
  profit_rate NUMERIC(5,4) DEFAULT 0.10,
  standard_hours INTEGER DEFAULT 2080,
  fiscal_year INTEGER DEFAULT 2024,
  rate_source TEXT DEFAULT 'internal',
  content_library JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PROPOSALS (base - working_data added by migration 001)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  solicitation_number TEXT,
  client TEXT,
  agency TEXT,
  client_agency TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'won', 'lost', 'archived')),
  contract_type TEXT DEFAULT 'tm',
  due_date DATE,
  estimated_value NUMERIC(12,2),
  total_value NUMERIC(15,2),
  period_of_performance JSONB DEFAULT '{"baseYear": true, "optionYears": 2}'::JSONB,
  team_size INTEGER,
  progress INTEGER DEFAULT 0,
  starred BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  strategy JSONB DEFAULT '{}'::JSONB,
  ai_summary JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- REQUIREMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  reference_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'shall',
  category TEXT,
  source TEXT,
  priority TEXT DEFAULT 'medium',
  linked_wbs_id UUID,
  linked_wbs_ids UUID[] DEFAULT '{}'::UUID[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- WBS ELEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS wbs_elements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES wbs_elements(id) ON DELETE CASCADE,
  wbs_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 1,
  element_type TEXT DEFAULT 'task',
  labor_hours NUMERIC(10,2),
  labor_cost NUMERIC(12,2),
  material_cost NUMERIC(12,2),
  total_cost NUMERIC(12,2),
  status TEXT DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- COMPLIANCE ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  requirement_text TEXT NOT NULL,
  section_reference TEXT,
  compliance_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CONTENT LIBRARY
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- BOE SHARE LINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS boe_share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  link_type TEXT DEFAULT 'accountant' CHECK (link_type IN ('accountant', 'boe')),
  label TEXT,
  reviewer_email TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0 NOT NULL,
  last_viewed_at TIMESTAMPTZ,
  approval_status TEXT DEFAULT 'pending',
  accountant_note TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_proposals_company_id ON proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_company_roles_company_id ON company_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_requirements_proposal_id ON requirements(proposal_id);
CREATE INDEX IF NOT EXISTS idx_wbs_elements_proposal_id ON wbs_elements(proposal_id);
CREATE INDEX IF NOT EXISTS idx_wbs_elements_parent_id ON wbs_elements(parent_id);
CREATE INDEX IF NOT EXISTS idx_boe_share_links_token ON boe_share_links(token);
CREATE INDEX IF NOT EXISTS idx_boe_share_links_proposal_id ON boe_share_links(proposal_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_roles_updated_at ON company_roles;
CREATE TRIGGER update_company_roles_updated_at
  BEFORE UPDATE ON company_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_requirements_updated_at ON requirements;
CREATE TRIGGER update_requirements_updated_at
  BEFORE UPDATE ON requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wbs_elements_updated_at ON wbs_elements;
CREATE TRIGGER update_wbs_elements_updated_at
  BEFORE UPDATE ON wbs_elements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_boe_share_links_updated_at ON boe_share_links;
CREATE TRIGGER update_boe_share_links_updated_at
  BEFORE UPDATE ON boe_share_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
