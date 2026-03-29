-- ============================================================================
-- Add proposal_sections table for Technical Volume outline
-- Stores hierarchical section structure with AI-generated content
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL
    REFERENCES proposals(id) ON DELETE CASCADE,

  -- Hierarchy
  parent_id UUID REFERENCES proposal_sections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Section identification
  section_number TEXT,  -- e.g., "1", "1.1", "2.3.1"
  title TEXT NOT NULL,

  -- Content
  summary TEXT,  -- Brief description/purpose of this section
  content TEXT,  -- Full narrative content (can be AI-generated)
  instructions TEXT,  -- Writing instructions/guidance for this section

  -- Source tracking
  compliance_item_ids TEXT[] DEFAULT '{}',  -- Links to compliance matrix items
  requirement_refs TEXT[] DEFAULT '{}',  -- Original requirement references

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'review', 'complete')),

  -- Word count tracking
  target_word_count INTEGER,
  actual_word_count INTEGER DEFAULT 0,

  -- Metadata
  owner TEXT,  -- Assigned author
  notes TEXT,
  ai_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_proposal_sections_proposal ON proposal_sections(proposal_id);
CREATE INDEX idx_proposal_sections_parent ON proposal_sections(parent_id);
CREATE INDEX idx_proposal_sections_sort ON proposal_sections(proposal_id, parent_id, sort_order);

-- RLS
ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage sections for proposals they own
CREATE POLICY "Users manage their proposal sections"
  ON proposal_sections FOR ALL
  USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN companies c ON p.company_id = c.id
      WHERE c.owner_id = auth.uid()
    )
  );

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_proposal_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposal_sections_updated_at
  BEFORE UPDATE ON proposal_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_sections_updated_at();
