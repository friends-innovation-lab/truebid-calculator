-- ============================================================================
-- Enable RLS and create policies for all tables
-- Run this in Supabase SQL Editor AFTER 001_add_working_data.sql
-- ============================================================================

-- ===== COMPANIES =====
-- Users can only access companies they own

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own company"
  ON companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own company"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own company"
  ON companies FOR DELETE
  USING (owner_id = auth.uid());

-- ===== COMPANY_SETTINGS =====
-- Users can only access settings for companies they own

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings"
  ON company_settings FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can create own company settings"
  ON company_settings FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update own company settings"
  ON company_settings FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== COMPANY_ROLES =====
-- Users can only access roles for companies they own

ALTER TABLE company_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company roles"
  ON company_roles FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can create own company roles"
  ON company_roles FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update own company roles"
  ON company_roles FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete own company roles"
  ON company_roles FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== PROPOSALS =====
-- Users can only access proposals for companies they own

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals"
  ON proposals FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can create own proposals"
  ON proposals FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update own proposals"
  ON proposals FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete own proposals"
  ON proposals FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== REQUIREMENTS =====
-- Users can only access requirements on proposals they own

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requirements"
  ON requirements FOR SELECT
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create own requirements"
  ON requirements FOR INSERT
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update own requirements"
  ON requirements FOR UPDATE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ))
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete own requirements"
  ON requirements FOR DELETE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

-- ===== WBS_ELEMENTS =====
-- Users can only access WBS elements on proposals they own

ALTER TABLE wbs_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wbs elements"
  ON wbs_elements FOR SELECT
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create own wbs elements"
  ON wbs_elements FOR INSERT
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update own wbs elements"
  ON wbs_elements FOR UPDATE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ))
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete own wbs elements"
  ON wbs_elements FOR DELETE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));
