-- Fix: assigned_wbs_ids column type
-- WBS element IDs are client-generated strings (e.g., "wbs-1742..."),
-- not Postgres UUIDs. Change column type from UUID[] to TEXT[].
-- Also relax wbs_element_id FK on wbs_submissions since client-side
-- WBS elements may not exist in the wbs_elements table yet.

ALTER TABLE collab_sessions
  ALTER COLUMN assigned_wbs_ids TYPE TEXT[]
  USING assigned_wbs_ids::TEXT[];

-- Drop the FK constraint on wbs_element_id and change to TEXT
ALTER TABLE wbs_submissions
  DROP CONSTRAINT IF EXISTS wbs_submissions_wbs_element_id_fkey;

ALTER TABLE wbs_submissions
  ALTER COLUMN wbs_element_id TYPE TEXT
  USING wbs_element_id::TEXT;
