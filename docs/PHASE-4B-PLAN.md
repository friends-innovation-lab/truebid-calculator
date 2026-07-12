# Phase 4B Implementation Plan

**Created:** 2026-07-12
**Status:** DRAFT — Awaiting Review

---

## Executive Summary

Phase 4B delivers three pillars:
1. **Multi-document ingestion** — A solicitation is a classified, precedence-ordered document set
2. **Prescribed staffing constraint** — Enforced role vocabulary on prescribed-staffing solicitations
3. **Evidence spans** — Every intelligence fact traces to verifiable source text

The eval harness proves it works before any production deployment.

---

## Current Architecture (What We Have)

### Extraction Flow
1. User uploads single PDF via `upload-tab.tsx`
2. `/api/extract-rfp` extracts raw text via `unpdf`
3. `/api/proposals/[id]/extract-requirements` runs AI extraction
4. Results stored in `working_data.extractedRequirements` + intelligence tables

### Intelligence Schema
- `intelligence_versions` — Core versioned facts (contract_type, facts_json)
- `intelligence_periods` — Contract periods
- `intelligence_disciplines` — Required disciplines
- `intelligence_labor_requirements` — Extracted roles

### WBS Generation
- `requireConfirmedIntelligence()` guard verifies hash
- `createWbsCandidate()` generates + validates
- `validateWbsCandidate()` checks discipline constraints

### Eval Harness
- Single corpus sample: `pm-hcd`
- Metrics: extraction F1, discipline violations, schema pass rate
- `expected.json` notes `setAside` "requires: additional-documents"

---

## Pillar 1: Multi-Document Ingestion

### Problem Statement

The PM-HCD sample correctly shows `setAside: unknown` because the WOSB designation lives on the SF-1449 cover form, not the PWS. The pipeline currently sees only the PWS.

### Database Schema

**Migration: `042_solicitation_documents.sql`**

```sql
-- Document type classification
CREATE TYPE document_type AS ENUM (
  'pws_sow',        -- Performance Work Statement / Statement of Work
  'instructions',    -- RFQ instructions, evaluation criteria, submission requirements
  'qa_amendment',    -- Questions & Answers, Amendments (supersede earlier content)
  'pricing_template', -- Pricing tables, cost forms
  'other'            -- Attachments, references
);

-- Document type source
CREATE TYPE doc_type_source AS ENUM (
  'ai_classified',   -- AI classified with confidence
  'user_confirmed'   -- User reviewed and confirmed
);

-- Document status
CREATE TYPE document_status AS ENUM (
  'uploaded',        -- File uploaded, not yet classified
  'classified',      -- AI classification complete
  'extracted',       -- Facts extracted from this document
  'failed'           -- Processing failed
);

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

-- Indexes
CREATE INDEX idx_sol_docs_tenant ON solicitation_documents(tenant_id);
CREATE INDEX idx_sol_docs_proposal ON solicitation_documents(proposal_id);
CREATE INDEX idx_sol_docs_status ON solicitation_documents(status);
CREATE INDEX idx_sol_docs_proposal_type ON solicitation_documents(proposal_id, doc_type);
```

**Migration: `043_intelligence_document_set.sql`**

```sql
-- Track which documents an intelligence version was extracted from
ALTER TABLE intelligence_versions
ADD COLUMN document_set_hash TEXT;

-- Hash of sorted content hashes from all source documents
-- Used to detect when a new document requires re-extraction

COMMENT ON COLUMN intelligence_versions.document_set_hash IS
  'SHA-256 of sorted document content hashes; new document invalidates existing versions';
```

### Document Classification API

**Endpoint:** `POST /api/proposals/[id]/documents/classify`

**Input:**
```json
{
  "documentId": "uuid"
}
```

**Process:**
1. Read document text from Supabase Storage
2. Call Claude with small, cheap prompt (haiku or fast model)
3. Return structured classification:
```json
{
  "documentType": "pws_sow",
  "confidence": 0.92,
  "rationale": "Contains Performance Work Statement header and numbered requirements",
  "suggestedPrecedence": 10
}
```

**Classification Prompt (doc-type classifier):**
```
You are classifying a government solicitation document by type.

Document types:
- pws_sow: Performance Work Statement or Statement of Work (scope, deliverables, requirements)
- instructions: RFQ instructions, evaluation criteria, submission requirements, pricing instructions
- qa_amendment: Questions & Answers document, or Amendment modifying prior content
- pricing_template: Pricing tables, cost breakdown forms, labor rate templates
- other: Reference documents, attachments, organizational charts

Return ONLY JSON:
{"documentType": "...", "confidence": 0.0-1.0, "rationale": "one sentence"}

DOCUMENT TEXT (first 5000 chars):
{text}
```

### Doc-Type-Aware Extraction Prompts

Different document types answer different questions:

| Document Type | Facts It Answers |
|--------------|------------------|
| `pws_sow` | disciplines, laborRequirements, periods, scope, deliverables |
| `instructions` | setAside, vehicle, evaluation criteria, submission format, contractType |
| `qa_amendment` | OVERRIDES to any fact — highest precedence |
| `pricing_template` | rate source hints, pricing structure |

**Architecture:**

```
lib/ai/prompts/
  extraction.ts           # Existing - general extraction
  extraction-pws.ts       # PWS-specific prompt additions
  extraction-instructions.ts  # Instructions-specific
  extraction-amendment.ts     # Amendment-specific (focus on deltas)
```

### Fact Merge with Precedence

When multiple documents provide the same fact:
1. Sort documents by `precedence_rank` DESC
2. For each fact key, take the value from highest-precedence document that provides it
3. Record conflict if documents disagree:

```typescript
interface FactConflict {
  factKey: string;  // e.g., 'setAside', 'contractType'
  documents: Array<{
    documentId: string;
    documentType: string;
    value: unknown;
    precedenceRank: number;
  }>;
  resolvedValue: unknown;
  resolutionSource: string;  // documentId that won
}
```

**Store conflicts on intelligence_versions:**
```sql
ALTER TABLE intelligence_versions
ADD COLUMN fact_conflicts JSONB DEFAULT '[]';
```

### UI Changes

**Upload Tab Enhancement:**

1. Change from single-file to multi-file upload
2. Show uploaded files with:
   - Filename
   - Page count
   - Classified type (with confidence indicator)
   - Status badge (uploading → classifying → ready)
3. "Confirm Classifications" button before extraction
4. Low-confidence classifications highlighted for review
5. User can override AI classification

**Review Tab Enhancement:**

1. Show fact conflicts inline: "Q&A Amendment changed setAside from X to Y"
2. Evidence quotes show document source

### Backfill Strategy

Existing proposals have a single PDF stored somewhere (likely in `working_data` or Storage). Migration:

1. Query all proposals with existing PDF data
2. For each, create a `solicitation_documents` row:
   - `doc_type`: Classify based on content (likely `pws_sow` for most)
   - `doc_type_source`: `ai_classified`
   - `status`: `extracted`
3. Link existing intelligence versions to this document
4. Do NOT invalidate existing confirmations

**Conservation Check:** Count of migrated rows == count of proposals with PDFs

---

## Pillar 2: Prescribed Staffing Constraint

### Problem Statement

The PM-HCD RFP specifies 2 key personnel (Senior PM, HCD Lead). The WBS generator produced 5+ roles. For prescribed-staffing contracts, the labor requirements should be a closed vocabulary, not suggestions.

### Database Schema

**Migration: `044_staffing_model.sql`**

```sql
-- Staffing model type
CREATE TYPE staffing_model AS ENUM (
  'prescribed',       -- RFP specifies exact roles (use as closed vocabulary)
  'offeror_proposed', -- Offeror proposes team composition (current behavior)
  'unclear'           -- Needs user clarification before generation
);

-- Add to intelligence_versions
ALTER TABLE intelligence_versions
ADD COLUMN staffing_model staffing_model NOT NULL DEFAULT 'unclear';

-- Add to labor requirements
ALTER TABLE intelligence_labor_requirements
ADD COLUMN is_prescribed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN intelligence_versions.staffing_model IS
  'Whether the RFP prescribes specific roles (closed vocabulary) or expects offeror-proposed staffing';
COMMENT ON COLUMN intelligence_labor_requirements.is_prescribed IS
  'True if this role is explicitly named in the RFP (key personnel), not inferred';
```

### Extraction Changes

**Signals for `staffing_model`:**

| Staffing Model | Signals in PWS |
|---------------|----------------|
| `prescribed` | "the contractor shall provide a [Role]", LCAT tables with named positions, Key Personnel section, "minimum staffing of..." |
| `offeror_proposed` | "propose a staffing approach", "offeror shall determine team composition", "staffing plan to be provided" |
| `unclear` | Neither signal present, ambiguous language |

**Extraction schema addition:**
```typescript
interface ExtractionOutput {
  // ... existing fields
  staffingModel: {
    value: 'prescribed' | 'offeror_proposed' | 'unclear';
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  roles: Array<{
    // ... existing fields
    isPrescribed: boolean;  // True if explicitly named, not inferred
  }>;
}
```

### Validation Changes

**Update `validateWbsCandidate()` in `lib/commands/wbs/validate-wbs-candidate.ts`:**

```typescript
interface IntelligenceContext {
  disciplines: string[];
  periodLabels: string[];
  // NEW:
  staffingModel: 'prescribed' | 'offeror_proposed' | 'unclear';
  prescribedRoles: string[];  // Role titles when staffingModel === 'prescribed'
}

function validateWbsCandidate(
  tasks: TaskInput[],
  context: IntelligenceContext
): ValidationResult {
  const violations: ValidationViolation[] = [];

  for (const task of tasks) {
    for (const assignment of task.staffing) {
      // Existing: discipline check

      // NEW: Role vocabulary check (prescribed only)
      if (context.staffingModel === 'prescribed') {
        const roleMatches = context.prescribedRoles.some(pr =>
          normalizeRoleTitle(pr) === normalizeRoleTitle(assignment.roleTitle)
        );
        if (!roleMatches) {
          violations.push({
            type: 'invalid_role_prescribed',
            taskWbsCode: task.wbsCode,
            roleTitle: assignment.roleTitle,
            details: `Role "${assignment.roleTitle}" not in prescribed vocabulary: ${context.prescribedRoles.join(', ')}`
          });
        }
      }
    }
  }
}
```

### WBS Generation Prompt Changes

When `staffingModel === 'prescribed'`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAFFING CONSTRAINT — PRESCRIBED ROLES ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This solicitation PRESCRIBES specific roles. You may ONLY use these roles:
${prescribedRoles.map(r => `- ${r.title}`).join('\n')}

DO NOT generate tasks requiring other roles.
DO NOT invent new role names.
Allocate ALL work to these prescribed roles.
```

### Gate: Unclear Staffing Model

If `staffingModel === 'unclear'` at confirmation time:
- Block confirmation with error: "Staffing model unclear — resolve before confirming"
- UI shows prompt to select 'prescribed' or 'offeror_proposed'

---

## Pillar 3: Evidence Spans

### Problem Statement

Users need to trust extraction results. Every fact should trace to the document text that justified it. Hallucinated quotes should be structurally rejected.

### Database Schema

**Migration: `045_fact_evidence.sql`**

```sql
-- Evidence confidence
CREATE TYPE evidence_confidence AS ENUM ('high', 'medium', 'low');

CREATE TABLE fact_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id) ON DELETE CASCADE,

  -- Fact identification
  fact_key TEXT NOT NULL,  -- 'contract_type', 'discipline:research', 'labor_req:<id>', 'set_aside'

  -- Source document
  document_id UUID REFERENCES solicitation_documents(id) ON DELETE SET NULL,
  page_number INTEGER,

  -- Verbatim quote (max 300 chars)
  quote TEXT NOT NULL CHECK (length(quote) <= 500),

  -- Character offsets (best effort, nullable)
  char_offset_start INTEGER,
  char_offset_end INTEGER,

  -- Confidence
  confidence evidence_confidence NOT NULL DEFAULT 'medium',

  -- Validation
  quote_validated BOOLEAN NOT NULL DEFAULT false,  -- True if quote was found in document

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fact_evidence_version ON fact_evidence(intelligence_version_id);
CREATE INDEX idx_fact_evidence_fact ON fact_evidence(intelligence_version_id, fact_key);
```

### Extraction Schema Changes

Add evidence to extraction output:

```typescript
interface FactWithEvidence<T> {
  value: T;
  confidence: 'high' | 'medium' | 'low';
  evidence?: {
    quote: string;        // Verbatim text (max 300 chars)
    pageNumber?: number;
  };
}

interface ExtractionOutput {
  contractType: FactWithEvidence<string>;
  setAside: FactWithEvidence<string>;
  vehicle: FactWithEvidence<string>;
  // etc.
  disciplines: Array<{
    discipline: string;
    confidence: string;
    evidence?: { quote: string; pageNumber?: number };
  }>;
  roles: Array<{
    title: string;
    // ... other fields
    evidence?: { quote: string; pageNumber?: number };
  }>;
}
```

### Quote Validation (Anti-Hallucination)

Post-extraction validation:

```typescript
async function validateEvidenceQuotes(
  documentText: string,
  evidence: Array<{ factKey: string; quote: string }>
): Promise<Array<{ factKey: string; valid: boolean; matchPosition?: number }>> {
  const results = [];

  for (const e of evidence) {
    // Normalize whitespace for matching
    const normalizedQuote = normalizeWhitespace(e.quote);
    const normalizedDoc = normalizeWhitespace(documentText);

    // Check for exact match
    const exactIndex = normalizedDoc.indexOf(normalizedQuote);
    if (exactIndex >= 0) {
      results.push({ factKey: e.factKey, valid: true, matchPosition: exactIndex });
      continue;
    }

    // Check for fuzzy match (Levenshtein ≤ 5% of quote length)
    const fuzzyMatch = findFuzzyMatch(normalizedDoc, normalizedQuote, 0.05);
    if (fuzzyMatch) {
      results.push({ factKey: e.factKey, valid: true, matchPosition: fuzzyMatch.position });
      continue;
    }

    // Quote not found — flag fact as low-confidence
    results.push({ factKey: e.factKey, valid: false });
  }

  return results;
}
```

**Consequence of invalid quote:**
- Evidence row created with `quote_validated = false`
- Fact marked `confidence = 'low'`
- UI shows "no source found — verify manually"

### UI Changes

**Contract Intelligence Card Enhancement:**

1. Each fact shows evidence icon on hover
2. Click expands inline quote panel
3. Low-confidence / no-evidence facts show warning badge
4. Quote links to source document (document viewer future phase)

**Design:**
```
┌─────────────────────────────────────────────┐
│ Contract Type: FFP                       ⓘ  │
│ ├─ Evidence: "This is a Firm Fixed Price..." │
│ └─ Source: PWS Section 1.2, Page 3         │
├─────────────────────────────────────────────┤
│ Set-Aside: WOSB                         ⓘ  │
│ ├─ Evidence: "Block 10a: Women-Owned..."    │
│ └─ Source: SF-1449, Page 1                 │
└─────────────────────────────────────────────┘
```

### Confirmation Hash Scope

Evidence rows are NOT included in the confirmation hash. Rationale:
- Facts are what's confirmed (business decision)
- Evidence is supporting metadata (can be updated without re-confirmation)
- Adding evidence to existing confirmed versions should be allowed

Document this decision in the migration comments.

---

## Eval Harness Expansion

### New Corpus Samples

**pm-hcd (enhanced):**
- Add `documents/rfq-instructions.pdf` — the SF-1449/instructions doc
- Update `expected.json`:
  - `setAside.requires: "additional-documents"` → remove, now derivable
  - Add `setAside.evidence: { quote: "...", document: "rfq-instructions" }`
  - Add `staffingModel: "prescribed"`
  - Add `expectedRoles: ["Senior PM/PM", "HCD Lead"]`

**CAMP (new):**
- Add solicitation PDF(s)
- Create `expected.json` from actual submitted bid (Lapedra verifies)
- Should have different discipline mix (ideally engineering-heavy)
- Request ground truth from user

### New Metrics

```typescript
interface EvalMetrics {
  // Existing
  extractionF1: number;
  schemaPassRate: number;
  disciplineViolationCount: number;

  // NEW: Pillar 1
  classificationAccuracy: number;  // doc_type correct / total docs
  factMergeCorrectness: number;    // Conflicts resolved correctly

  // NEW: Pillar 2
  rolePrecision: number;   // Correct roles / Generated roles
  roleRecall: number;      // Correct roles / Expected roles

  // NEW: Pillar 3
  evidenceValidityRate: number;  // Valid quotes / Total quotes
}
```

### Baseline Before Changes

Run eval before any code changes:
```bash
npm run evals -- --save-baseline
```

---

## Backfill Strategy

### Solicitation Documents Backfill

For existing proposals with stored PDFs:

1. **Identify existing PDFs:**
   - Query proposals with `working_data.solicitationRawText` or Storage references

2. **Create solicitation_documents rows:**
   - `storage_path`: existing path or generate new
   - `doc_type`: classify using AI (likely `pws_sow`)
   - `status`: `extracted`
   - `raw_text`: existing text

3. **Update intelligence_versions:**
   - Set `document_set_hash` from single document
   - Do NOT invalidate existing confirmations

4. **Conservation check:**
   - Count proposals with PDFs before
   - Count solicitation_documents after
   - Must match

### Staffing Model Backfill

For existing intelligence versions:

1. Set `staffing_model = 'unclear'` for all
2. Users will resolve on next edit/review

---

## Sequencing

| Step | Description | Deliverable | Gate |
|------|-------------|-------------|------|
| 1 | **This plan** — implementation plan review | This document | Your approval |
| 2 | Eval corpus expansion | pm-hcd + docs, CAMP sample | New baseline |
| 3 | Pillar 1 schema + classification | Migrations 042-043, classify API | Local tests |
| 4 | Pillar 1 extraction | Document-set extraction, fact merge | Eval run |
| 5 | Pillar 2 schema + constraint | Migration 044, validator update | Eval: role precision |
| 6 | Pillar 3 evidence | Migration 045, quote validation | Eval: evidence validity |
| 7 | Backfill rehearsal | Prod-shaped data test | Report |
| 8 | Staging deployment | Full E2E test | Report |
| 9 | **Production migration** | Migrations + backfill | Your explicit go |
| 10 | Deployment + verification | Smoke test, completion report | Final metrics |

---

## API Contract Updates (Post-4B)

### New Endpoints

```
POST /api/proposals/[id]/documents/upload
POST /api/proposals/[id]/documents/classify
POST /api/proposals/[id]/documents/confirm-classifications
DELETE /api/proposals/[id]/documents/[docId]
```

### Modified Endpoints

```
GET /api/proposals/[id]/intelligence
  - Response adds: documentSetHash, factConflicts, staffingModel
  - Each fact adds: evidence[]

POST /api/proposals/[id]/intelligence/confirm
  - Error if staffingModel === 'unclear'
```

---

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| OCR documents (no text) | Flag at upload, defer OCR to future phase |
| Large document sets (>10 files) | Per-document token budgets, sequential extraction |
| Quote validation false negatives | Fuzzy matching with threshold, manual override |
| Prescribed roles with typos | Fuzzy role matching in validator |
| Backfill data loss | Rehearsal against prod-shaped data, conservation checks |

---

## Definition of Done

- [ ] Solicitation is a classified, precedence-ordered document set
- [ ] setAside extracts correctly on pm-hcd with evidence from instructions doc
- [ ] staffingModel is a confirmed fact; user must resolve 'unclear' before confirm
- [ ] Prescribed solicitations generate ONLY prescribed roles (role precision 1.0 on pm-hcd)
- [ ] Role constraint enforced by validator, not just prompt
- [ ] Every intelligence fact carries verifiable evidence OR visible "no source" flag
- [ ] Hallucinated quotes are structurally rejected (quote_validated = false → low confidence)
- [ ] Q&A/amendment precedence works (fixture test)
- [ ] Eval corpus has 2 real samples + new metrics
- [ ] All scores reported: baseline vs final

---

## Design Decisions (Resolved 2026-07-12)

### Q1: Role Matching for Prescribed Staffing
**Decision:** Version-level `staffing_model` plus per-requirement `is_prescribed`. Closed vocabulary = prescribed rows ∪ user-added roles on the active version.

This means:
- Validator checks role against: `intelligence_labor_requirements WHERE is_prescribed = true` + any user-added roles
- Users can expand the vocabulary by adding roles manually
- AI cannot introduce new roles on prescribed contracts

### Q2: Backfill Migration Strategy
**Decision:** Migration curates the two known docs:
- CAMP = `instructions` (doc_type)
- PM-HCD = `pws_sow` (doc_type)
- Both with `doc_type_source = ai_classified` pending user confirmation

### Q3: CAMP Ground Truth
- **Contract Type:** FFP
- **Vehicle:** GSA MAS
- **Periods:** Base + 3 options
- **Staffing Model:** `offeror_proposed` (contrast sample to pm-hcd's `prescribed`)
- **Set-Aside:** Extract from RFQ, report for verification
- **Roles/Disciplines:** Derive from submitted pricing template, flag ambiguities

### Q4: Classification → Extraction Flow
**Correction applied:** User-confirmation step is REQUIRED between classification and extraction.

Flow:
```
upload → classify (AI) → present classifications → user confirms → extract
```

`doc_type_source = user_confirmed` is a real state transition, not decoration. Extraction MUST NOT proceed until user confirms classifications.

---

## Step 2 Progress (Corpus Expansion)

### Completed
- [x] pm-hcd `expected.json` updated with `staffingModel: "prescribed"` and `isPrescribed: true`
- [x] CAMP corpus directory created: `evals/corpus/camp/`
- [x] CAMP `expected.json` created with ground truth
- [x] CAMP `intelligence-input.json` created with disciplines and roles
- [x] CAMP `requirements.json` created (21 requirements from SOO references)
- [x] PDFs extracted to `solicitation.txt` for both samples (pm-hcd: 44KB, camp: 123KB)
- [x] pm-hcd: RFQ Instructions PDF added (contains WOSB set-aside on SF-1449)
- [x] CAMP `expected.json` corrected based on actual RFQ content:
  - Contract type: T&M (hybrid FFP/T&M, T&M dominant)
  - Periods: 3 (Base + 2 Options, not 4)
  - Set-aside: unknown (no designation in document)
- [x] Baseline evals saved: `evals/baseline/baseline-2026-07-12.json`

### Baseline Results (2026-07-12)
| Sample | Extraction F1 | Notes |
|--------|--------------|-------|
| pm-hcd | 1.00 | Perfect extraction including WOSB from RFQ Instructions |
| camp | 0.83 | Labor requirements gap (8/13 roles) |

Schema pass rate: 50% (WBS parse error on CAMP - markdown code fence issue)
Discipline violations: 0 (target achieved)

### Known Issues
1. **CAMP labor requirements**: Expected 13 roles but only 8 extracted. May need to review expected role list against actual document content.
2. **WBS parse error**: Model returns markdown code fence (```json) that parser rejects. Fix needed in WBS generation or parsing.

### Audit: Identity Bleed Check (2026-07-12)
**Prompt**: `lib/ai/prompts/extraction.ts:40-42` contains company-specific language:
```
(tenant-policy-interim: FFTC ruling, Phase 5 umbrella-term catalog)
```
**Impact**: Affects discipline classification (research vs design), NOT set-aside extraction.
**CAMP setAside**: Raw extraction returned `"None"` with confidence 0.6 — correct determination, no SDVOSB bleed.
**Resolution**: Pillar 3 evidence-quote requirement will structurally prevent this class of error (no quote = low confidence = flagged for review).

### Audit: CAMP Periods Raw Extraction (2026-07-12)
```json
{
  "basePeriodMonths": 12,
  "optionPeriodMonths": [12, 12]
}
```
**Result**: 3 periods (Base + 2 Options). Document contains no "transition period" beyond pricing years. Ground truth correction verified.

---

**Status:** Step 2 COMPLETE. Proceeding to Step 3 (Pillar 1 schema + classification).

---

## Step 3 Progress (Pillar 1 Schema + Classification)

### Completed (2026-07-12)
- [x] Migration `042_solicitation_documents.sql` created:
  - `document_type` enum: pws_sow, instructions, qa_amendment, pricing_template, other
  - `doc_type_source` enum: ai_classified, user_confirmed
  - `document_status` enum: uploaded, classified, extracted, failed
  - `solicitation_documents` table with storage, classification, precedence, status fields
  - Auto-precedence trigger (qa_amendment=30, instructions=20, pws_sow=10)
  - RLS policies for tenant-scoped access
- [x] Migration `043_intelligence_document_set.sql` created:
  - `document_set_hash` column on intelligence_versions
  - `fact_conflicts` JSONB column on intelligence_versions
  - `compute_document_set_hash()` function
  - `document_set_changed()` function for invalidation detection
- [x] Classification API: `POST /api/proposals/[id]/documents/classify`
  - Uses claude-sonnet-4-6 for fast classification
  - Returns structured result with documentType, confidence, rationale
  - Updates document record with classification and precedence
- [x] Local migrations verified (supabase db reset)
- [x] TypeScript check passes

### Pending
- [ ] Document upload API (upload + text extraction)
- [ ] Confirm classifications API (user approval gate)
- [ ] Delete document API
- [ ] UI changes for multi-document upload tab

### Next
Step 4: Pillar 1 extraction (document-set extraction, fact merge)

---

## Pillar 2 Progress (Prescribed Staffing Constraint)

### Rulings Applied (2026-07-12)
1. **CAMP periods = 4** (reverted): Periods = priced CLIN structure. Transition/phase-in is a milestone within base, not a separate period. Added to extraction prompt + `lib/ai/knowledge/periods.ts`.
2. **CAMP setAside**: Deferred to Pillar 3. Evidence-quote requirement will kill this error class.

### Completed
- [x] Migration `044_staffing_model.sql`:
  - `staffing_model` enum: prescribed, offeror_proposed, unclear
  - `staffing_model` column on `intelligence_versions`
  - `is_prescribed` column on `intelligence_labor_requirements`
  - `get_prescribed_roles()` function for WBS validation
- [x] Schema updates (`lib/schemas/contract-intelligence.ts`):
  - `staffingModelSchema` enum added
  - `isPrescribed` field on roles
  - `staffingModel` field on extraction output
  - JSON schema updated for tool-use pattern
- [x] Extraction prompt updated (`lib/ai/prompts/extraction.ts`):
  - Period extraction rules (CLIN-based, not milestone-based)
  - Staffing model extraction rules
- [x] Command updated (`lib/commands/intelligence/create-draft.ts`):
  - Accepts `staffingModel` and `isPrescribed` inputs
  - Persists to database
- [x] Type definitions updated (`lib/commands/intelligence/types.ts`)
- [x] TypeScript check passes

### Hardening Tests Completed (2026-07-12)
- [x] WBS validator role check (`lib/commands/wbs/validate-wbs-candidate.ts`):
  - `loadIntelligenceContext` loads staffingModel + prescribedRoles
  - `validateWbsCandidate` enforces role vocabulary when staffingModel === 'prescribed'
  - `normalizeRoleTitle()` handles case/prefix variations
  - Added `invalid_role_prescribed` violation type
- [x] WBS generation prompt (`app/api/proposals/[id]/generate-wbs/route.ts`):
  - Added PRESCRIBED STAFFING section when staffingModel === 'prescribed'
  - Lists exact role vocabulary as CLOSED set
  - Explicit: "Do NOT invent new role titles"
- [x] Confirmation gate (`lib/commands/intelligence/confirm-version.ts`):
  - Returns `STAFFING_MODEL_UNCLEAR` error with structured details
  - Includes `explanation`, `actionRequired`, `options` for UI
  - Added `STAFFING_MODEL_UNCLEAR` to CommandErrorCode

### Tests Added
- [x] `__tests__/lib/commands/wbs.test.ts`: prescribed staffing enforcement (4 tests)
- [x] `__tests__/lib/commands/intelligence.test.ts`: unclear-blocks-confirm UI explanation (2 tests)

All 66 tests pass.

---

**Status:** Pillar 2 COMPLETE. Proceeding to Pillar 3 (Evidence Spans + Quotation).
