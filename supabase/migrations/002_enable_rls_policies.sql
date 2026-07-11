-- ============================================================================
-- Enable RLS and create policies for all tables (idempotent — safe to re-run)
-- Run this in Supabase SQL Editor AFTER 001_add_working_data.sql
-- ============================================================================

-- ===== COMPANIES =====
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company" ON companies;
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own company" ON companies;
CREATE POLICY "Users can create own company"
  ON companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own company" ON companies;
CREATE POLICY "Users can update own company"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own company" ON companies;
CREATE POLICY "Users can delete own company"
  ON companies FOR DELETE
  USING (owner_id = auth.uid());

-- ===== COMPANY_SETTINGS =====
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
CREATE POLICY "Users can view own company settings"
  ON company_settings FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create own company settings" ON company_settings;
CREATE POLICY "Users can create own company settings"
  ON company_settings FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
CREATE POLICY "Users can update own company settings"
  ON company_settings FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== COMPANY_ROLES =====
ALTER TABLE company_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company roles" ON company_roles;
CREATE POLICY "Users can view own company roles"
  ON company_roles FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create own company roles" ON company_roles;
CREATE POLICY "Users can create own company roles"
  ON company_roles FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own company roles" ON company_roles;
CREATE POLICY "Users can update own company roles"
  ON company_roles FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete own company roles" ON company_roles;
CREATE POLICY "Users can delete own company roles"
  ON company_roles FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== PROPOSALS =====
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own proposals" ON proposals;
CREATE POLICY "Users can view own proposals"
  ON proposals FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create own proposals" ON proposals;
CREATE POLICY "Users can create own proposals"
  ON proposals FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
CREATE POLICY "Users can update own proposals"
  ON proposals FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete own proposals" ON proposals;
CREATE POLICY "Users can delete own proposals"
  ON proposals FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

-- ===== REQUIREMENTS =====
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own requirements" ON requirements;
CREATE POLICY "Users can view own requirements"
  ON requirements FOR SELECT
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can create own requirements" ON requirements;
CREATE POLICY "Users can create own requirements"
  ON requirements FOR INSERT
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can update own requirements" ON requirements;
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

DROP POLICY IF EXISTS "Users can delete own requirements" ON requirements;
CREATE POLICY "Users can delete own requirements"
  ON requirements FOR DELETE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

-- ===== WBS_ELEMENTS =====
ALTER TABLE wbs_elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wbs elements" ON wbs_elements;
CREATE POLICY "Users can view own wbs elements"
  ON wbs_elements FOR SELECT
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can create own wbs elements" ON wbs_elements;
CREATE POLICY "Users can create own wbs elements"
  ON wbs_elements FOR INSERT
  WITH CHECK (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can update own wbs elements" ON wbs_elements;
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

DROP POLICY IF EXISTS "Users can delete own wbs elements" ON wbs_elements;
CREATE POLICY "Users can delete own wbs elements"
  ON wbs_elements FOR DELETE
  USING (proposal_id IN (
    SELECT id FROM proposals WHERE company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  ));
