-- Phase 1: Multi-tenancy tables
-- tenants + tenant_memberships for role-based access control
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS tenant_memberships CASCADE;
--   DROP TABLE IF EXISTS tenants CASCADE;
--   DROP FUNCTION IF EXISTS increment_row_version() CASCADE;

-- Create row_version function first (used by later migrations)
CREATE OR REPLACE FUNCTION increment_row_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
-- A tenant represents an organization (company) in the system.
-- This is the multi-tenancy boundary for data isolation.

CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  -- Link to existing companies table for transition period
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_company ON tenants(company_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- =============================================================================
-- TENANT MEMBERSHIPS TABLE
-- =============================================================================
-- Links users to tenants with role-based permissions.

CREATE TABLE tenant_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'estimator'
    CHECK (role IN ('owner', 'admin', 'estimator', 'writer', 'reviewer', 'accountant')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_memberships_role ON tenant_memberships(tenant_id, role);

-- RLS
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Users can see their own membership row (avoids recursion)
CREATE POLICY "Users view own membership"
  ON tenant_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Owner/admin can view all memberships in their tenant
-- Uses EXISTS with SECURITY DEFINER function to avoid recursion
CREATE OR REPLACE FUNCTION is_tenant_admin(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;

CREATE POLICY "Admin view all tenant memberships"
  ON tenant_memberships
  FOR SELECT TO authenticated
  USING (is_tenant_admin(tenant_id));

-- Only owner/admin can manage (insert/update/delete) memberships
CREATE POLICY "Admin manage memberships"
  ON tenant_memberships
  FOR ALL TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

-- =============================================================================
-- BACKFILL: Create FFTC tenant and memberships
-- =============================================================================
-- Role assignment rules:
--   - Company owner → 'owner' role
--   - All other existing users → 'estimator' role (can be promoted manually)
--
-- NOTE: Removed substring matching for admin role assignment.
-- Admin roles should be granted explicitly via the UI after migration.
--
-- IMPORTANT: Before running, verify auth.users contains expected users.
-- Run this query to list users: SELECT id, email FROM auth.users;

DO $$
DECLARE
  company_record RECORD;
  new_tenant_id UUID;
  user_record RECORD;
BEGIN
  -- Create a tenant for each existing company
  FOR company_record IN
    SELECT id, name, owner_id
    FROM companies
    WHERE id IS NOT NULL
  LOOP
    -- Create tenant
    INSERT INTO tenants (name, slug, company_id, created_by)
    VALUES (
      company_record.name,
      LOWER(REPLACE(REPLACE(company_record.name, ' ', '-'), '.', '')),
      company_record.id,
      company_record.owner_id
    )
    RETURNING id INTO new_tenant_id;

    -- Create owner membership for company owner
    INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
    VALUES (new_tenant_id, company_record.owner_id, 'owner', 'active')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    -- Add all other auth users to this tenant as estimators
    -- Admin roles should be granted explicitly via UI
    FOR user_record IN
      SELECT id, email FROM auth.users
      WHERE id != company_record.owner_id
    LOOP
      INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
      VALUES (new_tenant_id, user_record.id, 'estimator', 'active')
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- POST-MIGRATION VERIFICATION:
-- Run this to verify role assignments:
--   SELECT tm.role, u.email
--   FROM tenant_memberships tm
--   JOIN auth.users u ON tm.user_id = u.id;

-- =============================================================================
-- RLS POLICIES (added after both tables exist)
-- =============================================================================

-- Enable RLS on tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Members can view their tenant
CREATE POLICY "Members view own tenant"
  ON tenants
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only owner/admin can update tenant
CREATE POLICY "Owner/admin update tenant"
  ON tenants
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  )
  WITH CHECK (
    id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE tenants IS 'Multi-tenancy root: each tenant is an organization with isolated data';
COMMENT ON TABLE tenant_memberships IS 'User-tenant relationships with role-based permissions';
COMMENT ON COLUMN tenant_memberships.role IS 'owner=full control, admin=manage users, estimator=pricing work, writer=proposal text, reviewer=approvals, accountant=rates';
