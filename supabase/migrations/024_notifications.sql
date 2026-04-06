-- In-app notifications for collab submissions, BOE approvals, etc.

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('collab_submitted', 'boe_approved', 'boe_corrections')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company reads own notifications"
  ON notifications
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_notifications_company ON notifications(company_id, read, created_at DESC);
