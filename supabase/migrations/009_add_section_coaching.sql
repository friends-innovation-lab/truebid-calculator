-- ============================================================================
-- Add section_coaching table for Shipley coaching engine
-- ============================================================================

CREATE TABLE section_coaching (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL
    REFERENCES proposal_sections(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL
    REFERENCES proposals(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}',
  feedback JSONB NOT NULL DEFAULT '[]',
  overall_assessment TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  content_snapshot TEXT
  -- hash of content when coaching was run
  -- used to detect if content has changed since
);

CREATE INDEX idx_coaching_section
  ON section_coaching(section_id);

ALTER TABLE section_coaching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages coaching"
  ON section_coaching FOR ALL
  USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN companies c ON p.company_id = c.id
      WHERE c.owner_id = auth.uid()
    )
  );
