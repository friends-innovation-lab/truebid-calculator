-- Add unique constraint on (proposal_id, section_id) for upsert to work
ALTER TABLE section_coaching
  ADD CONSTRAINT section_coaching_proposal_section_unique
  UNIQUE (proposal_id, section_id);
