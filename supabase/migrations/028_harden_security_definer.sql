-- Harden SECURITY DEFINER function against search-path hijacking
--
-- ROLLBACK:
--   CREATE OR REPLACE FUNCTION is_tenant_admin(check_tenant_id UUID)
--   RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
--   AS $$ SELECT EXISTS (...) $$;
--   GRANT EXECUTE ON FUNCTION is_tenant_admin(UUID) TO PUBLIC;

-- Recreate with empty search_path (forces fully qualified names)
CREATE OR REPLACE FUNCTION is_tenant_admin(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;

-- Revoke all access, grant only to authenticated role
REVOKE EXECUTE ON FUNCTION is_tenant_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_tenant_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION is_tenant_admin(UUID) TO authenticated;

COMMENT ON FUNCTION is_tenant_admin(UUID) IS
  'Check if current user is owner/admin of the given tenant. SECURITY DEFINER with hardened search_path.';
