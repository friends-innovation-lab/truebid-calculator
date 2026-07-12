-- Phase 5: Tenant Disciplines
-- Tenant-scoped discipline taxonomy (replaces hardcoded list)
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS tenant_disciplines CASCADE;

-- =============================================================================
-- TENANT DISCIPLINES TABLE
-- =============================================================================
-- Each tenant has their own set of active disciplines.
-- Seeded with standard set; tenants can deactivate but not delete.

CREATE TABLE tenant_disciplines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Discipline identity
  key TEXT NOT NULL,                     -- 'engineering', 'design', etc.
  display_name TEXT NOT NULL,            -- 'Engineering', 'Design', etc.

  -- Configuration
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one discipline key per tenant
  CONSTRAINT unique_discipline_per_tenant UNIQUE (tenant_id, key)
);

-- Indexes
CREATE INDEX idx_tenant_disciplines_tenant ON tenant_disciplines(tenant_id);
CREATE INDEX idx_tenant_disciplines_key ON tenant_disciplines(tenant_id, key);
CREATE INDEX idx_tenant_disciplines_active ON tenant_disciplines(tenant_id, active) WHERE active = true;

-- Updated_at trigger
CREATE TRIGGER tenant_disciplines_updated_at
  BEFORE UPDATE ON tenant_disciplines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE tenant_disciplines ENABLE ROW LEVEL SECURITY;

-- Members can view their tenant's disciplines
CREATE POLICY "Members view tenant disciplines"
  ON tenant_disciplines
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

-- Admin/owner can manage disciplines
CREATE POLICY "Admin manage tenant disciplines"
  ON tenant_disciplines
  FOR ALL TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

-- =============================================================================
-- SEED FUNCTION
-- =============================================================================
-- Seeds standard disciplines for a tenant. Called during tenant creation
-- and during backfill for existing tenants.

CREATE OR REPLACE FUNCTION seed_tenant_disciplines(v_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Standard 10 disciplines per Phase 5 spec
  INSERT INTO tenant_disciplines (tenant_id, key, display_name, sort_order)
  VALUES
    (v_tenant_id, 'engineering', 'Engineering', 10),
    (v_tenant_id, 'design', 'Design', 20),
    (v_tenant_id, 'research', 'Research', 30),
    (v_tenant_id, 'product', 'Product', 40),
    (v_tenant_id, 'delivery', 'Delivery', 50),
    (v_tenant_id, 'program-management', 'Program Management', 60),
    (v_tenant_id, 'content', 'Content Strategy', 70),
    (v_tenant_id, 'accessibility', 'Accessibility', 80),
    (v_tenant_id, 'data', 'Data & Analytics', 90),
    (v_tenant_id, 'security', 'Security', 100)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$$;

-- =============================================================================
-- BACKFILL: Seed disciplines for all existing tenants
-- =============================================================================

DO $$
DECLARE
  v_tenant RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_tenant IN
    SELECT id FROM tenants WHERE status = 'active'
  LOOP
    PERFORM seed_tenant_disciplines(v_tenant.id);
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Seeded disciplines for % tenants', v_count;
END $$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenant_disciplines IS 'Tenant-scoped discipline taxonomy for labor categorization';
COMMENT ON COLUMN tenant_disciplines.key IS 'Machine key for discipline (engineering, design, etc.)';
COMMENT ON COLUMN tenant_disciplines.display_name IS 'Human-readable discipline name';
COMMENT ON COLUMN tenant_disciplines.active IS 'Soft-disable; inactive disciplines hidden from UI but preserved for historical data';
COMMENT ON FUNCTION seed_tenant_disciplines(UUID) IS 'Seeds standard disciplines for a tenant; idempotent via ON CONFLICT';
