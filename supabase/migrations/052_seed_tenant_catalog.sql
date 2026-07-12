-- Phase 5: Seed Tenant Catalog Function
-- Function to seed standard labor catalog for a tenant
-- REVIEW GATE: Actual catalog data loaded via scripts/seed-standard-catalog.ts after approval
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS seed_tenant_labor_catalog(UUID);
--   DROP FUNCTION IF EXISTS seed_fftc_roles_from_json(UUID, JSONB);

-- =============================================================================
-- SEED FFTC ROLES FROM JSON
-- =============================================================================
-- Seeds roles from fftc-roles-v2.json structure.
-- Called by seed script with actual JSON data.

CREATE OR REPLACE FUNCTION seed_fftc_roles_from_json(
  v_tenant_id UUID,
  v_roles_json JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role JSONB;
  v_key TEXT;
  v_discipline TEXT;
  v_levels JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR v_role IN SELECT * FROM jsonb_array_elements(v_roles_json)
  LOOP
    -- Generate key from title
    v_key := LOWER(REPLACE(REPLACE(REPLACE(
      v_role ->> 'title',
      ' ', '_'),
      '-', '_'),
      '/', '_'));

    -- Map title to discipline (Phase 5 spec mappings)
    v_discipline := CASE
      WHEN v_role ->> 'title' IN ('Back-end Developer', 'Front-end Developer', 'DevOps Engineer', 'QA Engineer', 'Technical Lead') THEN 'engineering'
      WHEN v_role ->> 'title' IN ('Product Designer', 'Design Lead') THEN 'design'
      WHEN v_role ->> 'title' = 'UX Researcher' THEN 'research'
      WHEN v_role ->> 'title' = 'Product Manager' THEN 'product'
      WHEN v_role ->> 'title' = 'Delivery Manager' THEN 'delivery'
      WHEN v_role ->> 'title' = 'Content/UX Writer' THEN 'content'
      ELSE 'engineering' -- Default fallback
    END;

    -- Transform salary_levels array to levels JSONB structure
    -- Input: [{ "level": "IC1", "level_title": "Associate", "steps": [87000, 89610] }, ...]
    -- Output: { "levels": [...] }
    v_levels := jsonb_build_object('levels', v_role -> 'salary_levels');

    INSERT INTO tenant_labor_categories (
      tenant_id,
      key,
      title,
      discipline_key,
      description,
      soc_code,
      education,
      levels,
      sort_order
    )
    VALUES (
      v_tenant_id,
      v_key,
      v_role ->> 'title',
      v_discipline,
      v_role ->> 'description',
      v_role ->> 'soc_code',
      v_role ->> 'education',
      v_levels,
      (v_count + 1) * 10
    )
    ON CONFLICT (tenant_id, key) DO UPDATE
    SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      soc_code = EXCLUDED.soc_code,
      education = EXCLUDED.education,
      levels = EXCLUDED.levels,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- SEED ADDITIONAL ROLES (NULL SALARIES - NEEDS SETUP)
-- =============================================================================
-- Seeds the 23 additional roles that need tenant configuration before use.

CREATE OR REPLACE FUNCTION seed_additional_catalog_roles(v_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_sort INTEGER := 200; -- Start after FFTC roles
BEGIN
  -- Engineering discipline (additional)
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'fullstack_developer', 'Full-Stack Developer', 'engineering', NULL, v_sort),
    (v_tenant_id, 'software_architect', 'Software Architect', 'engineering', NULL, v_sort + 10),
    (v_tenant_id, 'solutions_architect', 'Solutions Architect', 'engineering', NULL, v_sort + 20),
    (v_tenant_id, 'platform_engineer', 'Platform Engineer', 'engineering', NULL, v_sort + 30),
    (v_tenant_id, 'sre', 'Site Reliability Engineer', 'engineering', NULL, v_sort + 40)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 5;

  -- Design discipline (additional)
  v_sort := 300;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'visual_designer', 'Visual Designer', 'design', NULL, v_sort),
    (v_tenant_id, 'interaction_designer', 'Interaction Designer', 'design', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Research discipline (additional)
  v_sort := 400;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'service_designer', 'Service Designer', 'research', NULL, v_sort),
    (v_tenant_id, 'research_lead', 'Research Lead', 'research', NULL, v_sort + 10),
    (v_tenant_id, 'user_researcher', 'User Researcher', 'research', NULL, v_sort + 20)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 3;

  -- Delivery discipline (additional)
  v_sort := 500;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'business_analyst', 'Business Analyst', 'delivery', NULL, v_sort)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 1;

  -- Program Management discipline
  v_sort := 600;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'program_manager', 'Program Manager', 'program-management', NULL, v_sort),
    (v_tenant_id, 'agile_coach', 'Agile Coach', 'program-management', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Data & Analytics discipline
  v_sort := 700;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'data_engineer', 'Data Engineer', 'data', NULL, v_sort),
    (v_tenant_id, 'data_analyst', 'Data Analyst', 'data', NULL, v_sort + 10),
    (v_tenant_id, 'data_scientist', 'Data Scientist', 'data', NULL, v_sort + 20),
    (v_tenant_id, 'ml_engineer', 'ML Engineer', 'data', NULL, v_sort + 30)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 4;

  -- Security discipline
  v_sort := 800;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'security_engineer', 'Security Engineer', 'security', NULL, v_sort),
    (v_tenant_id, 'security_analyst', 'Security Analyst', 'security', NULL, v_sort + 10),
    (v_tenant_id, 'security_architect', 'Security Architect', 'security', NULL, v_sort + 20)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 3;

  -- Content discipline (additional)
  v_sort := 900;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'content_strategist', 'Content Strategist', 'content', NULL, v_sort),
    (v_tenant_id, 'ux_writer', 'UX Writer', 'content', NULL, v_sort + 10)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 2;

  -- Accessibility discipline
  v_sort := 1000;
  INSERT INTO tenant_labor_categories (tenant_id, key, title, discipline_key, levels, sort_order)
  VALUES
    (v_tenant_id, 'accessibility_specialist', 'Accessibility Specialist', 'accessibility', NULL, v_sort)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  v_count := v_count + 1;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- SEED STANDARD ALIASES
-- =============================================================================
-- Seeds standard aliases per Phase 5 spec.

CREATE OR REPLACE FUNCTION seed_standard_aliases(v_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Backend Developer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'backend_developer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'Software Engineer'),
      (v_category_id, 'Backend Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Frontend Developer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'frontend_developer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UI Developer'),
      (v_category_id, 'Frontend Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- DevOps Engineer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'devops_engineer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'DevOps'),
      (v_category_id, 'Infrastructure Engineer'),
      (v_category_id, 'Cloud Engineer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- QA Engineer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'qa_engineer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'QA'),
      (v_category_id, 'Quality Assurance Engineer'),
      (v_category_id, 'Test Engineer'),
      (v_category_id, 'SDET')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- Product Manager aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'product_manager';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'PM', NULL),
      (v_category_id, 'Product Lead', NULL),
      (v_category_id, 'Product Owner', 'Agile RFP title for product work')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Product Designer aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'product_designer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'UX/UI Designer', NULL),
      (v_category_id, 'UX Designer', NULL),
      (v_category_id, 'UI Designer', NULL),
      (v_category_id, 'HCD Lead', 'Work is wireframes, prototypes, design systems, UI specs')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- UX Researcher aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'ux_researcher';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'User Researcher', NULL),
      (v_category_id, 'Research Analyst', NULL),
      (v_category_id, 'HCD Lead', 'Work is studies, synthesis, interviews, usability testing')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Service Designer aliases (HCD Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'service_designer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'HCD Lead', 'Work is journey maps, service blueprints, workshop facilitation'),
      (v_category_id, 'Journey Mapper', NULL)
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Research Lead aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'research_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'Senior HCD Lead'),
      (v_category_id, 'Research Director')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Content/UX Writer aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'content_ux_writer';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UX Writer'),
      (v_category_id, 'Microcopy Writer')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Delivery Manager aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'delivery_manager';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Scrum Master', 'Agile RFP title for delivery work'),
      (v_category_id, 'Agile Delivery Lead', NULL)
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Technical Lead aliases (umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'technical_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Tech Lead', NULL),
      (v_category_id, 'Engineering Lead', NULL),
      (v_category_id, 'Lead Developer', NULL),
      (v_category_id, 'Technical Lead', 'Hands-on lead development — code review, mentorship, shipping code')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 4;
  END IF;

  -- Solutions Architect aliases (Technical Lead umbrella)
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'solutions_architect';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias, context_note)
    VALUES
      (v_category_id, 'Enterprise Architect', NULL),
      (v_category_id, 'Cloud Architect', NULL),
      (v_category_id, 'Technical Lead', 'Architecture/technical strategy — system design, ADRs, cross-team technical decisions')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 3;
  END IF;

  -- Design Lead aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'design_lead';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'UX Lead'),
      (v_category_id, 'Design Director')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  -- Accessibility Specialist aliases
  SELECT id INTO v_category_id FROM tenant_labor_categories
    WHERE tenant_id = v_tenant_id AND key = 'accessibility_specialist';
  IF v_category_id IS NOT NULL THEN
    INSERT INTO labor_category_aliases (labor_category_id, alias)
    VALUES
      (v_category_id, 'A11y Engineer'),
      (v_category_id, '508 Compliance Specialist')
    ON CONFLICT (labor_category_id, alias) DO NOTHING;
    v_count := v_count + 2;
  END IF;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- MASTER SEED FUNCTION
-- =============================================================================
-- Orchestrates full catalog seed for a tenant.
-- NOTE: FFTC roles seeded via script with actual JSON data.

CREATE OR REPLACE FUNCTION seed_tenant_labor_catalog(v_tenant_id UUID)
RETURNS TABLE(fftc_roles INTEGER, additional_roles INTEGER, aliases INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fftc INTEGER := 0;
  v_additional INTEGER;
  v_aliases INTEGER;
BEGIN
  -- Note: FFTC roles with salary data must be seeded via script
  -- This function seeds disciplines, additional roles, and aliases

  -- Ensure disciplines exist
  PERFORM seed_tenant_disciplines(v_tenant_id);

  -- Seed additional roles (NULL salaries)
  v_additional := seed_additional_catalog_roles(v_tenant_id);

  -- Seed aliases
  v_aliases := seed_standard_aliases(v_tenant_id);

  RETURN QUERY SELECT v_fftc, v_additional, v_aliases;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION seed_fftc_roles_from_json(UUID, JSONB) IS 'Seeds FFTC roles from fftc-roles-v2.json structure';
COMMENT ON FUNCTION seed_additional_catalog_roles(UUID) IS 'Seeds 23 additional roles with NULL salaries (needs-setup)';
COMMENT ON FUNCTION seed_standard_aliases(UUID) IS 'Seeds standard role aliases including HCD Lead umbrella';
COMMENT ON FUNCTION seed_tenant_labor_catalog(UUID) IS 'Master seed function for tenant catalog (disciplines, additional roles, aliases)';
