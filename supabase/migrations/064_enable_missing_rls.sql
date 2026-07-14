-- ============================================================================
-- SECURITY FIX: Enable RLS on tables missing policies
-- Resolves Supabase security alert: rls_disabled_in_public
-- ============================================================================

-- =============================================================================
-- COMPLIANCE_ITEMS
-- =============================================================================
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_items_tenant_isolation ON compliance_items
  FOR ALL
  USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN tenant_memberships tm ON p.company_id = (
        SELECT company_id FROM tenants WHERE id = tm.tenant_id
      )
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- CONTENT_LIBRARY
-- =============================================================================
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_library_tenant_isolation ON content_library
  FOR ALL
  USING (
    company_id IN (
      SELECT t.company_id FROM tenants t
      JOIN tenant_memberships tm ON t.id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- BOE_SHARE_LINKS
-- =============================================================================
-- Note: Share links need dual access:
-- 1. Authenticated users: access their own company's links
-- 2. Public access via token (for share functionality)

ALTER TABLE boe_share_links ENABLE ROW LEVEL SECURITY;

-- Owner access (authenticated users)
CREATE POLICY boe_share_links_owner_access ON boe_share_links
  FOR ALL
  USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN tenant_memberships tm ON p.company_id = (
        SELECT company_id FROM tenants WHERE id = tm.tenant_id
      )
      WHERE tm.user_id = auth.uid()
    )
  );

-- Public token access (SELECT only, for share link viewing)
CREATE POLICY boe_share_links_public_token ON boe_share_links
  FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- =============================================================================
-- BACKFILL_RATE_SNAPSHOT
-- =============================================================================
ALTER TABLE backfill_rate_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY backfill_rate_snapshot_tenant_isolation ON backfill_rate_snapshot
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );
