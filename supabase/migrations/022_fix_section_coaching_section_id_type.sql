-- Fix section_coaching.section_id to support both UUID and outline IDs (sec-1-1 format)
-- Drop foreign key constraint and change column type to TEXT

-- First drop the unique constraint we just added
ALTER TABLE section_coaching
  DROP CONSTRAINT IF EXISTS section_coaching_proposal_section_unique;

-- Drop the foreign key constraint
ALTER TABLE section_coaching
  DROP CONSTRAINT IF EXISTS section_coaching_section_id_fkey;

-- Change column type to TEXT
ALTER TABLE section_coaching
  ALTER COLUMN section_id TYPE TEXT;

-- Re-add the unique constraint
ALTER TABLE section_coaching
  ADD CONSTRAINT section_coaching_proposal_section_unique
  UNIQUE (proposal_id, section_id);
