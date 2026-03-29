-- ============================================================================
-- Recreate collab tables with correct column types (TEXT instead of UUID)
-- Safe to run — drops and recreates. No production data in these tables yet.
-- ============================================================================

-- Ensure pgcrypto extension is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS wbs_submissions CASCADE;
DROP TABLE IF EXISTS collab_sessions CASCADE;

CREATE TABLE collab_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL
    REFERENCES proposals(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_title TEXT,
  token TEXT NOT NULL UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  assigned_wbs_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'expired')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
    DEFAULT (now() + interval '7 days'),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_collab_sessions_proposal
  ON collab_sessions(proposal_id);
CREATE INDEX idx_collab_sessions_token
  ON collab_sessions(token);

CREATE TABLE wbs_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL
    REFERENCES collab_sessions(id) ON DELETE CASCADE,
  wbs_element_id TEXT,

  is_new_element BOOLEAN DEFAULT false,
  proposed_title TEXT,
  proposed_hours JSONB DEFAULT '{}',
  proposed_roles JSONB DEFAULT '[]',
  proposed_estimation_method TEXT
    CHECK (proposed_estimation_method IN (
      'engineering', 'parametric', 'historical', null
    )),
  proposed_assumptions TEXT,
  proposed_notes TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'accepted', 'modified', 'rejected'
    )),
  reviewer_comment TEXT,
  owner_response TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wbs_submissions_session
  ON wbs_submissions(session_id);
CREATE INDEX idx_wbs_submissions_wbs
  ON wbs_submissions(wbs_element_id);

-- RLS
ALTER TABLE collab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wbs_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages collab sessions"
  ON collab_sessions FOR ALL
  USING (created_by = auth.uid());

CREATE POLICY "Owner manages submissions"
  ON wbs_submissions FOR ALL
  USING (
    session_id IN (
      SELECT id FROM collab_sessions
      WHERE created_by = auth.uid()
    )
  );
