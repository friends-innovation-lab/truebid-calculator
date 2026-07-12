-- Health check function for unauthenticated /api/health endpoint
-- SECURITY DEFINER pattern: runs with definer's privileges, not caller's
-- Hardened: search_path = '', fully qualified tables, minimal grants

CREATE OR REPLACE FUNCTION public.health_check_proposal_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  -- Find FFTC tenant by name
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE name = 'FFTC'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Fallback: find first tenant if FFTC doesn't exist (e.g., different prod setup)
    SELECT id INTO v_tenant_id
    FROM public.tenants
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Count non-archived proposals for this tenant
  -- Matches dashboard visibility: proposals.company_id -> companies.id where tenant_id matches
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.proposals p
  INNER JOIN public.companies c ON p.company_id = c.id
  WHERE c.tenant_id = v_tenant_id
    AND p.archived = FALSE;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Revoke all, then grant EXECUTE only to anon role
REVOKE ALL ON FUNCTION public.health_check_proposal_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.health_check_proposal_count() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.health_check_proposal_count() TO anon;

COMMENT ON FUNCTION public.health_check_proposal_count() IS
  'Returns count of non-archived proposals for FFTC tenant. Used by /api/health endpoint. SECURITY DEFINER with minimal grants.';
