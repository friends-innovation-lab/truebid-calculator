-- Migration: 045_backfill_solicitation_documents
-- Phase 4B Step 6: Backfill existing PDF uploads to solicitation_documents table
--
-- This migration:
-- 1. Creates solicitation_documents records from existing working_data PDF info
-- 2. Classifies documents based on filename patterns (ai_classified)
-- 3. CRITICAL: Does NOT touch intelligence_versions or confirmation_hash values
--
-- Document type classification heuristics:
-- - Contains "PWS" or "SOW" in filename → pws_sow
-- - Contains "RFQ", "Instructions", "RFP" in filename → instructions
-- - Contains "Amendment", "Q&A" in filename → qa_amendment
-- - Contains "Pricing", "Template" in filename → pricing_template
-- - Default → other
--
-- IDEMPOTENT: Skips proposals that already have solicitation_documents records
--
-- ROLLBACK:
--   DELETE FROM solicitation_documents WHERE doc_type_source = 'ai_classified';

-- =============================================================================
-- BACKFILL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION backfill_solicitation_documents()
RETURNS TABLE (
  result_proposal_id UUID,
  result_document_id UUID,
  result_filename TEXT,
  result_doc_type document_type,
  result_storage_path TEXT,
  result_text_length INTEGER,
  result_notes TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_prop RECORD;
  v_tenant_id UUID;
  v_doc_id UUID;
  v_doc_type document_type;
  v_storage_path TEXT;
  v_filename TEXT;
  v_rfp_text TEXT;
  v_text_length INTEGER;
  v_content_hash TEXT;
  v_classification_rationale TEXT;
BEGIN
  -- Loop through proposals with PDF data in working_data
  FOR v_prop IN
    SELECT
      p.id AS proposal_id,
      p.company_id,
      t.id AS tenant_id,
      p.working_data->>'pdfStoragePath' AS pdf_storage_path,
      p.working_data->>'pdfFileName' AS pdf_filename,
      p.working_data->>'pdfUrl' AS pdf_url,
      p.working_data->>'pdfUploadDate' AS pdf_upload_date,
      p.working_data->>'rfpText' AS rfp_text,
      (p.working_data->>'pdfPageCount')::INTEGER AS page_count
    FROM proposals p
    LEFT JOIN tenants t ON t.company_id = p.company_id
    WHERE p.working_data->>'pdfStoragePath' IS NOT NULL
      AND p.working_data->>'pdfStoragePath' != ''
      -- Skip if already backfilled (idempotent)
      AND NOT EXISTS (
        SELECT 1 FROM solicitation_documents sd
        WHERE sd.proposal_id = p.id
      )
  LOOP
    v_tenant_id := v_prop.tenant_id;
    v_storage_path := v_prop.pdf_storage_path;
    v_filename := COALESCE(v_prop.pdf_filename, 'unknown.pdf');
    v_rfp_text := v_prop.rfp_text;
    v_text_length := COALESCE(LENGTH(v_rfp_text), 0);

    -- Skip if no tenant found
    IF v_tenant_id IS NULL THEN
      result_proposal_id := v_prop.proposal_id;
      result_document_id := NULL;
      result_filename := v_filename;
      result_doc_type := 'other';
      result_storage_path := v_storage_path;
      result_text_length := v_text_length;
      result_notes := 'SKIPPED: No tenant found for company';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Classify document type based on filename
    -- Priority order: PWS/SOW > Instructions/RFQ > Amendment > Pricing > Other
    IF v_filename ~* 'PWS|SOW|Performance.*Work.*Statement|Statement.*of.*Work' THEN
      v_doc_type := 'pws_sow';
      v_classification_rationale := 'Filename contains PWS/SOW keywords';
    ELSIF v_filename ~* 'RFQ|Instructions|Offeror|RFP|Request.*for' THEN
      v_doc_type := 'instructions';
      v_classification_rationale := 'Filename contains RFQ/Instructions/RFP keywords';
    ELSIF v_filename ~* 'Amendment|Q&A|Questions|Answers' THEN
      v_doc_type := 'qa_amendment';
      v_classification_rationale := 'Filename contains Amendment/Q&A keywords';
    ELSIF v_filename ~* 'Pricing|Template|Cost|Schedule' THEN
      v_doc_type := 'pricing_template';
      v_classification_rationale := 'Filename contains Pricing/Template keywords';
    ELSE
      -- Fall back to content-based hints if available
      IF v_rfp_text IS NOT NULL THEN
        IF v_rfp_text ~* 'PERFORMANCE WORK STATEMENT|STATEMENT OF WORK|PWS|SOW' THEN
          v_doc_type := 'pws_sow';
          v_classification_rationale := 'Content contains PWS/SOW heading';
        ELSIF v_rfp_text ~* 'INSTRUCTIONS TO OFFEROR|RFQ|REQUEST FOR QUOTATION' THEN
          v_doc_type := 'instructions';
          v_classification_rationale := 'Content contains RFQ/Instructions heading';
        ELSE
          v_doc_type := 'other';
          v_classification_rationale := 'No classification signals in filename or content';
        END IF;
      ELSE
        v_doc_type := 'other';
        v_classification_rationale := 'No filename pattern match and no text available';
      END IF;
    END IF;

    -- Compute content hash if we have text
    IF v_rfp_text IS NOT NULL AND LENGTH(v_rfp_text) > 0 THEN
      v_content_hash := encode(sha256(convert_to(v_rfp_text, 'UTF8')), 'hex');
    ELSE
      v_content_hash := NULL;
    END IF;

    -- Insert solicitation document
    INSERT INTO solicitation_documents (
      tenant_id,
      proposal_id,
      storage_path,
      filename,
      file_size_bytes,
      page_count,
      doc_type,
      doc_type_source,
      classification_confidence,
      classification_rationale,
      precedence_rank,
      status,
      raw_text,
      content_hash,
      uploaded_at
    ) VALUES (
      v_tenant_id,
      v_prop.proposal_id,
      v_storage_path,
      v_filename,
      0, -- Unknown file size from working_data
      v_prop.page_count,
      v_doc_type,
      'ai_classified'::doc_type_source,
      CASE
        WHEN v_classification_rationale LIKE '%filename%' THEN 0.85
        WHEN v_classification_rationale LIKE '%heading%' THEN 0.75
        ELSE 0.50
      END,
      v_classification_rationale,
      0, -- Trigger will set default based on doc_type
      CASE WHEN v_rfp_text IS NOT NULL THEN 'extracted'::document_status ELSE 'uploaded'::document_status END,
      v_rfp_text,
      v_content_hash,
      COALESCE((v_prop.pdf_upload_date)::TIMESTAMPTZ, now())
    )
    RETURNING id INTO v_doc_id;

    -- Return report row
    result_proposal_id := v_prop.proposal_id;
    result_document_id := v_doc_id;
    result_filename := v_filename;
    result_doc_type := v_doc_type;
    result_storage_path := v_storage_path;
    result_text_length := v_text_length;
    result_notes := v_classification_rationale;
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
  result_row RECORD;
  row_count INTEGER := 0;
  pws_count INTEGER := 0;
  instructions_count INTEGER := 0;
  other_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting solicitation documents backfill...';
  RAISE NOTICE '(NOTE: Confirmed intelligence versions will NOT be modified)';

  FOR result_row IN SELECT * FROM backfill_solicitation_documents()
  LOOP
    row_count := row_count + 1;

    -- Count by type
    IF result_row.result_doc_type = 'pws_sow' THEN
      pws_count := pws_count + 1;
    ELSIF result_row.result_doc_type = 'instructions' THEN
      instructions_count := instructions_count + 1;
    ELSE
      other_count := other_count + 1;
    END IF;

    RAISE NOTICE 'Backfilled: proposal=% doc=% filename=% type=% text_len=% - %',
      result_row.result_proposal_id,
      result_row.result_document_id,
      result_row.result_filename,
      result_row.result_doc_type,
      result_row.result_text_length,
      result_row.result_notes;
  END LOOP;

  IF row_count = 0 THEN
    RAISE NOTICE 'No proposals with PDF data found (this is expected on fresh local DB)';
  ELSE
    RAISE NOTICE '=== BACKFILL SUMMARY ===';
    RAISE NOTICE 'Total documents created: %', row_count;
    RAISE NOTICE '  - pws_sow: %', pws_count;
    RAISE NOTICE '  - instructions: %', instructions_count;
    RAISE NOTICE '  - other: %', other_count;
  END IF;

  -- Verify intelligence versions are untouched
  RAISE NOTICE '';
  RAISE NOTICE '=== CONSERVATION CHECK ===';
  RAISE NOTICE 'Confirmed intelligence versions (should be unchanged):';

  FOR result_row IN
    SELECT
      iv.id,
      iv.proposal_id,
      iv.status,
      iv.confirmation_hash,
      iv.confirmed_at
    FROM intelligence_versions iv
    WHERE iv.status = 'confirmed'
    ORDER BY iv.confirmed_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  version=% proposal=% hash=% confirmed_at=%',
      result_row.id,
      result_row.proposal_id,
      LEFT(result_row.confirmation_hash, 16) || '...',
      result_row.confirmed_at;
  END LOOP;
END $$;

-- Clean up backfill function (not needed after migration)
DROP FUNCTION IF EXISTS backfill_solicitation_documents();

-- =============================================================================
-- POST-MIGRATION VERIFICATION
-- =============================================================================
-- Run these queries to verify the backfill:
--
-- 1. Document type distribution:
--    SELECT doc_type, COUNT(*) FROM solicitation_documents GROUP BY doc_type;
--
-- 2. Verify CAMP proposals have instructions type:
--    SELECT sd.filename, sd.doc_type, sd.classification_rationale
--    FROM solicitation_documents sd
--    WHERE sd.filename ILIKE '%camp%' OR sd.filename ILIKE '%rfq%';
--
-- 3. Verify PM-HCD proposals have pws_sow type:
--    SELECT sd.filename, sd.doc_type, sd.classification_rationale
--    FROM solicitation_documents sd
--    WHERE sd.filename ILIKE '%pws%' OR sd.filename ILIKE '%sow%';
--
-- 4. Confirm intelligence versions untouched:
--    SELECT
--      iv.id,
--      iv.confirmation_hash,
--      iv.confirmed_at,
--      p.title
--    FROM intelligence_versions iv
--    JOIN proposals p ON iv.proposal_id = p.id
--    WHERE iv.status = 'confirmed';
--
-- 5. Cross-reference documents with intelligence:
--    SELECT
--      p.id AS proposal_id,
--      p.title,
--      sd.doc_type,
--      sd.filename,
--      iv.status AS intel_status,
--      iv.confirmation_hash IS NOT NULL AS has_hash
--    FROM proposals p
--    LEFT JOIN solicitation_documents sd ON sd.proposal_id = p.id
--    LEFT JOIN intelligence_versions iv ON iv.proposal_id = p.id AND iv.status != 'superseded'
--    ORDER BY p.created_at DESC;
