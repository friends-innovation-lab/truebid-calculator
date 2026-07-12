-- Fix health_check_proposal_count: companies doesn't have tenant_id
-- The relationship is: tenants.company_id -> companies.id

CREATE OR REPLACE FUNCTION public.health_check_proposal_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id UUID;
  v_count INTEGER;
BEGIN
  -- Find company via tenant (tenants.company_id -> companies.id)
  SELECT t.company_id INTO v_company_id
  FROM public.tenants t
  WHERE t.name = 'FFTC'
    AND t.company_id IS NOT NULL
  LIMIT 1;

  IF v_company_id IS NULL THEN
    -- Fallback: first tenant with a company
    SELECT t.company_id INTO v_company_id
    FROM public.tenants t
    WHERE t.company_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Count non-archived proposals for this company
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.proposals p
  WHERE p.company_id = v_company_id
    AND p.archived = FALSE;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Re-grant execute to anon (CREATE OR REPLACE preserves grants, but be explicit)
REVOKE ALL ON FUNCTION public.health_check_proposal_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.health_check_proposal_count() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.health_check_proposal_count() TO anon;
