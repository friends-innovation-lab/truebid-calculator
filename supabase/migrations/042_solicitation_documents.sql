-- Migration: 042_solicitation_documents
-- Phase 4B Pillar 1: Multi-Document Ingestion
--
-- Creates the solicitation_documents table for managing multiple documents
-- per proposal with classification, precedence, and status tracking.

-- Document type classification
CREATE TYPE document_type AS ENUM (
  'pws_sow',         -- Performance Work Statement / Statement of Work
  'instructions',    -- RFQ instructions, evaluation criteria, submission requirements
  'qa_amendment',    -- Questions & Answers, Amendments (supersede earlier content)
  'pricing_template', -- Pricing tables, cost forms
  'other'            -- Attachments, references
);

-- Document type source (how was the type determined)
CREATE TYPE doc_type_source AS ENUM (
  'ai_classified',   -- AI classified with confidence
  'user_confirmed'   -- User reviewed and confirmed
);

-- Document processing status
CREATE TYPE document_status AS ENUM (
  'uploaded',        -- File uploaded, not yet classified
  'classified',      -- AI classification complete
  'extracted',       -- Facts extracted from this document
  'failed'           -- Processing failed
);

-- Main solicitation documents table
CREATE TABLE solicitation_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Storage
  storage_path TEXT NOT NULL,      -- Supabase Storage path
  filename TEXT NOT NULL,          -- Original filename
  file_size_bytes INTEGER NOT NULL,
  page_count INTEGER,

  -- Classification
  doc_type document_type NOT NULL DEFAULT 'other',
  doc_type_source doc_type_source NOT NULL DEFAULT 'ai_classified',
  classification_confidence NUMERIC(3,2) CHECK (classification_confidence >= 0 AND classification_confidence <= 1),
  classification_rationale TEXT,

  -- Precedence (higher rank overrides lower on conflicting facts)
  -- Default: qa_amendment=30, instructions=20, pws_sow=10, other=0
  precedence_rank INTEGER NOT NULL DEFAULT 0,

  -- Processing
  status document_status NOT NULL DEFAULT 'uploaded',
  raw_text TEXT,                   -- Extracted text for evidence lookup
  content_hash TEXT,               -- SHA-256 of raw_text for change detection
  error_message TEXT,

  -- Versioning
  row_version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  classified_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_storage_path UNIQUE (storage_path)
);

-- Indexes for common queries
CREATE INDEX idx_sol_docs_tenant ON solicitation_documents(tenant_id);
CREATE INDEX idx_sol_docs_proposal ON solicitation_documents(proposal_id);
CREATE INDEX idx_sol_docs_status ON solicitation_documents(status);
CREATE INDEX idx_sol_docs_proposal_type ON solicitation_documents(proposal_id, doc_type);
CREATE INDEX idx_sol_docs_proposal_precedence ON solicitation_documents(proposal_id, precedence_rank DESC);

-- Function to set default precedence based on document type
CREATE OR REPLACE FUNCTION set_default_precedence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precedence_rank = 0 THEN
    NEW.precedence_rank := CASE NEW.doc_type
      WHEN 'qa_amendment' THEN 30
      WHEN 'instructions' THEN 20
      WHEN 'pws_sow' THEN 10
      WHEN 'pricing_template' THEN 5
      ELSE 0
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_default_precedence
  BEFORE INSERT ON solicitation_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_default_precedence();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_solicitation_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitation_documents_updated_at
  BEFORE UPDATE ON solicitation_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_solicitation_documents_updated_at();

-- RLS policies
ALTER TABLE solicitation_documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents for proposals in their tenant
CREATE POLICY "Users can view their tenant documents"
  ON solicitation_documents
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Users can insert documents for proposals in their tenant
CREATE POLICY "Users can insert documents for their tenant"
  ON solicitation_documents
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Users can update documents in their tenant
CREATE POLICY "Users can update their tenant documents"
  ON solicitation_documents
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Users can delete documents in their tenant
CREATE POLICY "Users can delete their tenant documents"
  ON solicitation_documents
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Comment documenting the table purpose
COMMENT ON TABLE solicitation_documents IS 'Phase 4B Pillar 1: Multi-document solicitation support. Each proposal can have multiple documents with classification and precedence ordering.';
COMMENT ON COLUMN solicitation_documents.precedence_rank IS 'Higher rank wins on conflicting facts. Default: qa_amendment=30, instructions=20, pws_sow=10, other=0';
COMMENT ON COLUMN solicitation_documents.content_hash IS 'SHA-256 of raw_text; used to detect when document content changes and re-extraction is needed';
