-- Phase 6: Collaborator section links for contributor and subcontractor access

CREATE TABLE collab_section_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('contributor', 'subcontractor')),
  label TEXT,
  reviewer_email TEXT,
  reviewer_name TEXT,
  section_ids TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  submission_status TEXT DEFAULT 'pending' CHECK (
    submission_status IN ('pending', 'submitted', 'approved', 'rejected', 'transform_pending', 'transform_approved')
  ),
  submitted_at TIMESTAMPTZ,
  submission_content JSONB,
  transformed_content JSONB,
  reviewer_note TEXT,
  approved_at TIMESTAMPTZ
);

ALTER TABLE collab_section_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company manages collab links"
  ON collab_section_links
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_collab_section_links_token ON collab_section_links(token);
CREATE INDEX idx_collab_section_links_proposal ON collab_section_links(proposal_id);
