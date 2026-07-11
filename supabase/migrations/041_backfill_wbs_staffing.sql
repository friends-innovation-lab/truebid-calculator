-- Phase 3: Backfill WBS & Staffing from working_data
-- Migrates existing estimateWbsElements and roles to normalized tables
--
-- REQUIREMENTS:
-- - Idempotent: Can run multiple times safely (uses existence checks)
-- - No-op on empty DB: Local reset with no WBS data completes cleanly
-- - Creates draft intelligence shell for WBS-without-intelligence proposals
-- - v_ prefix on all PL/pgSQL variables
-- - Fan-out: Creates one assignment per period with hours > 0
-- - Recursive: Maps nested tasks array to child wbs_tasks via parent_task_id
-- - Hours reconciliation: Fails if migrated hours != source hours
--
-- FIELD DISPOSITIONS:
--   WBS Task Fields:
--     MAPPED: wbsNumber→wbs_code, title→title, what/description→description,
--             sowReference/ref→sow_reference, deliverable→deliverable
--     NOTES-JSONB: basisOfEstimate, assumptions, why, notIncluded, dependencies
--     PRESERVED-IN-BLOB: requirementLinks, quality*, isAIGenerated, estimationType,
--                        historicalReference, tasks (processed recursively)
--     DROPPED: id (new UUID generated), totalHours (derived from assignments)
--
--   Labor Estimate Fields:
--     MAPPED: roleName→role_title, rationale→rationale, hoursByPeriod→hours (fan-out)
--     NOTES-JSONB: basisOfEstimate
--     PRESERVED-IN-BLOB: loeType, confidence, isAISuggested, isOrphaned,
--                        applicablePeriods, estimatedHoursPerMonth
--     DROPPED: id (new UUID), roleId (new reference system)
--
-- PERIOD LABEL MAPPING:
--   hoursByPeriod key → period_label
--   base → "Base Period"
--   option1 → "Option Period 1"
--   option2 → "Option Period 2"
--   option3 → "Option Period 3"
--   option4 → "Option Period 4"
--
-- ROLLBACK (data only, schema preserved):
--   DELETE FROM staffing_assignments WHERE wbs_task_id IN (
--     SELECT id FROM wbs_tasks WHERE wbs_version_id IN (
--       SELECT id FROM wbs_versions WHERE version_number = 1));
--   DELETE FROM wbs_tasks WHERE wbs_version_id IN (
--     SELECT id FROM wbs_versions WHERE version_number = 1);
--   DELETE FROM wbs_versions WHERE version_number = 1;
--   DELETE FROM intelligence_versions WHERE facts_json->>'backfill_shell' = 'true';
--   ALTER TABLE wbs_tasks DROP COLUMN IF EXISTS notes_jsonb;
--   ALTER TABLE staffing_assignments DROP COLUMN IF EXISTS notes_jsonb;

-- =============================================================================
-- SCHEMA ADDITIONS (for NOTES-JSONB disposition)
-- =============================================================================

ALTER TABLE wbs_tasks ADD COLUMN IF NOT EXISTS notes_jsonb JSONB DEFAULT '{}'::JSONB;
ALTER TABLE staffing_assignments ADD COLUMN IF NOT EXISTS notes_jsonb JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN wbs_tasks.notes_jsonb IS 'BOE-critical fields: basisOfEstimate, assumptions, why, notIncluded, dependencies';
COMMENT ON COLUMN staffing_assignments.notes_jsonb IS 'BOE-critical fields: basisOfEstimate';

-- =============================================================================
-- PERIOD LABEL MAPPING FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION map_period_key_to_label(v_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN CASE v_key
    WHEN 'base' THEN 'Base Period'
    WHEN 'baseYear' THEN 'Base Period'
    WHEN 'option1' THEN 'Option Period 1'
    WHEN 'oy1' THEN 'Option Period 1'
    WHEN 'option2' THEN 'Option Period 2'
    WHEN 'oy2' THEN 'Option Period 2'
    WHEN 'option3' THEN 'Option Period 3'
    WHEN 'oy3' THEN 'Option Period 3'
    WHEN 'option4' THEN 'Option Period 4'
    WHEN 'oy4' THEN 'Option Period 4'
    ELSE v_key  -- Pass through unknown keys
  END;
END;
$$;

-- =============================================================================
-- RECURSIVE TASK MAPPING FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION backfill_tasks_recursive(
  v_tenant_id UUID,
  v_wbs_version_id UUID,
  v_elements JSONB,
  v_parent_task_id UUID,
  v_default_discipline TEXT,
  v_base_sort_order INTEGER
)
RETURNS TABLE (
  task_count INTEGER,
  assignment_count INTEGER,
  total_hours NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_elem JSONB;
  v_task_id UUID;
  v_labor JSONB;
  v_sort_order INTEGER;
  v_task_cnt INTEGER := 0;
  v_assign_cnt INTEGER := 0;
  v_hours_total NUMERIC := 0;
  v_period_key TEXT;
  v_period_hours NUMERIC;
  v_period_label TEXT;
  v_child_result RECORD;
  v_task_notes JSONB;
  v_assign_notes JSONB;
BEGIN
  v_sort_order := v_base_sort_order;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_elements)
  LOOP
    -- Build notes JSONB for task (BOE-critical fields)
    v_task_notes := jsonb_build_object(
      'basisOfEstimate', v_elem->'basisOfEstimate',
      'assumptions', v_elem->'assumptions',
      'why', v_elem->'why',
      'notIncluded', v_elem->'notIncluded',
      'dependencies', v_elem->'dependencies'
    );
    -- Remove null values
    v_task_notes := (SELECT jsonb_object_agg(key, value)
                     FROM jsonb_each(v_task_notes)
                     WHERE value IS NOT NULL AND value != 'null'::JSONB);
    IF v_task_notes IS NULL THEN v_task_notes := '{}'::JSONB; END IF;

    -- Insert task
    INSERT INTO wbs_tasks (
      tenant_id,
      wbs_version_id,
      parent_task_id,
      wbs_code,
      title,
      description,
      deliverable,
      sow_reference,
      start_month,
      end_month,
      sort_order,
      source,
      user_modified,
      notes_jsonb
    ) VALUES (
      v_tenant_id,
      v_wbs_version_id,
      v_parent_task_id,
      COALESCE(v_elem->>'wbsNumber', v_sort_order::TEXT),
      COALESCE(v_elem->>'title', 'Untitled Task'),
      COALESCE(v_elem->>'what', v_elem->>'description'),
      v_elem->>'deliverable',
      COALESCE(v_elem->>'sowReference', v_elem->>'ref'),
      NULL,
      NULL,
      v_sort_order,
      'generated',
      false,
      v_task_notes
    )
    RETURNING id INTO v_task_id;

    v_task_cnt := v_task_cnt + 1;
    v_sort_order := v_sort_order + 1;

    -- Map laborEstimates → staffing_assignments with period fan-out
    IF v_elem->'laborEstimates' IS NOT NULL THEN
      FOR v_labor IN SELECT value FROM jsonb_array_elements(v_elem->'laborEstimates')
      LOOP
        -- Build notes JSONB for assignment
        v_assign_notes := jsonb_build_object(
          'basisOfEstimate', v_labor->'basisOfEstimate'
        );
        v_assign_notes := (SELECT jsonb_object_agg(key, value)
                           FROM jsonb_each(v_assign_notes)
                           WHERE value IS NOT NULL AND value != 'null'::JSONB);
        IF v_assign_notes IS NULL THEN v_assign_notes := '{}'::JSONB; END IF;

        -- Check for hoursByPeriod (production format) - fan-out per period
        IF v_labor->'hoursByPeriod' IS NOT NULL THEN
          FOR v_period_key, v_period_hours IN
            SELECT key, COALESCE((value#>>'{}')::NUMERIC, 0)
            FROM jsonb_each(v_labor->'hoursByPeriod')
          LOOP
            -- Only create assignment if hours > 0
            IF v_period_hours > 0 THEN
              v_period_label := map_period_key_to_label(v_period_key);

              INSERT INTO staffing_assignments (
                tenant_id,
                wbs_task_id,
                role_title,
                discipline,
                prime_or_sub,
                period_label,
                hours,
                hours_per_month,
                rationale,
                source,
                user_modified,
                notes_jsonb
              ) VALUES (
                v_tenant_id,
                v_task_id,
                COALESCE(v_labor->>'roleName', 'Unknown Role'),
                v_default_discipline,
                'prime',
                v_period_label,
                v_period_hours,
                NULL,
                v_labor->>'rationale',
                'generated',
                false,
                v_assign_notes
              );

              v_assign_cnt := v_assign_cnt + 1;
              v_hours_total := v_hours_total + v_period_hours;
            END IF;
          END LOOP;
        -- Fallback to calculatedHours/baseHours (legacy format)
        ELSIF v_labor ? 'calculatedHours' OR v_labor ? 'baseHours' THEN
          v_period_hours := COALESCE(
            (v_labor->>'calculatedHours')::NUMERIC,
            (v_labor->>'baseHours')::NUMERIC,
            0
          );

          IF v_period_hours > 0 THEN
            INSERT INTO staffing_assignments (
              tenant_id,
              wbs_task_id,
              role_title,
              discipline,
              prime_or_sub,
              period_label,
              hours,
              hours_per_month,
              rationale,
              source,
              user_modified,
              notes_jsonb
            ) VALUES (
              v_tenant_id,
              v_task_id,
              COALESCE(v_labor->>'roleName', 'Unknown Role'),
              v_default_discipline,
              'prime',
              'Base Period',
              v_period_hours,
              NULL,
              v_labor->>'rationale',
              'generated',
              false,
              v_assign_notes
            );

            v_assign_cnt := v_assign_cnt + 1;
            v_hours_total := v_hours_total + v_period_hours;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Recursively process child tasks
    IF v_elem->'tasks' IS NOT NULL AND jsonb_array_length(v_elem->'tasks') > 0 THEN
      FOR v_child_result IN
        SELECT * FROM backfill_tasks_recursive(
          v_tenant_id,
          v_wbs_version_id,
          v_elem->'tasks',
          v_task_id,
          v_default_discipline,
          v_sort_order
        )
      LOOP
        v_task_cnt := v_task_cnt + v_child_result.task_count;
        v_assign_cnt := v_assign_cnt + v_child_result.assignment_count;
        v_hours_total := v_hours_total + v_child_result.total_hours;
        v_sort_order := v_sort_order + v_child_result.task_count;
      END LOOP;
    END IF;
  END LOOP;

  task_count := v_task_cnt;
  assignment_count := v_assign_cnt;
  total_hours := v_hours_total;
  RETURN NEXT;
END;
$$;

-- =============================================================================
-- SOURCE HOURS CALCULATION (independent, recursive, enumerates ALL keys)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_source_hours_recursive(v_elements JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC := 0;
  v_elem JSONB;
  v_labor JSONB;
  v_period_key TEXT;
  v_period_hours NUMERIC;
BEGIN
  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_elements)
  LOOP
    -- Sum ALL hoursByPeriod values from laborEstimates (ALL keys, not filtered)
    IF v_elem->'laborEstimates' IS NOT NULL THEN
      FOR v_labor IN SELECT value FROM jsonb_array_elements(v_elem->'laborEstimates')
      LOOP
        IF v_labor->'hoursByPeriod' IS NOT NULL THEN
          -- Enumerate ALL keys in hoursByPeriod, regardless of name
          FOR v_period_key, v_period_hours IN
            SELECT key, COALESCE((value#>>'{}')::NUMERIC, 0)
            FROM jsonb_each(v_labor->'hoursByPeriod')
          LOOP
            v_total := v_total + v_period_hours;
          END LOOP;
        ELSIF v_labor ? 'calculatedHours' THEN
          v_total := v_total + COALESCE((v_labor->>'calculatedHours')::NUMERIC, 0);
        ELSIF v_labor ? 'baseHours' THEN
          v_total := v_total + COALESCE((v_labor->>'baseHours')::NUMERIC, 0);
        END IF;
      END LOOP;
    END IF;

    -- RECURSIVE: process child tasks
    IF v_elem->'tasks' IS NOT NULL AND jsonb_array_length(v_elem->'tasks') > 0 THEN
      v_total := v_total + calculate_source_hours_recursive(v_elem->'tasks');
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

-- =============================================================================
-- BACKFILL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION backfill_wbs_staffing()
RETURNS TABLE (
  result_proposal_id UUID,
  result_proposal_title TEXT,
  result_wbs_version_id UUID,
  result_wbs_status TEXT,
  result_task_count INTEGER,
  result_child_task_count INTEGER,
  result_assignment_count INTEGER,
  result_assignments_per_period JSONB,
  result_source_hours NUMERIC,
  result_migrated_hours NUMERIC,
  result_hours_reconciled BOOLEAN,
  result_intel_source TEXT,
  result_roles_comparison TEXT,
  result_notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_prop RECORD;
  v_tenant_id UUID;
  v_intel_id UUID;
  v_intel_status intelligence_status;
  v_wbs_status wbs_status;
  v_wbs_version_id UUID;
  v_notes TEXT;
  v_intel_source TEXT;
  v_default_discipline TEXT;
  v_wbs_elements JSONB;
  v_selected_roles JSONB;
  v_roles JSONB;
  v_roles_comparison TEXT;
  v_task_result RECORD;
  v_source_hours NUMERIC;
  v_elem JSONB;
  v_labor JSONB;
  v_period_key TEXT;
  v_period_hours NUMERIC;
  v_assignments_per_period JSONB;
BEGIN
  -- Loop through proposals with estimateWbsElements in working_data
  FOR v_prop IN
    SELECT
      pr.id AS prop_id,
      pr.title AS prop_title,
      pr.company_id,
      pr.working_data,
      pr.active_intelligence_version_id,
      t.id AS tenant_id
    FROM proposals pr
    LEFT JOIN tenants t ON t.company_id = pr.company_id
    WHERE pr.working_data->'estimateWbsElements' IS NOT NULL
      AND pr.working_data->'estimateWbsElements' != 'null'::JSONB
      AND jsonb_array_length(COALESCE(pr.working_data->'estimateWbsElements', '[]'::JSONB)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM wbs_versions wv
        WHERE wv.proposal_id = pr.id AND wv.version_number = 1
      )
  LOOP
    v_notes := '';
    v_tenant_id := v_prop.tenant_id;
    v_wbs_elements := v_prop.working_data->'estimateWbsElements';

    -- Skip if no tenant found
    IF v_tenant_id IS NULL THEN
      result_proposal_id := v_prop.prop_id;
      result_proposal_title := v_prop.prop_title;
      result_wbs_version_id := NULL;
      result_wbs_status := 'skipped';
      result_task_count := 0;
      result_child_task_count := 0;
      result_assignment_count := 0;
      result_assignments_per_period := '{}'::JSONB;
      result_source_hours := 0;
      result_migrated_hours := 0;
      result_hours_reconciled := true;
      result_intel_source := 'none';
      result_roles_comparison := 'skipped';
      result_notes := 'No tenant found for company';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Calculate source hours INDEPENDENTLY using recursive function
    -- This enumerates ALL keys in ALL hoursByPeriod objects, regardless of key name
    -- An unrecognized key will inflate source total and fail reconciliation
    v_source_hours := calculate_source_hours_recursive(v_wbs_elements);

    -- Determine intelligence version
    IF v_prop.active_intelligence_version_id IS NOT NULL THEN
      SELECT status INTO v_intel_status
      FROM intelligence_versions
      WHERE id = v_prop.active_intelligence_version_id;

      IF v_intel_status = 'confirmed' THEN
        v_intel_id := v_prop.active_intelligence_version_id;
        v_wbs_status := 'active';
        v_intel_source := 'confirmed';
      ELSE
        v_intel_id := v_prop.active_intelligence_version_id;
        v_wbs_status := 'draft';
        v_intel_source := 'draft_unexpected';
        v_notes := v_notes || 'Active intelligence version is not confirmed; ';
      END IF;
    ELSE
      SELECT id, status INTO v_intel_id, v_intel_status
      FROM intelligence_versions
      WHERE proposal_id = v_prop.prop_id
      ORDER BY version_number DESC
      LIMIT 1;

      IF v_intel_id IS NOT NULL THEN
        v_wbs_status := 'draft';
        v_intel_source := 'existing_' || v_intel_status::TEXT;
        v_notes := v_notes || 'Using existing non-active intelligence version; ';
      ELSE
        IF v_prop.working_data->'contractIntelligence' IS NOT NULL
           AND v_prop.working_data->'contractIntelligence' != 'null'::JSONB THEN

          INSERT INTO intelligence_versions (
            tenant_id,
            proposal_id,
            version_number,
            status,
            facts_json,
            contract_type,
            extracted_at
          ) VALUES (
            v_tenant_id,
            v_prop.prop_id,
            COALESCE(
              (SELECT MAX(version_number) + 1 FROM intelligence_versions WHERE proposal_id = v_prop.prop_id),
              1
            ),
            'draft',
            jsonb_build_object(
              'backfill_shell', true,
              'documentType', v_prop.working_data->'contractIntelligence'->'documentType',
              'vehicle', v_prop.working_data->'contractIntelligence'->'vehicle',
              'contractType', v_prop.working_data->'contractIntelligence'->'contractType',
              'setAside', v_prop.working_data->'contractIntelligence'->'setAside',
              'rateSource', v_prop.working_data->'contractIntelligence'->'rateSource'
            ),
            (v_prop.working_data->'contractIntelligence'->'contractType'->>'value'),
            COALESCE(
              (v_prop.working_data->'contractIntelligence'->>'extractedAt')::TIMESTAMPTZ,
              now()
            )
          )
          RETURNING id INTO v_intel_id;

          IF v_prop.working_data->'contractIntelligence'->'periods' IS NOT NULL THEN
            INSERT INTO intelligence_periods (version_id, name, months, cumulative_months_end, gsa_rate_year, sort_order)
            SELECT
              v_intel_id,
              value->>'name',
              COALESCE((value->>'months')::NUMERIC, 12),
              COALESCE((value->>'cumulativeMonthsEnd')::NUMERIC, 12),
              COALESCE((value->>'gsaRateYear')::INTEGER, 1),
              (ordinality - 1)::INTEGER
            FROM jsonb_array_elements(v_prop.working_data->'contractIntelligence'->'periods') WITH ORDINALITY;
          END IF;

          IF v_prop.working_data->'contractIntelligence'->'disciplines'->'required' IS NOT NULL THEN
            INSERT INTO intelligence_disciplines (version_id, discipline, confidence, source_text)
            SELECT
              v_intel_id,
              TRIM(BOTH '"' FROM value::TEXT),
              COALESCE(v_prop.working_data->'contractIntelligence'->'disciplines'->>'confidence', 'medium'),
              v_prop.working_data->'contractIntelligence'->'disciplines'->>'sourceText'
            FROM jsonb_array_elements(v_prop.working_data->'contractIntelligence'->'disciplines'->'required')
            ON CONFLICT (version_id, discipline) DO NOTHING;
          END IF;

          v_wbs_status := 'draft';
          v_intel_source := 'shell_from_blob';
          v_notes := v_notes || 'REVIEW REQUIRED: Created draft intelligence shell from blob; ';
        ELSE
          result_proposal_id := v_prop.prop_id;
          result_proposal_title := v_prop.prop_title;
          result_wbs_version_id := NULL;
          result_wbs_status := 'skipped';
          result_task_count := 0;
          result_child_task_count := 0;
          result_assignment_count := 0;
          result_assignments_per_period := '{}'::JSONB;
          result_source_hours := v_source_hours;
          result_migrated_hours := 0;
          result_hours_reconciled := true;
          result_intel_source := 'none';
          result_roles_comparison := 'skipped';
          result_notes := 'No intelligence data available to create shell';
          RETURN NEXT;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- Get default discipline
    SELECT discipline INTO v_default_discipline
    FROM intelligence_disciplines
    WHERE version_id = v_intel_id
    LIMIT 1;
    v_default_discipline := COALESCE(v_default_discipline, 'product');

    -- Create WBS version
    INSERT INTO wbs_versions (
      tenant_id,
      proposal_id,
      intelligence_version_id,
      version_number,
      status,
      activated_at,
      generation_job_note
    ) VALUES (
      v_tenant_id,
      v_prop.prop_id,
      v_intel_id,
      1,
      v_wbs_status,
      CASE WHEN v_wbs_status = 'active' THEN now() ELSE NULL END,
      'Backfilled from working_data.estimateWbsElements'
    )
    RETURNING id INTO v_wbs_version_id;

    -- Map tasks recursively
    SELECT * INTO v_task_result FROM backfill_tasks_recursive(
      v_tenant_id,
      v_wbs_version_id,
      v_wbs_elements,
      NULL,  -- No parent for top-level tasks
      v_default_discipline,
      0
    );

    -- Hours reconciliation check
    IF ABS(v_task_result.total_hours - v_source_hours) > 0.01 THEN
      v_notes := v_notes || format(
        'HOURS MISMATCH: source=%s, migrated=%s, delta=%s; ',
        v_source_hours,
        v_task_result.total_hours,
        v_task_result.total_hours - v_source_hours
      );
    END IF;

    -- Count assignments per period
    SELECT jsonb_object_agg(period_label, cnt) INTO v_assignments_per_period
    FROM (
      SELECT sa.period_label, COUNT(*) as cnt, SUM(sa.hours) as hours
      FROM staffing_assignments sa
      JOIN wbs_tasks wt ON sa.wbs_task_id = wt.id
      WHERE wt.wbs_version_id = v_wbs_version_id
      GROUP BY sa.period_label
    ) sub;

    -- Compare selectedRoles vs roles
    v_selected_roles := v_prop.working_data->'selectedRoles';
    v_roles := v_prop.working_data->'roles';

    IF v_selected_roles IS NULL AND v_roles IS NULL THEN
      v_roles_comparison := 'neither';
    ELSIF v_selected_roles IS NULL THEN
      v_roles_comparison := 'roles_only';
    ELSIF v_roles IS NULL THEN
      v_roles_comparison := 'selectedRoles_only';
    ELSIF v_selected_roles = v_roles THEN
      v_roles_comparison := 'match';
    ELSE
      v_roles_comparison := 'divergent';
      v_notes := v_notes || 'selectedRoles and roles arrays differ; ';
    END IF;

    -- Count parent vs child tasks
    result_proposal_id := v_prop.prop_id;
    result_proposal_title := v_prop.prop_title;
    result_wbs_version_id := v_wbs_version_id;
    result_wbs_status := v_wbs_status::TEXT;
    result_task_count := (SELECT COUNT(*) FROM wbs_tasks WHERE wbs_version_id = v_wbs_version_id AND parent_task_id IS NULL);
    result_child_task_count := (SELECT COUNT(*) FROM wbs_tasks WHERE wbs_version_id = v_wbs_version_id AND parent_task_id IS NOT NULL);
    result_assignment_count := v_task_result.assignment_count;
    result_assignments_per_period := COALESCE(v_assignments_per_period, '{}'::JSONB);
    result_source_hours := v_source_hours;
    result_migrated_hours := v_task_result.total_hours;
    result_hours_reconciled := ABS(v_task_result.total_hours - v_source_hours) <= 0.01;
    result_intel_source := v_intel_source;
    result_roles_comparison := v_roles_comparison;
    result_notes := NULLIF(TRIM(v_notes), '');
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- =============================================================================
-- EXECUTE BACKFILL
-- =============================================================================

DO $$
DECLARE
  v_result RECORD;
  v_row_count INTEGER := 0;
  v_failed BOOLEAN := false;
BEGIN
  RAISE NOTICE 'Starting WBS & staffing backfill...';

  FOR v_result IN SELECT * FROM backfill_wbs_staffing()
  LOOP
    v_row_count := v_row_count + 1;

    RAISE NOTICE 'Backfilled proposal % (%)', v_result.result_proposal_id, LEFT(v_result.result_proposal_title, 40);
    RAISE NOTICE '  WBS version: % (%)', v_result.result_wbs_version_id, v_result.result_wbs_status;
    RAISE NOTICE '  Tasks: % parent + % children = % total',
      v_result.result_task_count,
      v_result.result_child_task_count,
      v_result.result_task_count + v_result.result_child_task_count;
    RAISE NOTICE '  Assignments: % total, per period: %',
      v_result.result_assignment_count,
      v_result.result_assignments_per_period;
    RAISE NOTICE '  Hours: source=%, migrated=%, reconciled=%',
      v_result.result_source_hours,
      v_result.result_migrated_hours,
      v_result.result_hours_reconciled;
    RAISE NOTICE '  Intel: %, Roles: %', v_result.result_intel_source, v_result.result_roles_comparison;

    IF v_result.result_notes IS NOT NULL THEN
      RAISE NOTICE '  Notes: %', v_result.result_notes;
    END IF;

    -- Fail on hours mismatch
    IF NOT v_result.result_hours_reconciled THEN
      v_failed := true;
      RAISE WARNING 'HOURS RECONCILIATION FAILED for proposal %', v_result.result_proposal_id;
    END IF;
  END LOOP;

  IF v_row_count = 0 THEN
    RAISE NOTICE 'No proposals with estimateWbsElements found (expected on fresh local DB)';
  ELSE
    RAISE NOTICE 'Backfill complete. Processed % proposals.', v_row_count;
  END IF;

  IF v_failed THEN
    RAISE EXCEPTION 'Backfill completed with hours reconciliation failures. Review the warnings above.';
  END IF;
END $$;

-- Clean up functions (not needed after migration)
DROP FUNCTION IF EXISTS backfill_wbs_staffing();
DROP FUNCTION IF EXISTS backfill_tasks_recursive(UUID, UUID, JSONB, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS calculate_source_hours_recursive(JSONB);
DROP FUNCTION IF EXISTS map_period_key_to_label(TEXT);

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. ALL backfilled versions are status=active (if confirmed intel) or draft (if not)
--
-- 2. Proposals with WBS but no intelligence get a draft intelligence shell:
--    - Marked with facts_json->>'backfill_shell' = 'true'
--    - REVIEW REQUIRED: User must confirm intelligence before activating WBS
--
-- 3. Original working_data is preserved (PRESERVED-IN-BLOB disposition)
--
-- 4. Field mapping summary:
--    Tasks: wbsNumber→wbs_code, title, what→description, ref→sow_reference
--           BOE fields (assumptions, why, etc.) → notes_jsonb
--    Assignments: roleName→role_title, rationale, hoursByPeriod→hours (fan-out)
--
-- 5. Period label mapping:
--    base/baseYear → "Base Period"
--    option1/oy1 → "Option Period 1"
--    option2/oy2 → "Option Period 2"
--    option3/oy3 → "Option Period 3"
--    option4/oy4 → "Option Period 4"
--
-- 6. Hours reconciliation: Migration fails if source hours != migrated hours
