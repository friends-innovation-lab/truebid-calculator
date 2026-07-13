-- Verification Script for extraction-ui-prep branch
-- Run against STAGING after migrations 061 + 062 are applied
-- Each test should produce the documented result

-- =============================================================================
-- TEST 2a: UPDATE/DELETE fact_evidence under confirmed version → REJECTED
-- =============================================================================

-- First, find a confirmed intelligence version
SELECT id, status, proposal_id
FROM intelligence_versions
WHERE status = 'confirmed'
LIMIT 1;
-- Record the version ID as: [CONFIRMED_VERSION_ID]

-- Insert a test fact_evidence row (this will FAIL because version is confirmed)
INSERT INTO fact_evidence (intelligence_version_id, quote_text)
VALUES ('[CONFIRMED_VERSION_ID]', 'Test quote that should be rejected');
-- EXPECTED: ERROR: Cannot modify fact table row: parent intelligence version is confirmed

-- If there's an existing fact_evidence row under a confirmed version:
-- UPDATE fact_evidence SET quote_text = 'Modified' WHERE intelligence_version_id = '[CONFIRMED_VERSION_ID]';
-- EXPECTED: ERROR: Cannot modify fact table row: parent intelligence version is confirmed

-- DELETE FROM fact_evidence WHERE intelligence_version_id = '[CONFIRMED_VERSION_ID]';
-- EXPECTED: ERROR: Cannot modify fact table row: parent intelligence version is confirmed


-- =============================================================================
-- TEST 2b: UPDATE accepted requirement_link status → REJECTED
-- =============================================================================

-- Find an existing accepted requirement link
SELECT id, status, requirement_id, wbs_task_id
FROM requirement_links
WHERE status = 'accepted'
LIMIT 1;
-- Record the link ID as: [ACCEPTED_LINK_ID]

-- Try to change its status (should fail)
UPDATE requirement_links
SET status = 'proposed'
WHERE id = '[ACCEPTED_LINK_ID]';
-- EXPECTED: ERROR: Cannot change status of non-proposed requirement link (id: [ID], current status: accepted)

UPDATE requirement_links
SET status = 'rejected'
WHERE id = '[ACCEPTED_LINK_ID]';
-- EXPECTED: ERROR: Cannot change status of non-proposed requirement link (id: [ID], current status: accepted)


-- =============================================================================
-- TEST 2c: proposed → accepted succeeds and resolved_at auto-stamps
-- =============================================================================

-- Create a test proposed link
INSERT INTO requirement_links (requirement_id, wbs_task_id, status, suggesting_evidence, proposed_at)
SELECT
  r.id,
  t.id,
  'proposed',
  'Test evidence for verification',
  now()
FROM requirements r
CROSS JOIN wbs_tasks t
LIMIT 1
RETURNING id, status, resolved_at;
-- Record the new link ID as: [PROPOSED_LINK_ID]
-- resolved_at should be NULL

-- Transition to accepted
UPDATE requirement_links
SET status = 'accepted'
WHERE id = '[PROPOSED_LINK_ID]'
RETURNING id, status, resolved_at;
-- EXPECTED:
--   status = 'accepted'
--   resolved_at = <auto-populated timestamp, NOT NULL>

-- Verify the resolved_at was set
SELECT id, status, resolved_at, resolved_at IS NOT NULL as auto_stamped
FROM requirement_links
WHERE id = '[PROPOSED_LINK_ID]';
-- EXPECTED: auto_stamped = true


-- =============================================================================
-- CLEANUP (optional - remove test data)
-- =============================================================================

-- DELETE FROM requirement_links WHERE id = '[PROPOSED_LINK_ID]';


-- =============================================================================
-- VERIFICATION SUMMARY
-- =============================================================================
--
-- Test 2a (fact_evidence immutability):
--   [ ] INSERT under confirmed version rejected
--   [ ] UPDATE under confirmed version rejected
--   [ ] DELETE under confirmed version rejected
--
-- Test 2b (accepted link immutability):
--   [ ] Status change from 'accepted' rejected
--
-- Test 2c (proposed → accepted transition):
--   [ ] Transition succeeds
--   [ ] resolved_at auto-populated
