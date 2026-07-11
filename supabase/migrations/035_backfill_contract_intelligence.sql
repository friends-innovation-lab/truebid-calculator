-- Phase 2: Backfill existing contractIntelligence from working_data
-- Migrates existing working_data.contractIntelligence blobs to versioned tables
--
-- REQUIREMENTS:
-- - Idempotent: Can run multiple times safely (uses conflict checks)
-- - No-op on empty DB: Local reset with no intelligence blobs completes cleanly
-- - Preserves existing confirmed state from blob
--
-- ROLLBACK (data only, schema preserved):
--   DELETE FROM intelligence_labor_requirements
--     WHERE version_id IN (SELECT id FROM intelligence_versions WHERE version_number = 1);
--   DELETE FROM intelligence_disciplines
--     WHERE version_id IN (SELECT id FROM intelligence_versions WHERE version_number = 1);
--   DELETE FROM intelligence_periods
--     WHERE version_id IN (SELECT id FROM intelligence_versions WHERE version_number = 1);
--   DELETE FROM intelligence_versions WHERE version_number = 1;
--   UPDATE proposals SET active_intelligence_version_id = NULL;

-- =============================================================================
-- BACKFILL FUNCTION
-- =============================================================================
-- Encapsulate backfill logic in a function for cleaner execution and reporting

CREATE OR REPLACE FUNCTION backfill_contract_intelligence()
RETURNS TABLE (
  proposal_id UUID,
  version_id UUID,
  status TEXT,
  periods_count INTEGER,
  disciplines_count INTEGER,
  labor_reqs_count INTEGER,
  notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  p RECORD;
  intel JSONB;
  v_id UUID;
  v_status intelligence_status;
  tenant UUID;
  period_rec RECORD;
  discipline TEXT;
  role_rec RECORD;
  p_count INTEGER;
  d_count INTEGER;
  l_count INTEGER;
BEGIN
  -- Loop through proposals with contractIntelligence in working_data
  FOR p IN
    SELECT
      pr.id AS prop_id,
      pr.company_id,
      pr.working_data->'contractIntelligence' AS contract_intel,
      t.id AS tenant_id
    FROM proposals pr
    LEFT JOIN tenants t ON t.company_id = pr.company_id
    WHERE pr.working_data->'contractIntelligence' IS NOT NULL
      AND pr.working_data->'contractIntelligence' != 'null'::JSONB
      -- Skip if already backfilled (idempotent)
      AND NOT EXISTS (
        SELECT 1 FROM intelligence_versions iv
        WHERE iv.proposal_id = pr.id AND iv.version_number = 1
      )
  LOOP
    intel := p.contract_intel;
    tenant := p.tenant_id;

    -- Skip if no tenant found (shouldn't happen, but be safe)
    IF tenant IS NULL THEN
      proposal_id := p.prop_id;
      version_id := NULL;
      status := 'skipped';
      periods_count := 0;
      disciplines_count := 0;
      labor_reqs_count := 0;
      notes := 'No tenant found for company';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Determine status from blob
    IF (intel->>'confirmed')::BOOLEAN = true THEN
      v_status := 'confirmed';
    ELSE
      v_status := 'draft';
    END IF;

    -- Create intelligence version
    INSERT INTO intelligence_versions (
      tenant_id,
      proposal_id,
      version_number,
      status,
      facts_json,
      contract_type,
      extracted_at,
      confirmed_at,
      -- Note: confirmation_hash is NULL for backfilled confirmed versions
      -- They will need to be re-confirmed after migration if hash verification is required
      confirmation_hash
    ) VALUES (
      tenant,
      p.prop_id,
      1,
      v_status,
      jsonb_build_object(
        'documentType', intel->'documentType',
        'vehicle', intel->'vehicle',
        'contractType', intel->'contractType',
        'setAside', intel->'setAside',
        'rateSource', intel->'rateSource'
      ),
      (intel->'contractType'->>'value'),
      COALESCE((intel->>'extractedAt')::TIMESTAMPTZ, now()),
      CASE WHEN v_status = 'confirmed' THEN COALESCE((intel->>'confirmedAt')::TIMESTAMPTZ, now()) ELSE NULL END,
      NULL -- Hash will be set on first re-confirmation
    )
    RETURNING id INTO v_id;

    -- Insert periods
    p_count := 0;
    IF intel->'periods' IS NOT NULL AND jsonb_array_length(intel->'periods') > 0 THEN
      FOR period_rec IN
        SELECT
          value->>'name' AS name,
          (value->>'months')::NUMERIC AS months,
          (value->>'cumulativeMonthsEnd')::NUMERIC AS cumulative_months_end,
          (value->>'gsaRateYear')::INTEGER AS gsa_rate_year,
          ordinality - 1 AS sort_order
        FROM jsonb_array_elements(intel->'periods') WITH ORDINALITY
      LOOP
        INSERT INTO intelligence_periods (
          version_id, name, months, cumulative_months_end, gsa_rate_year, sort_order
        ) VALUES (
          v_id,
          period_rec.name,
          period_rec.months,
          period_rec.cumulative_months_end,
          COALESCE(period_rec.gsa_rate_year, 1),
          period_rec.sort_order
        );
        p_count := p_count + 1;
      END LOOP;
    END IF;

    -- Insert disciplines
    d_count := 0;
    IF intel->'disciplines'->'required' IS NOT NULL AND jsonb_array_length(intel->'disciplines'->'required') > 0 THEN
      FOR discipline IN
        SELECT value::TEXT FROM jsonb_array_elements_text(intel->'disciplines'->'required')
      LOOP
        INSERT INTO intelligence_disciplines (
          version_id, discipline, confidence, source_text
        ) VALUES (
          v_id,
          TRIM(BOTH '"' FROM discipline),
          COALESCE(intel->'disciplines'->>'confidence', 'medium'),
          intel->'disciplines'->>'sourceText'
        )
        ON CONFLICT (version_id, discipline) DO NOTHING;
        d_count := d_count + 1;
      END LOOP;
    END IF;

    -- Insert labor requirements (roles)
    l_count := 0;
    IF intel->'roles' IS NOT NULL AND jsonb_array_length(intel->'roles') > 0 THEN
      FOR role_rec IN
        SELECT
          value->>'title' AS title,
          value->>'laborCategory' AS labor_category,
          (value->>'hoursPerMonth')::NUMERIC AS hours_per_month,
          (value->>'utilizationPct')::NUMERIC AS utilization_pct,
          value->>'confidence' AS confidence,
          value->>'sourceText' AS source_text,
          value->'appearsInPeriods' AS appears_in_periods
        FROM jsonb_array_elements(intel->'roles')
      LOOP
        INSERT INTO intelligence_labor_requirements (
          version_id, title, labor_category, hours_per_month, utilization_pct,
          confidence, source_text, appears_in_periods
        ) VALUES (
          v_id,
          role_rec.title,
          role_rec.labor_category,
          role_rec.hours_per_month,
          role_rec.utilization_pct,
          COALESCE(role_rec.confidence, 'medium'),
          role_rec.source_text,
          COALESCE(
            (SELECT ARRAY_AGG(elem::TEXT) FROM jsonb_array_elements_text(role_rec.appears_in_periods) AS elem),
            '{}'::TEXT[]
          )
        );
        l_count := l_count + 1;
      END LOOP;
    END IF;

    -- Set active_intelligence_version_id if confirmed
    IF v_status = 'confirmed' THEN
      UPDATE proposals SET active_intelligence_version_id = v_id WHERE id = p.prop_id;
    END IF;

    -- Return report row
    proposal_id := p.prop_id;
    version_id := v_id;
    status := v_status::TEXT;
    periods_count := p_count;
    disciplines_count := d_count;
    labor_reqs_count := l_count;
    notes := CASE
      WHEN v_status = 'confirmed' THEN 'Backfilled as confirmed (hash needs re-confirmation)'
      ELSE 'Backfilled as draft'
    END;
    RETURN NEXT;
  END LOOP;

  -- If no rows processed, return empty result (no-op on empty DB)
  RETURN;
END;
$$;

-- =============================================================================
-- EXECUTE BACKFILL
-- =============================================================================
-- Run the backfill and output results to NOTICE for logging

DO $$
DECLARE
  result_row RECORD;
  row_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting contract intelligence backfill...';

  FOR result_row IN SELECT * FROM backfill_contract_intelligence()
  LOOP
    row_count := row_count + 1;
    RAISE NOTICE 'Backfilled proposal % -> version % (%, periods: %, disciplines: %, labor_reqs: %) - %',
      result_row.proposal_id,
      result_row.version_id,
      result_row.status,
      result_row.periods_count,
      result_row.disciplines_count,
      result_row.labor_reqs_count,
      result_row.notes;
  END LOOP;

  IF row_count = 0 THEN
    RAISE NOTICE 'No proposals with contractIntelligence found (this is expected on fresh local DB)';
  ELSE
    RAISE NOTICE 'Backfill complete. Processed % proposals.', row_count;
  END IF;
END $$;

-- Clean up the function (not needed after migration)
DROP FUNCTION IF EXISTS backfill_contract_intelligence();

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Backfilled confirmed versions have NULL confirmation_hash
--    - They need re-confirmation to compute hash if hash verification is required
--    - Or update them manually with computed hashes
--
-- 2. The original working_data.contractIntelligence blob is preserved
--    - This allows gradual migration and rollback if needed
--    - Remove once migration is stable
--
-- 3. To generate backfill report:
--    SELECT
--      p.id AS proposal_id,
--      iv.id AS version_id,
--      iv.status,
--      (SELECT COUNT(*) FROM intelligence_periods WHERE version_id = iv.id) AS periods_count,
--      (SELECT COUNT(*) FROM intelligence_disciplines WHERE version_id = iv.id) AS disciplines_count,
--      (SELECT COUNT(*) FROM intelligence_labor_requirements WHERE version_id = iv.id) AS labor_reqs_count
--    FROM proposals p
--    JOIN intelligence_versions iv ON iv.proposal_id = p.id AND iv.version_number = 1;
