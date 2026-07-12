# Phase 6A Implementation Plan

## Overview

Phase 6A establishes pricing as an explicit bounded context and completes the elimination of working_data writers. This document specifies the implementation plan per prompt requirements.

---

## 1. Pricing Domain Schema

### 1.1 `pricing_scenarios` Table

```sql
CREATE TYPE pricing_scenario_status AS ENUM ('draft', 'approved', 'superseded');

CREATE TABLE pricing_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),

  label TEXT NOT NULL DEFAULT 'Primary',
  status pricing_scenario_status NOT NULL DEFAULT 'draft',

  -- Rate config snapshot: indirect rates + profit targets + escalation in effect at compute time
  rate_config_snapshot JSONB NOT NULL,

  -- Computation metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine_version TEXT NOT NULL,  -- e.g., 'v1.0.0'
  created_by UUID REFERENCES auth.users(id),

  -- Optimistic concurrency
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique: one approved scenario per proposal
CREATE UNIQUE INDEX idx_pricing_scenarios_one_approved
  ON pricing_scenarios(proposal_id)
  WHERE status = 'approved';

-- Trigger: wbs_version_id must reference active or superseded, never candidate
CREATE OR REPLACE FUNCTION check_wbs_version_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status wbs_status;
BEGIN
  SELECT status INTO v_status FROM wbs_versions WHERE id = NEW.wbs_version_id;
  IF v_status NOT IN ('active', 'superseded') THEN
    RAISE EXCEPTION 'pricing_scenarios can only reference active or superseded WBS versions, got: %', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_scenario_wbs_status_check
  BEFORE INSERT OR UPDATE ON pricing_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION check_wbs_version_status();
```

### 1.2 `pricing_lines` Table (Line IS the Ledger)

The pricing_lines table stores the full calculation trace per line. This IS the calculation ledger—no separate ledger table needed.

**Trace Columns Verified Against `lib/pricing/types.ts` PricingBreakdown:**

| Engine Field | DB Column | Type | Notes |
|--------------|-----------|------|-------|
| `annualSalary` | `resolved_salary_cents` | BIGINT | Stored in cents; source tracked in `salary_source` |
| `standardHours` | — | — | Constant 2080, not stored (recoverable from engine) |
| `baseHourly` | `base_hourly` | NUMERIC(12,6) | salary / 2080 |
| `fringeAmount` | `fringe_amount` | NUMERIC(12,6) | base_hourly × fringe_rate |
| `afterFringe` | — | — | Derived: base_hourly + fringe_amount |
| `overheadAmount` | `overhead_amount` | NUMERIC(12,6) | afterFringe × overhead_rate |
| `afterOverhead` | `overhead_base` | NUMERIC(12,6) | Named `overhead_base` per spec (afterFringe) |
| `gaAmount` | `ga_amount` | NUMERIC(12,6) | afterOverhead × ga_rate |
| `costBeforeProfit` | `cost_before_profit` | NUMERIC(12,6) | afterOverhead + ga_amount |
| `profitRate` | `profit_rate` | NUMERIC(5,4) | Decimal (0.10 = 10%) |
| `profitAmount` | `profit_amount` | NUMERIC(12,6) | cost_before_profit × profit_rate |
| `fullyBurdenedRate` | `fully_burdened` | NUMERIC(12,2) | Final rate, 2 decimals |
| `rates.fringe` | — | — | In `rate_config_snapshot` on parent |
| `rates.overhead` | — | — | In `rate_config_snapshot` on parent |
| `rates.ga` | — | — | In `rate_config_snapshot` on parent |
| `formulaVersion` | `engine_version` | — | On parent scenario |

```sql
CREATE TYPE salary_source_type AS ENUM ('catalog', 'override');
CREATE TYPE profit_source_type AS ENUM ('explicit', 'contract_default');

CREATE TABLE pricing_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id) ON DELETE CASCADE,
  staffing_assignment_id UUID NOT NULL REFERENCES staffing_assignments(id),

  -- Period and hours
  period_label TEXT NOT NULL,
  hours NUMERIC(10,2) NOT NULL,

  -- Resolved salary with provenance
  resolved_salary_cents BIGINT NOT NULL,
  salary_source salary_source_type NOT NULL,
  level_key TEXT,
  step_index INTEGER,

  -- FULL CALCULATION TRACE (the line IS the ledger)
  base_hourly NUMERIC(12,6) NOT NULL,
  fringe_amount NUMERIC(12,6) NOT NULL,
  overhead_base NUMERIC(12,6) NOT NULL,    -- afterFringe in engine terms
  overhead_amount NUMERIC(12,6) NOT NULL,
  ga_amount NUMERIC(12,6) NOT NULL,
  cost_before_profit NUMERIC(12,6) NOT NULL,

  profit_rate NUMERIC(5,4) NOT NULL,
  profit_source profit_source_type NOT NULL,
  profit_amount NUMERIC(12,6) NOT NULL,
  fully_burdened NUMERIC(12,2) NOT NULL,

  -- Escalation (when applicable)
  escalation_applied NUMERIC(6,4),
  gsa_year INTEGER,

  -- Extended cost (hours × fully_burdened)
  extended_cost NUMERIC(15,2) NOT NULL,

  -- Timestamps (no updated_at — immutable)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Immutability: lines are write-once per scenario
CREATE OR REPLACE FUNCTION prevent_pricing_line_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pricing_lines are immutable; corrections require a new scenario';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_lines_immutable
  BEFORE UPDATE ON pricing_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_pricing_line_update();
```

### 1.3 `rate_config_snapshot` JSONB Schema

```typescript
interface RateConfigSnapshot {
  // Indirect rates (decimal form)
  fringe: number       // e.g., 0.2116
  overhead: number     // e.g., 0.3426
  ga: number           // e.g., 0.1983

  // Profit
  defaultProfitRate: number  // Contract-level default

  // Escalation
  escalationRate: number     // e.g., 0.03 (3%)

  // Metadata
  snapshotAt: string         // ISO timestamp
  sourceSettingsRowVersion: number  // company_settings.row_version at snapshot time
}
```

---

## 2. Requirements Normalization

### 2.1 Existing `requirements` Table (Baseline)

The table already exists with: id, proposal_id, reference_number, title, description, type, category, source, priority, linked_wbs_id, linked_wbs_ids, created_at, updated_at.

### 2.2 Schema Enhancements

```sql
-- Add tenant_id and intelligence_version_id
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS intelligence_version_id UUID REFERENCES intelligence_versions(id),
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES solicitation_documents(id),
  ADD COLUMN IF NOT EXISTS source_section TEXT,
  ADD COLUMN IF NOT EXISTS compliance_strength TEXT CHECK (compliance_strength IN ('shall', 'should', 'may', 'info')),
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

-- Backfill tenant_id from proposals
UPDATE requirements r
SET tenant_id = (
  SELECT p.company_id FROM proposals p WHERE p.id = r.proposal_id
);

ALTER TABLE requirements ALTER COLUMN tenant_id SET NOT NULL;

-- Index for coverage queries
CREATE INDEX idx_requirements_intelligence ON requirements(intelligence_version_id);
```

### 2.3 `requirement_links` Table

```sql
CREATE TYPE link_source_type AS ENUM ('ai', 'user');

CREATE TABLE requirement_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  wbs_task_id UUID NOT NULL REFERENCES wbs_tasks(id) ON DELETE CASCADE,

  link_source link_source_type NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique pair
  CONSTRAINT unique_requirement_task_link UNIQUE (requirement_id, wbs_task_id)
);

CREATE INDEX idx_requirement_links_req ON requirement_links(requirement_id);
CREATE INDEX idx_requirement_links_task ON requirement_links(wbs_task_id);
```

### 2.4 Coverage Projection Query

```sql
-- Count unlinked requirements for active intelligence version
SELECT COUNT(*) AS unlinked_count
FROM requirements r
WHERE r.intelligence_version_id = (
  SELECT active_intelligence_version_id FROM proposals WHERE id = $1
)
AND NOT EXISTS (
  SELECT 1 FROM requirement_links rl
  JOIN wbs_tasks wt ON rl.wbs_task_id = wt.id
  JOIN wbs_versions wv ON wt.wbs_version_id = wv.id
  WHERE rl.requirement_id = r.id
  AND wv.status = 'active'
  AND wv.proposal_id = $1
);
```

---

## 3. working_data Writers → ZERO

### 3.1 Per-Key Disposition Table (§3 Remaining Residents)

| Key | Current Writer(s) | Disposition | New Home |
|-----|-------------------|-------------|----------|
| `roles[]` (pricing fields) | `use-proposal-sync.ts`, `proposals/[id]/route.ts` | **REMOVE** | Already migrated to `staffing_assignments` + `tenant_labor_categories`. Read-only fallback remains for legacy data. |
| `selectedRoles` | `use-proposal-sync.ts` | **REMOVE** | Alias for roles[]. Same disposition. |
| `solicitation` | `use-proposal-sync.ts` | **KEEP (read-only)** | Already on proposals table columns (title, solicitation_number, client, agency, contract_type, due_date). Metadata-only read path. |
| `solicitationRawText` | `extract-rfp/route.ts` (legacy) | **REMOVE** | `solicitation_documents.raw_text` (already exists per Phase 4B) |
| `summary` | Client-side only (no server write) | **REMOVE** | `proposals.ai_summary` JSONB (already exists) |
| `winThemes` | Client-side only | **REMOVE** | `proposals.ai_summary.winThemes` |
| `outline` | `use-proposal-sync.ts` | **MOVE** | `proposals.ai_summary.outline` |
| `requirements` | Legacy (superseded Phase 2) | **REMOVE** | `requirements` table (already exists) |
| `subcontractors` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.subcontractors` |
| `teamingPartners` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.teamingPartners` |
| `teamMembers` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.teamMembers` |
| `directors` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.directors` |
| `rateJustifications` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.rateJustifications` |
| `odcs` | `use-proposal-sync.ts` | **MOVE** | New `proposal_odcs` table |
| `perDiem` | `use-proposal-sync.ts` | **MOVE** | New `proposal_per_diem` table |
| `extractedRequirements` | `use-proposal-sync.ts` | **REMOVE** | Superseded by `requirements` table |
| `proposalSetup` | `use-proposal-sync.ts` | **MOVE** | `proposal_metadata.setup` |
| `gsaEnabled` | `use-proposal-sync.ts` | **DERIVE** | From `proposals.contract_type = 'gsa'` |
| `sectionContent` | `use-proposal-sync.ts` | **KEEP (separate)** | Already in `proposal_sections` table |
| `lastSaved` | `use-proposal-sync.ts` | **REMOVE** | Use `proposals.updated_at` |

### 3.2 `proposal_metadata` JSONB Column Schema

Add a typed JSONB column to proposals instead of multiple small tables for team composition data:

```sql
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS proposal_metadata JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN proposals.proposal_metadata IS
'Typed JSONB for team composition and setup. Schema:
{
  "subcontractors": [{ "name": string, "type": string, "rate": number }],
  "teamingPartners": [{ "name": string, "role": string }],
  "teamMembers": [{ "name": string, "role": string, "email": string }],
  "directors": [{ "name": string, "email": string, "token": string }],
  "rateJustifications": { [roleId]: { "text": string, "source": string } },
  "setup": {
    "contractType": "tm" | "ffp" | "cpff",
    "optionYears": number,
    "setAside": string,
    "billableHoursPerYear": number,
    "escalationRate": number,
    "profitMargin": number,
    "proposalDueDate": string | null
  }
}';
```

### 3.3 Charge Codes Table

```sql
CREATE TABLE proposal_charge_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  wbs_task_id UUID REFERENCES wbs_tasks(id) ON DELETE SET NULL,

  code TEXT NOT NULL,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_charge_code_per_proposal UNIQUE (proposal_id, code)
);
```

### 3.4 Allowlist Enforcement

After migration, update `scripts/working-data-allowlist.txt` to:

```
# Phase 6A: working_data has ZERO writers
# This file is EMPTY - CI enforces no writes to working_data
```

Add CI check:

```yaml
# .github/workflows/ci.yml addition
- name: Verify working_data allowlist empty
  run: |
    if grep -v '^#' scripts/working-data-allowlist.txt | grep -v '^$' | grep .; then
      echo "ERROR: working-data-allowlist.txt must be empty (comments only)"
      exit 1
    fi
```

---

## 4. Commands

### 4.1 Pricing Commands

**`ComputePricingScenario`**
- Input: proposal_id, label (optional, defaults to 'Primary')
- Process:
  1. Load active WBS version for proposal
  2. Load all staffing_assignments for that WBS
  3. Load current tenant rate config from company_settings
  4. Snapshot rate config
  5. For each assignment × period: resolve salary (catalog or override), compute full trace via engine
  6. Write scenario + all lines in single transaction
- Output: { scenarioId, totalCost, lineCount }
- Conservation gate: computed totals must match legacy Roles & Pricing panel to the penny

**`ApprovePricingScenario`**
- Input: scenario_id, expected_version
- Process:
  1. Validate scenario status = 'draft'
  2. Supersede any existing approved scenario for this proposal
  3. Set status = 'approved'
- Output: { approved: true, supersededId: uuid | null }

**`SupersedePricingScenario`**
- Input: scenario_id, expected_version
- Process: Set status = 'superseded'
- Output: { superseded: true }

### 4.2 Requirements Commands

**`BackfillRequirements`** (one-time migration command)
- Input: proposal_id
- Process:
  1. Read working_data.requirements array
  2. Get active intelligence_version_id
  3. Insert into requirements table with intelligence_version_id
  4. Parse tag-strings to create requirement_links
  5. Report unresolvable tags
- Output: { created: N, linked: M, unresolvable: [...] }

---

## 5. Migration Sequence

### Migration 056: pricing_scenarios

```sql
-- 056_pricing_scenarios.sql
CREATE TYPE pricing_scenario_status AS ENUM ('draft', 'approved', 'superseded');
CREATE TABLE pricing_scenarios ( ... );
CREATE TABLE pricing_lines ( ... );
-- Triggers for immutability and WBS status check
```

### Migration 057: requirements_normalization

```sql
-- 057_requirements_normalization.sql
ALTER TABLE requirements ADD COLUMN tenant_id ...;
ALTER TABLE requirements ADD COLUMN intelligence_version_id ...;
CREATE TABLE requirement_links ( ... );
-- Backfill tenant_id from proposals
```

### Migration 058: proposal_metadata

```sql
-- 058_proposal_metadata.sql
ALTER TABLE proposals ADD COLUMN proposal_metadata JSONB DEFAULT '{}'::JSONB;
CREATE TABLE proposal_charge_codes ( ... );
```

### Migration 059: backfill_requirements

```sql
-- 059_backfill_requirements.sql
-- PL/pgSQL function to migrate working_data.requirements to requirements table
-- Report counts at end
```

### Migration 060: backfill_proposal_metadata

```sql
-- 060_backfill_proposal_metadata.sql
-- Migrate subcontractors, teamingPartners, teamMembers, directors,
-- rateJustifications, proposalSetup from working_data to proposal_metadata
```

---

## 6. API Routes

### 6.1 Pricing Endpoints

**POST `/api/proposals/[id]/pricing/compute`**
- Calls ComputePricingScenario command
- Returns scenario summary with totals

**POST `/api/proposals/[id]/pricing/[scenarioId]/approve`**
- Calls ApprovePricingScenario command

**GET `/api/proposals/[id]/pricing`**
- Returns all scenarios for proposal with rollup totals

**GET `/api/proposals/[id]/pricing/[scenarioId]/lines`**
- Returns all lines for scenario with full trace

### 6.2 Requirements Coverage Endpoint

**GET `/api/proposals/[id]/requirements/coverage`**
- Returns { total, linked, unlinked, coverage_pct }

---

## 7. Tests

### 7.1 Unit Tests

```typescript
// __tests__/lib/commands/pricing.test.ts

describe('ComputePricingScenario', () => {
  test('line trace recomputes to stored fully_burdened', async () => {
    // Verify internal consistency: stored trace matches engine output
  })

  test('scenario references only active/superseded WBS', async () => {
    // Verify trigger rejects candidate WBS
  })

  test('one approved scenario per proposal constraint', async () => {
    // Verify partial unique index
  })
})

describe('pricing_lines immutability', () => {
  test('UPDATE on pricing_lines fails', async () => {
    // Direct SQL update should throw
  })
})
```

### 7.2 Conservation Gate Test

```typescript
// __tests__/lib/commands/pricing-conservation.test.ts

describe('Conservation Gate', () => {
  test('scenario totals match legacy Roles & Pricing panel (PM-HCD)', async () => {
    // Load both proposals, compute scenarios, compare to legacy projection
  })

  test('scenario totals match legacy Roles & Pricing panel (CAMP)', async () => {
    // Same for second proposal
  })
})
```

### 7.3 Requirements Coverage Test

```typescript
// __tests__/lib/requirements/coverage.test.ts

describe('Requirements Coverage', () => {
  test('fixture: 3 reqs, 2 linked → count 1 unlinked', async () => {
    // Verify coverage query correctness
  })
})
```

### 7.4 Eval Run

No AI surface touched in Phase 6A. Eval must show:
- Extraction F1: unchanged from Phase 5 baseline
- Discipline violations: 0
- Any score movement is a red flag requiring investigation

---

## 8. Sequencing

| Step | Deliverable | Gate |
|------|-------------|------|
| 1 | This plan approved | User approval |
| 2 | Migrations + commands + tests (local) | All tests pass |
| 3 | Backfill rehearsal (prod-shaped data) | Counts match, conservation proven |
| 4 | Staging deploy + E2E | Penny match verified, CI enforcement passes |
| 5 | **User GO** | Explicit approval |
| 6 | Production deploy | Attestation run cited |
| 7 | Backfill + first scenarios | Conservation report |
| 8 | Completion report | Allowlist EMPTY, field map final |

---

## 9. Definition of Done (Checklist)

- [ ] `pricing_scenarios` + `pricing_lines` tables deployed
- [ ] Lines carry full calculation trace (all 10 intermediate fields)
- [ ] Approved scenarios immutable; lines immutable
- [ ] Conservation gate passes on both proposals (to the penny)
- [ ] `requirements` table has tenant_id, intelligence_version_id
- [ ] `requirement_links` table created; coverage query works
- [ ] `proposal_metadata` JSONB column added
- [ ] `proposal_charge_codes` table created
- [ ] working_data allowlist is EMPTY
- [ ] CI enforces no writes to working_data
- [ ] Eval scores unchanged (regression run shows no movement)
- [ ] API-CONTRACT.md updated with pricing endpoints
- [ ] Field map in state-inventory.md marked FINAL

---

## Appendix A: Files to Modify

### Phase 6A File Changes

| File | Change |
|------|--------|
| `supabase/migrations/056_pricing_scenarios.sql` | NEW |
| `supabase/migrations/057_requirements_normalization.sql` | NEW |
| `supabase/migrations/058_proposal_metadata.sql` | NEW |
| `supabase/migrations/059_backfill_requirements.sql` | NEW |
| `supabase/migrations/060_backfill_proposal_metadata.sql` | NEW |
| `lib/commands/pricing/` | NEW directory with commands |
| `app/api/proposals/[id]/pricing/` | NEW endpoint routes |
| `app/api/proposals/[id]/requirements/coverage/route.ts` | NEW |
| `hooks/use-proposal-sync.ts` | REMOVE all working_data writes |
| `app/api/proposals/[id]/route.ts` | REMOVE working_data writes |
| `app/api/extract-rfp/route.ts` | REMOVE (superseded by Phase 4B flow) |
| `app/api/proposals/route.ts` | REMOVE working_data writes |
| `scripts/working-data-allowlist.txt` | EMPTY (comments only) |
| `.github/workflows/ci.yml` | ADD allowlist enforcement |
| `docs/API-CONTRACT.md` | ADD pricing endpoints |
| `docs/review-packet/state-inventory.md` | UPDATE final field map |

---

## Appendix B: Known Limitations Update

Add to CLAUDE.md Known Limitations:

```markdown
- **Compliance matrix generation** — Frozen pending Phase D writing module.
  Requirements coverage (via `requirements` table + `requirement_links`)
  is the active-path replacement for compliance tracking.
```
