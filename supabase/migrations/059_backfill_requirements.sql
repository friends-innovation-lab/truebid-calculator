-- Phase 6A: Backfill Requirements with Intelligence Version
-- Attach existing requirements to latest intelligence version per proposal
--
-- ROLLBACK: None needed (data update only)

-- =============================================================================
-- BACKFILL REQUIREMENTS.INTELLIGENCE_VERSION_ID
-- =============================================================================
-- Per Phase 6A spec: attach to each proposal's latest intelligence version
-- regardless of status (confirmed or draft)

DO $$
DECLARE
  v_total_updated INTEGER := 0;
  v_proposal_count INTEGER := 0;
BEGIN
  -- Update requirements to link to the latest intelligence version for their proposal
  -- Latest = highest version_number or most recent extracted_at
  WITH latest_intelligence AS (
    SELECT DISTINCT ON (proposal_id)
      proposal_id,
      id AS intelligence_version_id
    FROM intelligence_versions
    ORDER BY proposal_id, version_number DESC, extracted_at DESC NULLS LAST
  )
  UPDATE requirements r
  SET intelligence_version_id = li.intelligence_version_id
  FROM latest_intelligence li
  WHERE r.proposal_id = li.proposal_id
  AND r.intelligence_version_id IS NULL;

  GET DIAGNOSTICS v_total_updated = ROW_COUNT;

  -- Count distinct proposals affected
  SELECT COUNT(DISTINCT proposal_id)
  INTO v_proposal_count
  FROM requirements
  WHERE intelligence_version_id IS NOT NULL;

  RAISE NOTICE 'Requirements backfill: % requirements updated across % proposals',
    v_total_updated, v_proposal_count;
END $$;

-- =============================================================================
-- REPORT: Requirements per proposal with intelligence status
-- =============================================================================

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '--- Requirements Backfill Report ---';

  FOR v_rec IN
    SELECT
      p.title AS proposal_title,
      COUNT(r.id) AS requirement_count,
      iv.status AS intelligence_status,
      iv.version_number AS intelligence_version
    FROM proposals p
    LEFT JOIN requirements r ON r.proposal_id = p.id
    LEFT JOIN intelligence_versions iv ON iv.id = r.intelligence_version_id
    WHERE r.id IS NOT NULL
    GROUP BY p.id, p.title, iv.status, iv.version_number
    ORDER BY p.title
  LOOP
    RAISE NOTICE 'Proposal: % | Requirements: % | Intelligence: v% (%)',
      v_rec.proposal_title,
      v_rec.requirement_count,
      COALESCE(v_rec.intelligence_version::TEXT, 'N/A'),
      COALESCE(v_rec.intelligence_status::TEXT, 'none');
  END LOOP;
END $$;
