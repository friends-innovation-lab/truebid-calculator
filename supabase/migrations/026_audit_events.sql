-- Phase 1: Audit Events Table
-- Immutable log of all command executions for compliance and debugging
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS audit_events CASCADE;

CREATE TABLE audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tenant context (required for multi-tenancy)
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Actor information
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'ai_job')),
  actor_id TEXT NOT NULL, -- user UUID, 'system', or job ID

  -- Command context
  command_name TEXT NOT NULL, -- e.g., 'CreateProposal', 'UpdateProposalMetadata'
  aggregate_type TEXT NOT NULL, -- e.g., 'proposal', 'role', 'wbs_element'
  aggregate_id UUID NOT NULL, -- ID of the modified entity

  -- Version tracking for optimistic concurrency
  before_version INTEGER, -- NULL for creates
  after_version INTEGER NOT NULL,

  -- Change details
  changed_fields JSONB, -- Which fields changed and their before/after values
  command_input JSONB, -- Sanitized input (no PII)

  -- Correlation for distributed operations
  correlation_id UUID, -- Links related events across commands

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
-- Most common query: events for a specific entity
CREATE INDEX idx_audit_aggregate ON audit_events(aggregate_type, aggregate_id, created_at DESC);

-- Query by tenant (for audit reports)
CREATE INDEX idx_audit_tenant ON audit_events(tenant_id, created_at DESC);

-- Query by actor (who did what)
CREATE INDEX idx_audit_actor ON audit_events(tenant_id, actor_type, actor_id, created_at DESC);

-- Query by command (what operations happened)
CREATE INDEX idx_audit_command ON audit_events(tenant_id, command_name, created_at DESC);

-- Correlation lookups
CREATE INDEX idx_audit_correlation ON audit_events(correlation_id) WHERE correlation_id IS NOT NULL;

-- RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can read audit events (compliance requirement)
CREATE POLICY "Owner/admin read audit events"
  ON audit_events
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- Insert-only: events are immutable (no updates/deletes)
-- Service role inserts via API, not direct user writes
CREATE POLICY "System insert audit events"
  ON audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Verify user belongs to the tenant they're creating events for
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Comments
COMMENT ON TABLE audit_events IS 'Immutable audit log of all command executions';
COMMENT ON COLUMN audit_events.actor_type IS 'user=authenticated user, system=background job, ai_job=AI processing';
COMMENT ON COLUMN audit_events.before_version IS 'NULL for create operations';
COMMENT ON COLUMN audit_events.changed_fields IS 'JSON object with field names as keys, {old, new} as values';
COMMENT ON COLUMN audit_events.correlation_id IS 'Links related events across multiple commands in a logical operation';
