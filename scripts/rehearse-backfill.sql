-- Backfill Rehearsal Script
-- Phase 4B Step 6: Test migration against prod-shaped data
--
-- Creates test data simulating production state:
-- 1. CAMP proposal with RFQ PDF → should classify as 'instructions'
-- 2. PM-HCD proposal with PWS PDF → should classify as 'pws_sow'
-- 3. Confirmed intelligence version to verify conservation
--
-- Run with: psql $DATABASE_URL -f scripts/rehearse-backfill.sql

-- =============================================================================
-- SETUP TEST DATA
-- =============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_tenant_id UUID;
  v_user_id UUID;
  v_camp_proposal_id UUID;
  v_pmhcd_proposal_id UUID;
  v_camp_version_id UUID;
  v_pmhcd_version_id UUID;
BEGIN
  RAISE NOTICE '=== REHEARSAL: Creating prod-shaped test data ===';

  -- Create test company if not exists
  INSERT INTO companies (id, name, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Test Company for Backfill',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_company_id;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Create tenant for company if not exists
  INSERT INTO tenants (id, company_id, name, slug, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000002',
    v_company_id,
    'Test Tenant',
    'test-tenant-backfill',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants WHERE id = '00000000-0000-0000-0000-000000000002';
  END IF;

  RAISE NOTICE 'Company: %, Tenant: %', v_company_id, v_tenant_id;

  -- Create CAMP proposal with RFQ PDF (should → instructions)
  INSERT INTO proposals (
    id,
    company_id,
    title,
    solicitation_number,
    agency,
    working_data,
    created_at,
    updated_at
  )
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    v_company_id,
    'CAMP Cloud RFQ Test',
    'W56HZV-25-R-CAMP',
    'Army',
    jsonb_build_object(
      'pdfStoragePath', 'test-company/camp/1234567890-CAMP_RFQ_Instructions.pdf',
      'pdfFileName', 'CAMP_RFQ_Instructions.pdf',
      'pdfUrl', 'https://storage.test/camp.pdf',
      'pdfUploadDate', now()::TEXT,
      'rfpText', 'REQUEST FOR QUOTATION (RFQ) - CAMP Cloud Migration\n\nINSTRUCTIONS TO OFFERORS\n\nThis RFQ is for commercial cloud migration services under CAMP.\n\nSection 1: Background\nThe Army requires cloud infrastructure services...\n\nSection 2: Evaluation Criteria\nOffers will be evaluated based on technical capability and price.'
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_camp_proposal_id;

  IF v_camp_proposal_id IS NULL THEN
    v_camp_proposal_id := '11111111-1111-1111-1111-111111111111';
  END IF;

  RAISE NOTICE 'CAMP Proposal: %', v_camp_proposal_id;

  -- Create PM-HCD proposal with PWS PDF (should → pws_sow)
  INSERT INTO proposals (
    id,
    company_id,
    title,
    solicitation_number,
    agency,
    working_data,
    created_at,
    updated_at
  )
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_company_id,
    'PM-HCD Product Management',
    'HQ0034-25-R-PMHCD',
    'GSA',
    jsonb_build_object(
      'pdfStoragePath', 'test-company/pmhcd/1234567891-2B_-_Att_1_PWS_OCIO_Product_Management_and_HCD.pdf',
      'pdfFileName', '2B_-_Att_1_PWS_OCIO_Product_Management_and_HCD.pdf',
      'pdfUrl', 'https://storage.test/pmhcd.pdf',
      'pdfUploadDate', now()::TEXT,
      'rfpText', 'PERFORMANCE WORK STATEMENT (PWS)\n\nOCIO PRODUCT MANAGEMENT AND HUMAN-CENTERED DESIGN SERVICES\n\n1. BACKGROUND\nThe contractor shall provide product management and HCD services...\n\n2. SCOPE\nThe contractor shall:\n- Lead Agile product teams\n- Conduct user research\n- Design and implement solutions\n\n3. KEY PERSONNEL\nThe contractor shall provide the following Key Personnel:\n- Program Manager\n- Lead Product Manager\n- Lead UX Designer\n- Senior UX Researcher'
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_pmhcd_proposal_id;

  IF v_pmhcd_proposal_id IS NULL THEN
    v_pmhcd_proposal_id := '22222222-2222-2222-2222-222222222222';
  END IF;

  RAISE NOTICE 'PM-HCD Proposal: %', v_pmhcd_proposal_id;

  -- Create DRAFT intelligence version for PM-HCD first (to add labor reqs)
  INSERT INTO intelligence_versions (
    id,
    tenant_id,
    proposal_id,
    version_number,
    status,
    facts_json,
    contract_type,
    staffing_model,
    extracted_at,
    created_at
  )
  VALUES (
    '33333333-3333-3333-3333-333333333333',
    v_tenant_id,
    v_pmhcd_proposal_id,
    1,
    'draft',  -- Start as draft to allow labor req insertion
    jsonb_build_object(
      'contractType', jsonb_build_object('value', 'T&M', 'confidence', 'high'),
      'setAside', jsonb_build_object('value', 'None', 'confidence', 'high'),
      'documentType', jsonb_build_object('value', 'PWS', 'confidence', 'high')
    ),
    'T&M',
    'prescribed',
    now() - INTERVAL '1 day',
    now() - INTERVAL '1 day'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_pmhcd_version_id;

  IF v_pmhcd_version_id IS NULL THEN
    v_pmhcd_version_id := '33333333-3333-3333-3333-333333333333';
  END IF;

  RAISE NOTICE 'PM-HCD Intelligence Version (draft): %', v_pmhcd_version_id;

  -- Add labor requirements with prescribed roles (before confirming)
  INSERT INTO intelligence_labor_requirements (
    version_id,
    title,
    labor_category,
    is_prescribed,
    confidence
  )
  VALUES
    (v_pmhcd_version_id, 'Program Manager', 'Management', true, 'high'),
    (v_pmhcd_version_id, 'Lead Product Manager', 'Product Management', true, 'high'),
    (v_pmhcd_version_id, 'Lead UX Designer', 'Design', true, 'high'),
    (v_pmhcd_version_id, 'Senior UX Researcher', 'Research', true, 'high')
  ON CONFLICT DO NOTHING;

  -- Now confirm the version (simulating what the UI does)
  UPDATE intelligence_versions
  SET
    status = 'confirmed',
    confirmation_hash = 'abc123def456789_original_hash_must_be_preserved',
    confirmed_at = now() - INTERVAL '1 day'
  WHERE id = v_pmhcd_version_id;

  -- Set active intelligence version
  UPDATE proposals
  SET active_intelligence_version_id = v_pmhcd_version_id
  WHERE id = v_pmhcd_proposal_id;

  RAISE NOTICE 'PM-HCD Intelligence Version (now confirmed): %', v_pmhcd_version_id;

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST DATA CREATED ===';
  RAISE NOTICE 'CAMP proposal has RFQ PDF → expect: instructions';
  RAISE NOTICE 'PM-HCD proposal has PWS PDF → expect: pws_sow';
  RAISE NOTICE 'PM-HCD has confirmed intelligence with hash: abc123def456789_original_hash_must_be_preserved';
END $$;

-- =============================================================================
-- RECORD PRE-BACKFILL STATE
-- =============================================================================

\echo ''
\echo '=== PRE-BACKFILL STATE ==='

\echo ''
\echo 'Proposals with PDF data:'
SELECT
  id,
  title,
  working_data->>'pdfFileName' AS pdf_filename,
  working_data->>'pdfStoragePath' AS storage_path
FROM proposals
WHERE working_data->>'pdfStoragePath' IS NOT NULL;

\echo ''
\echo 'Existing solicitation_documents (should be empty):'
SELECT id, filename, doc_type, doc_type_source FROM solicitation_documents;

\echo ''
\echo 'Confirmed intelligence versions (MUST remain unchanged):'
SELECT
  id,
  proposal_id,
  status,
  confirmation_hash,
  confirmed_at
FROM intelligence_versions
WHERE status = 'confirmed';

-- =============================================================================
-- RUN BACKFILL
-- =============================================================================

\echo ''
\echo '=== RUNNING BACKFILL ==='

-- Recreate the backfill function (already dropped by migration)
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

    IF v_rfp_text IS NOT NULL AND LENGTH(v_rfp_text) > 0 THEN
      v_content_hash := encode(sha256(convert_to(v_rfp_text, 'UTF8')), 'hex');
    ELSE
      v_content_hash := NULL;
    END IF;

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
      0,
      v_prop.page_count,
      v_doc_type,
      'ai_classified'::doc_type_source,
      CASE
        WHEN v_classification_rationale LIKE '%filename%' THEN 0.85
        WHEN v_classification_rationale LIKE '%heading%' THEN 0.75
        ELSE 0.50
      END,
      v_classification_rationale,
      0,
      CASE WHEN v_rfp_text IS NOT NULL THEN 'extracted'::document_status ELSE 'uploaded'::document_status END,
      v_rfp_text,
      v_content_hash,
      COALESCE((v_prop.pdf_upload_date)::TIMESTAMPTZ, now())
    )
    RETURNING id INTO v_doc_id;

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

-- Run the backfill
SELECT * FROM backfill_solicitation_documents();

-- Cleanup
DROP FUNCTION IF EXISTS backfill_solicitation_documents();

-- =============================================================================
-- POST-BACKFILL VERIFICATION
-- =============================================================================

\echo ''
\echo '=== POST-BACKFILL REPORT ==='

\echo ''
\echo '1. Document Classification Results:'
SELECT
  sd.filename,
  sd.doc_type,
  sd.doc_type_source,
  sd.classification_rationale,
  p.title AS proposal_title
FROM solicitation_documents sd
JOIN proposals p ON sd.proposal_id = p.id
ORDER BY p.title;

\echo ''
\echo '2. CAMP Classification (expect: instructions):'
SELECT
  CASE WHEN doc_type = 'instructions' THEN 'PASS ✓' ELSE 'FAIL ✗' END AS result,
  filename,
  doc_type,
  doc_type_source
FROM solicitation_documents
WHERE filename ILIKE '%camp%' OR filename ILIKE '%rfq%';

\echo ''
\echo '3. PM-HCD Classification (expect: pws_sow):'
SELECT
  CASE WHEN doc_type = 'pws_sow' THEN 'PASS ✓' ELSE 'FAIL ✗' END AS result,
  filename,
  doc_type,
  doc_type_source
FROM solicitation_documents
WHERE filename ILIKE '%pws%' OR filename ILIKE '%sow%';

\echo ''
\echo '4. CONSERVATION CHECK - Confirmed Intelligence Versions:'
SELECT
  CASE
    WHEN confirmation_hash = 'abc123def456789_original_hash_must_be_preserved'
    THEN 'PASS ✓ Hash preserved'
    ELSE 'FAIL ✗ Hash changed!'
  END AS conservation_result,
  id,
  status,
  confirmation_hash,
  confirmed_at
FROM intelligence_versions
WHERE status = 'confirmed';

\echo ''
\echo '5. Summary Statistics:'
SELECT
  doc_type,
  doc_type_source,
  COUNT(*) AS count
FROM solicitation_documents
GROUP BY doc_type, doc_type_source
ORDER BY doc_type;

\echo ''
\echo '=== REHEARSAL COMPLETE ==='
