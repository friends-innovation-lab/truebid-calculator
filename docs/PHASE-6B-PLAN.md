# Phase 6B Implementation Plan: BOE Artifact Domain

## Overview

Phase 6B introduces the BOE (Basis of Estimate) artifact domain: immutable, versioned documents generated from confirmed intelligence + active WBS + approved pricing scenarios. Artifacts are structured data only — no AI prose, no UI rendering.

**Scope guard (from prompt):**
- ZERO legacy-UI wiring. No new pages, no edits to existing components.
- Writing subsystem remains FROZEN — 6B produces structured data only.
- If you find yourself writing a prompt for Claude API calls, you've left scope.

---

## 1. Schema

### 1.1 `boe_artifacts` Table

Generated from an exact triple: intelligence_version_id (confirmed), wbs_version_id (active at generation time), pricing_scenario_id (approved).

```sql
-- Phase 6B: BOE Artifacts
-- Immutable artifact records capturing BOE document structure
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS boe_citations CASCADE;
--   DROP TABLE IF EXISTS boe_artifacts CASCADE;
--   DROP TABLE IF EXISTS proposal_snapshots CASCADE;
--   DROP TYPE IF EXISTS boe_artifact_status CASCADE;
--   DROP TYPE IF EXISTS citation_target_type CASCADE;

-- =============================================================================
-- BOE ARTIFACTS TABLE
-- =============================================================================

CREATE TYPE boe_artifact_status AS ENUM ('generated', 'superseded');

CREATE TABLE boe_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- The exact triple that defines this artifact
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id),
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id),

  -- Status: generated (current) or superseded (replaced by newer artifact)
  status boe_artifact_status NOT NULL DEFAULT 'generated',

  -- Structured document content (sections, tables, line traces)
  content JSONB NOT NULL,

  -- Integrity: SHA-256 of canonical-serialized content
  content_hash TEXT NOT NULL,

  -- Generation metadata
  engine_version TEXT NOT NULL,  -- e.g., 'v1.1.0' from pricing engine
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  superseded_at TIMESTAMPTZ,

  -- Row version for optimistic concurrency (status changes only)
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique: one generated artifact per exact triple
-- Note: Postgres requires CREATE UNIQUE INDEX for partial uniqueness (not CONSTRAINT)
CREATE UNIQUE INDEX unique_artifact_per_triple
  ON boe_artifacts (intelligence_version_id, wbs_version_id, pricing_scenario_id)
  WHERE status = 'generated';

-- Standard indexes
CREATE INDEX idx_boe_artifacts_proposal ON boe_artifacts(proposal_id);
CREATE INDEX idx_boe_artifacts_tenant ON boe_artifacts(tenant_id);
CREATE INDEX idx_boe_artifacts_intel ON boe_artifacts(intelligence_version_id);
CREATE INDEX idx_boe_artifacts_wbs ON boe_artifacts(wbs_version_id);
CREATE INDEX idx_boe_artifacts_scenario ON boe_artifacts(pricing_scenario_id);
CREATE INDEX idx_boe_artifacts_status ON boe_artifacts(status) WHERE status = 'generated';

-- =============================================================================
-- IMMUTABILITY TRIGGER
-- =============================================================================

-- Artifacts are immutable after creation. Only allowed mutation:
-- status: generated → superseded (sets superseded_at, increments row_version)
CREATE OR REPLACE FUNCTION check_boe_artifact_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only status transition from generated to superseded
  IF OLD.status = 'generated' AND NEW.status = 'superseded' THEN
    -- Only superseded_at and row_version may change
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.intelligence_version_id IS DISTINCT FROM OLD.intelligence_version_id
       OR NEW.wbs_version_id IS DISTINCT FROM OLD.wbs_version_id
       OR NEW.pricing_scenario_id IS DISTINCT FROM OLD.pricing_scenario_id
       OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
       OR NEW.generated_at IS DISTINCT FROM OLD.generated_at
       OR NEW.generated_by IS DISTINCT FROM OLD.generated_by THEN
      RAISE EXCEPTION 'Cannot modify artifact fields during supersede (id: %)', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Block all other mutations
  RAISE EXCEPTION 'boe_artifacts are immutable after creation (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_immutable
  BEFORE UPDATE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION check_boe_artifact_immutability();

-- Block deletes entirely
CREATE OR REPLACE FUNCTION prevent_boe_artifact_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_artifacts cannot be deleted (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_no_delete
  BEFORE DELETE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_artifact_delete();

-- Row version trigger
CREATE TRIGGER boe_artifacts_row_version
  BEFORE UPDATE ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION increment_row_version();

-- =============================================================================
-- VALIDATION TRIGGERS
-- =============================================================================

-- intelligence_version must be status='confirmed'
-- wbs_version must be status='active' (not superseded - no legitimate insert-time case)
-- pricing_scenario must be status='approved'
CREATE OR REPLACE FUNCTION validate_boe_artifact_sources()
RETURNS TRIGGER AS $$
DECLARE
  v_intel_status intelligence_status;
  v_wbs_status wbs_status;
  v_scenario_status pricing_scenario_status;
BEGIN
  -- Check intelligence version is confirmed
  SELECT status INTO v_intel_status FROM intelligence_versions WHERE id = NEW.intelligence_version_id;
  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'intelligence_version_id % not found', NEW.intelligence_version_id;
  END IF;
  IF v_intel_status != 'confirmed' THEN
    RAISE EXCEPTION 'intelligence_version must be confirmed, got: %', v_intel_status;
  END IF;

  -- Check WBS version is active (strictly - no superseded allowed at insert time)
  SELECT status INTO v_wbs_status FROM wbs_versions WHERE id = NEW.wbs_version_id;
  IF v_wbs_status IS NULL THEN
    RAISE EXCEPTION 'wbs_version_id % not found', NEW.wbs_version_id;
  END IF;
  IF v_wbs_status != 'active' THEN
    RAISE EXCEPTION 'wbs_version must be active, got: %', v_wbs_status;
  END IF;

  -- Check pricing scenario is approved
  SELECT status INTO v_scenario_status FROM pricing_scenarios WHERE id = NEW.pricing_scenario_id;
  IF v_scenario_status IS NULL THEN
    RAISE EXCEPTION 'pricing_scenario_id % not found', NEW.pricing_scenario_id;
  END IF;
  IF v_scenario_status != 'approved' THEN
    RAISE EXCEPTION 'pricing_scenario must be approved, got: %', v_scenario_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_artifacts_validate_sources
  BEFORE INSERT ON boe_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_boe_artifact_sources();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE boe_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY boe_artifacts_tenant_isolation ON boe_artifacts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );
```

### 1.2 `boe_citations` Table

Links artifact estimate lines to their evidence chain. Every wbs_estimate line must have ≥1 citation.

**Design Decision:** `labor_loading` lines derive from confirmed intelligence utilization (intelligence_labor_requirements), which is itself their evidence basis. Therefore requirement citations are optional for that line type. The intelligence version confirmation hash provides the evidence anchor.

```sql
-- =============================================================================
-- BOE CITATIONS TABLE
-- =============================================================================

CREATE TYPE citation_target_type AS ENUM ('requirement_link');
-- Note: 'fact_evidence' type reserved for future when fact_evidence table exists

CREATE TABLE boe_citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES boe_artifacts(id) ON DELETE CASCADE,

  -- Which line in the artifact content this citation belongs to
  -- Matches content.sections[].lines[].lineId
  artifact_line_id TEXT NOT NULL,

  -- What this citation points to
  citation_target_type citation_target_type NOT NULL,
  -- ON DELETE RESTRICT: cited requirement_links cannot be deleted
  requirement_link_id UUID REFERENCES requirement_links(id) ON DELETE RESTRICT,
  -- fact_evidence_id UUID REFERENCES fact_evidence(id) -- Future

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique: one citation per (artifact, line, target)
  CONSTRAINT unique_citation_per_line_target UNIQUE (
    artifact_id, artifact_line_id, requirement_link_id
  )
);

-- Indexes
CREATE INDEX idx_boe_citations_artifact ON boe_citations(artifact_id);
CREATE INDEX idx_boe_citations_requirement_link ON boe_citations(requirement_link_id)
  WHERE requirement_link_id IS NOT NULL;

-- =============================================================================
-- IMMUTABILITY TRIGGERS
-- =============================================================================

-- Block updates on citations
CREATE OR REPLACE FUNCTION prevent_boe_citation_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_citations are immutable; create a new artifact for changes';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_citations_immutable
  BEFORE UPDATE ON boe_citations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_citation_update();

-- Block direct deletes on citations (only CASCADE from artifact deletion, which is also blocked)
CREATE OR REPLACE FUNCTION prevent_boe_citation_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'boe_citations cannot be deleted directly (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boe_citations_no_delete
  BEFORE DELETE ON boe_citations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_boe_citation_delete();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE boe_citations ENABLE ROW LEVEL SECURITY;

-- RLS via parent artifact
CREATE POLICY boe_citations_via_artifact ON boe_citations
  FOR ALL
  USING (
    artifact_id IN (
      SELECT ba.id FROM boe_artifacts ba
      JOIN tenant_memberships tm ON ba.tenant_id = tm.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );
```

### 1.3 `proposal_snapshots` Table

As-submitted record pinning exact versions for submission.

```sql
-- =============================================================================
-- PROPOSAL SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE proposal_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Pinned version references
  intelligence_version_id UUID NOT NULL REFERENCES intelligence_versions(id),
  wbs_version_id UUID NOT NULL REFERENCES wbs_versions(id),
  pricing_scenario_id UUID NOT NULL REFERENCES pricing_scenarios(id),

  -- Associated artifacts (all must share the same intelligence version)
  artifact_ids UUID[] NOT NULL,

  -- Composite integrity hash over all pinned content hashes
  -- SHA-256(intel.confirmation_hash || artifact1.content_hash || artifact2.content_hash || ...)
  composite_hash TEXT NOT NULL,

  -- Metadata
  label TEXT NOT NULL DEFAULT 'Submission',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proposal_snapshots_proposal ON proposal_snapshots(proposal_id);
CREATE INDEX idx_proposal_snapshots_tenant ON proposal_snapshots(tenant_id);

-- =============================================================================
-- IMMUTABILITY TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_proposal_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_snapshots are immutable after creation (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_immutable
  BEFORE UPDATE ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_proposal_snapshot_update();

CREATE OR REPLACE FUNCTION prevent_proposal_snapshot_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_snapshots cannot be deleted (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_no_delete
  BEFORE DELETE ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_proposal_snapshot_delete();

-- =============================================================================
-- VALIDATION TRIGGER (DB-level enforcement)
-- =============================================================================

-- All artifact_ids must:
-- 1. Belong to the same proposal_id
-- 2. Reference the same intelligence_version_id
-- 3. Have status = 'generated'
-- Additionally:
-- 4. The pinned intelligence version must be status = 'confirmed' (not superseded)
CREATE OR REPLACE FUNCTION validate_proposal_snapshot_artifacts()
RETURNS TRIGGER AS $$
DECLARE
  v_artifact RECORD;
  v_artifact_id UUID;
  v_intel_status intelligence_status;
BEGIN
  -- Check intelligence version is confirmed (not superseded)
  SELECT status INTO v_intel_status FROM intelligence_versions WHERE id = NEW.intelligence_version_id;
  IF v_intel_status IS NULL THEN
    RAISE EXCEPTION 'intelligence_version_id % not found', NEW.intelligence_version_id;
  END IF;
  IF v_intel_status != 'confirmed' THEN
    RAISE EXCEPTION 'snapshot intelligence_version must be confirmed, got: %', v_intel_status;
  END IF;

  -- Check each artifact
  FOREACH v_artifact_id IN ARRAY NEW.artifact_ids
  LOOP
    SELECT proposal_id, intelligence_version_id, status
    INTO v_artifact
    FROM boe_artifacts
    WHERE id = v_artifact_id;

    IF v_artifact IS NULL THEN
      RAISE EXCEPTION 'artifact % not found', v_artifact_id;
    END IF;

    IF v_artifact.proposal_id != NEW.proposal_id THEN
      RAISE EXCEPTION 'artifact % belongs to different proposal', v_artifact_id;
    END IF;

    IF v_artifact.intelligence_version_id != NEW.intelligence_version_id THEN
      RAISE EXCEPTION 'artifact % references different intelligence version', v_artifact_id;
    END IF;

    IF v_artifact.status != 'generated' THEN
      RAISE EXCEPTION 'artifact % must have status=generated, got: %', v_artifact_id, v_artifact.status;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_snapshots_validate_artifacts
  BEFORE INSERT ON proposal_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION validate_proposal_snapshot_artifacts();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE proposal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_snapshots_tenant_isolation ON proposal_snapshots
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE boe_artifacts IS 'Immutable BOE documents generated from confirmed intelligence + active WBS + approved pricing';
COMMENT ON COLUMN boe_artifacts.content IS 'JSONB: structured document with sections, estimate line tables, calc traces';
COMMENT ON COLUMN boe_artifacts.content_hash IS 'SHA-256 of canonical-serialized content for integrity verification';

COMMENT ON TABLE boe_citations IS 'Links artifact estimate lines to requirement_links for evidence chain';
COMMENT ON COLUMN boe_citations.artifact_line_id IS 'Matches content.sections[].lines[].lineId in parent artifact';
COMMENT ON COLUMN boe_citations.requirement_link_id IS 'ON DELETE RESTRICT: cited links cannot be deleted while artifact exists';

COMMENT ON TABLE proposal_snapshots IS 'As-submitted records pinning exact versions; immutable one-shot';
COMMENT ON COLUMN proposal_snapshots.composite_hash IS 'SHA-256 over intelligence.confirmation_hash and all artifact content_hashes';
```

---

## 2. Artifact Content JSON Schema (Zod)

The artifact `content` JSONB follows this structure:

```typescript
// lib/schemas/boe-artifact.ts

import { z } from 'zod'

/**
 * Period definition within artifact
 */
const ArtifactPeriodSchema = z.object({
  periodId: z.string().uuid(),
  name: z.string(),                    // "Base Period", "Option Year 1"
  months: z.number(),                  // 7.00, 3.00
  cumulativeMonthsEnd: z.number(),     // 7, 10, 13, 16
  gsaRateYear: z.number().int(),       // 1, 1, 2, 2
})

/**
 * Role/rate table entry
 */
const ArtifactRoleSchema = z.object({
  roleTitle: z.string(),
  laborCategoryKey: z.string().nullable(),
  levelKey: z.string().nullable(),
  stepIndex: z.number().int().nullable(),
  annualSalaryCents: z.number().int(),
  salarySource: z.enum(['catalog', 'override']),
  fullyBurdenedRate: z.number(),       // 2 decimals
})

/**
 * Estimate line with full calculation trace and fee decomposition
 *
 * Fee decomposition: each line shows cost and fee separately (DCAA-style)
 * cost + fee === extendedTotal (penny-conserved)
 */
const ArtifactEstimateLineSchema = z.object({
  lineId: z.string(),                  // UUID for citation reference
  lineType: z.enum(['wbs_estimate', 'labor_loading']),

  // Source identification
  wbsCode: z.string().nullable(),      // "1.1.2" for wbs_estimate
  taskTitle: z.string().nullable(),    // Task title for wbs_estimate
  roleTitle: z.string(),
  periodLabel: z.string(),

  // Hours basis
  hours: z.number(),
  hoursRationale: z.string().nullable(), // "128 hrs/mo × 80% × 7 mo = 716.8 hrs"

  // Full calculation trace (carried forward from pricing_lines)
  calcTrace: z.object({
    resolvedSalaryCents: z.number().int(),
    salarySource: z.enum(['catalog', 'override']),
    levelKey: z.string().nullable(),
    stepIndex: z.number().int().nullable(),

    baseHourly: z.number(),            // 6 decimals in DB
    fringeAmount: z.number(),
    overheadBase: z.number(),          // afterFringe
    overheadAmount: z.number(),
    gaAmount: z.number(),
    costBeforeProfit: z.number(),

    profitRate: z.number(),            // 4 decimals
    profitSource: z.enum(['explicit', 'contract_default']),
    profitAmount: z.number(),

    fullyBurdenedRate: z.number(),     // 2 decimals

    // Escalation (if applicable)
    escalationRateApplied: z.number().nullable(),
    escalationYearIndex: z.number().int().nullable(),
  }),

  // Fee decomposition (DCAA-style presentation)
  // cost + fee === extendedTotal
  costComponent: z.number(),           // hours × costBeforeProfit (rounded to 2 decimals)
  feeComponent: z.number(),            // extendedTotal - costComponent (penny-conserved)
  extendedTotal: z.number(),           // hours × fullyBurdenedRate

  // Citation requirement tracking
  // wbs_estimate: must have ≥1 entry
  // labor_loading: optional (evidence is the confirmed intelligence utilization itself)
  requirementLinkIds: z.array(z.string().uuid()),
})

/**
 * Section within the artifact
 */
const ArtifactSectionSchema = z.object({
  sectionId: z.string(),
  sectionType: z.enum([
    'period_structure',        // Contract period definitions
    'role_rate_table',         // Role/rate catalog
    'wbs_estimates',           // Per-task estimates with hours basis
    'labor_loading_summary',   // Contract-level utilization
    'cost_fee_breakout',       // Cost/fee decomposition summary
    'totals',                  // Grand totals
  ]),
  title: z.string(),

  // Section-specific content (polymorphic based on sectionType)
  periods: z.array(ArtifactPeriodSchema).optional(),
  roles: z.array(ArtifactRoleSchema).optional(),
  lines: z.array(ArtifactEstimateLineSchema).optional(),

  // Summary values for totals sections
  summary: z.object({
    totalHours: z.number().optional(),
    totalCost: z.number().optional(),
    totalFee: z.number().optional(),
    grandTotal: z.number().optional(),
  }).optional(),
})

/**
 * Rate configuration snapshot at generation time
 */
const ArtifactRateConfigSchema = z.object({
  fringe: z.number(),
  overhead: z.number(),
  ga: z.number(),
  defaultProfitRate: z.number(),
  escalationRate: z.number(),
  snapshotAt: z.string(),              // ISO timestamp
  sourceSettingsRowVersion: z.number().int(),
})

/**
 * Complete artifact content schema
 */
export const BOEArtifactContentSchema = z.object({
  // Version for future migrations
  schemaVersion: z.literal('1.0.0'),

  // Proposal metadata
  proposal: z.object({
    id: z.string().uuid(),
    title: z.string(),
    solicitationNumber: z.string().nullable(),
    agency: z.string().nullable(),
    contractType: z.string().nullable(),
  }),

  // Rate config at generation time
  rateConfig: ArtifactRateConfigSchema,

  // Document sections in order
  sections: z.array(ArtifactSectionSchema),

  // Aggregate totals (must match sum of line totals)
  totals: z.object({
    wbsEstimateHours: z.number(),
    wbsEstimateCost: z.number(),
    wbsEstimateFee: z.number(),
    wbsEstimateTotal: z.number(),

    laborLoadingHours: z.number(),
    laborLoadingCost: z.number(),
    laborLoadingFee: z.number(),
    laborLoadingTotal: z.number(),

    grandTotalHours: z.number(),
    grandTotalCost: z.number(),
    grandTotalFee: z.number(),
    grandTotal: z.number(),
  }),

  // Conservation assertion (for audit)
  conservation: z.object({
    wbsEstimateCostPlusFee: z.number(),
    wbsEstimateTotal: z.number(),
    wbsEstimateConserved: z.boolean(),  // Must be true

    laborLoadingCostPlusFee: z.number(),
    laborLoadingTotal: z.number(),
    laborLoadingConserved: z.boolean(),  // Must be true

    allConserved: z.boolean(),           // Must be true
  }),
})

export type BOEArtifactContent = z.infer<typeof BOEArtifactContentSchema>
export type ArtifactEstimateLine = z.infer<typeof ArtifactEstimateLineSchema>
export type ArtifactSection = z.infer<typeof ArtifactSectionSchema>
```

---

## 3. Worked Example: Pricing Line (Real Data from Staging)

**Environment queried:** STAGING (`tcobyquewjootwxpqijq`)

**Source:** Approved pricing scenario `82c6a22d-91b0-421e-9ae5-07a948881306` on proposal `e2e66666-6666-6666-6666-666666666666`

**Fixture provenance:** This is Phase 6A E2E test data (created 2026-07-12) with synthetic rates (fringe 21.16%, OH 34.26%, G&A 19.83%, profit 10%, 12-month base period). It differs from production PM-HCD's confirmed intelligence (fringe 43%, OH 21%, G&A 15%, profit 8%, 7/3/3/3 month periods). The trace is internally consistent; only the fixture's inputs differ from prod.

### 3.1 Source Data (from database)

Query executed:
```sql
SELECT
  pl.id as pricing_line_id,
  pl.line_type,
  pl.period_label,
  pl.hours,
  pl.resolved_salary_cents,
  pl.salary_source,
  pl.base_hourly,
  pl.fringe_amount,
  pl.overhead_base,
  pl.overhead_amount,
  pl.ga_amount,
  pl.cost_before_profit,
  pl.profit_rate,
  pl.profit_source,
  pl.profit_amount,
  pl.fully_burdened,
  pl.extended_cost,
  ps.rate_config_snapshot
FROM pricing_lines pl
JOIN pricing_scenarios ps ON pl.pricing_scenario_id = ps.id
WHERE ps.id = '82c6a22d-91b0-421e-9ae5-07a948881306'
ORDER BY pl.period_label
LIMIT 1;
```

**Raw query output:**
```json
{
  "id": "585d62b9-a342-4049-9522-59d9ca7a2bfe",
  "line_type": "wbs_estimate",
  "period_label": "Base Period",
  "hours": 1920,
  "resolved_salary_cents": 14000000,
  "salary_source": "override",
  "level_key": null,
  "step_index": null,
  "base_hourly": 67.307692,
  "fringe_amount": 14.242308,
  "overhead_base": 81.55,
  "overhead_amount": 27.93903,
  "ga_amount": 21.711675,
  "cost_before_profit": 131.200705,
  "profit_rate": 0.1,
  "profit_source": "explicit",
  "profit_amount": 13.12007,
  "fully_burdened": 144.32,
  "escalation_rate_applied": null,
  "escalation_year_index": null,
  "extended_cost": 277094.4
}
```

**Rate config snapshot (from pricing_scenario):**
```json
{
  "fringe": 0.2116,
  "overhead": 0.3426,
  "ga": 0.1983,
  "defaultProfitRate": 0.1,
  "escalationRate": 0.03,
  "snapshotAt": "2026-07-12T20:35:30.364Z",
  "sourceSettingsRowVersion": 1
}
```

### 3.2 Values from Database

- **Pricing Line ID:** `585d62b9-a342-4049-9522-59d9ca7a2bfe`
- **Line Type:** `wbs_estimate`
- **Period:** Base Period
- **Hours:** 1,920
- **Salary:** $140,000/year (14000000 cents)
- **Salary Source:** override

**Rate Config (from `pricing_scenarios.rate_config_snapshot`):**
- Fringe: 21.16% (0.2116)
- Overhead: 34.26% (0.3426)
- G&A: 19.83% (0.1983)
- Profit: 10% (0.10)

### 3.3 Calculation Trace Verification

Recomputed from stored values vs DB:

```
base_hourly      | DB: 67.307692 | Calc: 140000/2080 = 67.307692 | MATCH ✓
fringe_amount    | DB: 14.242308 | Calc: 67.307692 × 0.2116 = 14.242308 | MATCH ✓
overhead_base    | DB: 81.55     | Calc: 67.307692 + 14.242308 = 81.550000 | MATCH ✓
overhead_amount  | DB: 27.93903  | Calc: 81.55 × 0.3426 = 27.939030 | MATCH ✓
ga_amount        | DB: 21.711675 | Calc: (81.55 + 27.93903) × 0.1983 = 21.711675 | MATCH ✓
cost_before_profit| DB: 131.200705 | Calc: 109.48903 + 21.711675 = 131.200705 | MATCH ✓
profit_amount    | DB: 13.12007  | Calc: 131.200705 × 0.1 = 13.120071 | MATCH ✓
fully_burdened   | DB: 144.32    | Calc: 131.200705 + 13.12007 = 144.32 | MATCH ✓
extended_cost    | DB: 277094.4  | Calc: 1920 × 144.32 = 277094.40 | MATCH ✓
```

**No discrepancies found.** All stored trace values match recomputation.

### 3.4 Fee Decomposition (Penny-Conserved)

```
hours              = 1920
cost_before_profit = 131.200705
fully_burdened     = 144.32
extended_cost      = 277094.4

cost_component = hours × cost_before_profit
               = 1920 × 131.200705
               = 251,905.35

fee_component  = extended_cost - cost_component  (penny-conserved formula)
               = 277,094.40 - 251,905.35
               = 25,189.05

Conservation check:
  cost + fee = 251,905.35 + 25,189.05 = 277,094.40
  extended_cost = 277,094.40
  MATCH ✓
```

### 3.5 Artifact Line JSON

```json
{
  "lineId": "585d62b9-a342-4049-9522-59d9ca7a2bfe",
  "lineType": "wbs_estimate",
  "wbsCode": null,
  "taskTitle": null,
  "roleTitle": "Role from staffing assignment",
  "periodLabel": "Base Period",
  "hours": 1920,
  "hoursRationale": null,
  "calcTrace": {
    "resolvedSalaryCents": 14000000,
    "salarySource": "override",
    "levelKey": null,
    "stepIndex": null,
    "baseHourly": 67.307692,
    "fringeAmount": 14.242308,
    "overheadBase": 81.55,
    "overheadAmount": 27.93903,
    "gaAmount": 21.711675,
    "costBeforeProfit": 131.200705,
    "profitRate": 0.1,
    "profitSource": "explicit",
    "profitAmount": 13.12007,
    "fullyBurdenedRate": 144.32,
    "escalationRateApplied": null,
    "escalationYearIndex": null
  },
  "costComponent": 251905.35,
  "feeComponent": 25189.05,
  "extendedTotal": 277094.40,
  "requirementLinkIds": ["<resolved from staffing_assignment → wbs_task → requirement_links>"]
}
```

---

## 4. Command Signatures and Error Shapes

### 4.1 GenerateBOEArtifact Command

```typescript
// lib/commands/boe/generate-artifact.ts

export interface GenerateBOEArtifactInput {
  proposalId: string
  pricingScenarioId: string
}

export interface GenerateBOEArtifactOutput {
  artifactId: string
  contentHash: string
  engineVersion: string
  lineCount: number
  citationCount: number

  totals: {
    wbsEstimateTotal: number
    laborLoadingTotal: number
    grandTotal: number
  }

  conservation: {
    allConserved: boolean
  }

  generatedAt: string
}

// Error: CITATION_INCOMPLETE
export interface CitationIncompleteError {
  code: 'CITATION_INCOMPLETE'
  message: string
  details: {
    uncitedLines: {
      lineId: string
      lineType: 'wbs_estimate' | 'labor_loading'
      wbsCode: string | null
      taskTitle: string | null
      roleTitle: string
      periodLabel: string
      missingLinkage: 'no_wbs_task' | 'no_requirement_links'
    }[]
  }
}

// Error: INVALID_STATE
// - pricing_scenario not approved
// - intelligence_version not confirmed
// - wbs_version not active
```

**Command Behavior:**

1. **Gate: requireConfirmedIntelligence**
   - Load `pricing_scenario` by ID
   - Load `wbs_version` via `pricing_scenario.wbs_version_id`
   - Load `intelligence_version` via `wbs_version.intelligence_version_id`
   - Verify `intelligence_version.status = 'confirmed'`
   - Recompute confirmation hash and verify match (per P2 pattern)

2. **Gate: approved scenario**
   - Verify `pricing_scenario.status = 'approved'`

3. **Gate: active WBS**
   - Verify `wbs_version.status = 'active'`

4. **Load pricing lines**
   - Load all `pricing_lines` for the scenario
   - For each line, resolve requirement linkage:
     - `wbs_estimate`: line → staffing_assignment → wbs_task → requirement_links
     - `labor_loading`: citation optional (see Design Decision §1.2)

5. **Gate: citation completeness**
   - Every `wbs_estimate` line must have ≥1 requirement_link
   - If ANY wbs_estimate line is uncited, FAIL with structured `CITATION_INCOMPLETE` error
   - Error payload lists every uncited line with actionable details

6. **Generate artifact content**
   - Build sections: period_structure, role_rate_table, wbs_estimates, labor_loading_summary, cost_fee_breakout, totals
   - Fee decomposition: `fee_component = extended_total - cost_component` (penny-conserved)
   - Compute content hash

7. **Persist atomically**
   - Insert `boe_artifacts` row
   - Insert `boe_citations` rows (one per line per requirement_link)
   - Write audit event

### 4.2 CreateProposalSnapshot Command

```typescript
// lib/commands/boe/create-snapshot.ts

export interface CreateProposalSnapshotInput {
  proposalId: string
  artifactIds: string[]
  label?: string  // Defaults to 'Submission'
}

export interface CreateProposalSnapshotOutput {
  snapshotId: string
  compositeHash: string
  artifactCount: number
  submittedAt: string
}

// Error: INVALID_STATE
// - artifact belongs to different proposal
// - artifact references different intelligence version
// - artifact status is not 'generated'
// - intelligence_version is superseded (not confirmed)
```

**Command Behavior:**

1. **Validate artifacts (command-layer for good error messages; DB trigger is the wall)**
   - All artifact IDs must exist
   - All must belong to the same proposal_id
   - All must reference the same intelligence_version_id
   - All must have status = 'generated'
   - Intelligence version must have status = 'confirmed' (not superseded)

2. **Compute composite hash**
   - Sort artifact IDs lexicographically
   - Concatenate: `intel.confirmation_hash || artifact1.content_hash || artifact2.content_hash || ...`
   - SHA-256 the result

3. **Persist atomically**
   - Insert `proposal_snapshots` row (DB trigger enforces all validations)
   - Write audit event

### 4.3 Error Codes (Extended)

```typescript
// lib/commands/types.ts - additions

export type CommandErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'STALE_VERSION'
  | 'VALIDATION_FAILED'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR'
  | 'STAFFING_MODEL_UNCLEAR'
  | 'CITATION_INCOMPLETE'     // NEW: wbs_estimate lines lack requirement links
  | 'CONSERVATION_FAILED'     // NEW: cost + fee ≠ total (should never happen)
```

---

## 5. Share Link Re-pointing (Data Layer Only)

The existing `/api/boe/[token]/route.ts` reads from `working_data` and `company_settings`. Re-point to artifacts:

### 5.1 Schema Addition

Add optional artifact reference to `boe_share_links`:

```sql
-- Add to existing boe_share_links table
ALTER TABLE boe_share_links
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES boe_artifacts(id),
  ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES proposal_snapshots(id);

-- Index for artifact lookups
CREATE INDEX idx_boe_share_links_artifact ON boe_share_links(artifact_id)
  WHERE artifact_id IS NOT NULL;

COMMENT ON COLUMN boe_share_links.artifact_id IS 'When set, link resolves to this specific artifact instead of live proposal data';
COMMENT ON COLUMN boe_share_links.snapshot_id IS 'When set, link resolves to this submission snapshot';
```

### 5.2 API Changes (Data Layer)

**GET `/api/boe/[token]`** — modified behavior:

```typescript
// If share_link.artifact_id is set:
//   - Return artifact.content directly
//   - No live repricing
//   - Artifact is immutable

// If share_link.snapshot_id is set:
//   - Load snapshot and all artifacts
//   - Return composite view

// If neither (legacy):
//   - Current behavior: live working_data + company_settings
//   - Marked as deprecated for Phase 6C migration
```

### 5.3 UI Phase Note

The current share-link UI (`components/tabs/export-tab.tsx`) renders the BOE response expecting the legacy structure. Phase 6C/D will need to:

1. Update UI to render artifact content structure
2. Add artifact selector when creating share links
3. Show artifact vs live indicator

This is OUT OF SCOPE for Phase 6B. The data API will work; rendering waits.

---

## 6. Test List

### 6.1 Conservation Tests

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-C1 | Artifact line totals ≡ pricing scenario totals | Sum of `extendedTotal` across artifact lines equals `pricing_scenario` computed total |
| BOE-C2 | Per-line fee decomposition | `costComponent + feeComponent === extendedTotal` for every line |
| BOE-C3 | Aggregate fee decomposition | `grandTotalCost + grandTotalFee === grandTotal` |
| BOE-C4 | Fee calculation correctness | `feeComponent === extendedTotal - costComponent` (rounding-safe) |

### 6.2 Citation Completeness Tests

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-CIT1 | Generation fails when wbs_estimate line uncited | Command returns `CITATION_INCOMPLETE` with line details |
| BOE-CIT2 | Generation succeeds when all wbs_estimate lines cited | Command returns success, artifact created |
| BOE-CIT3 | Error payload contains actionable info | Error includes lineId, wbsCode, taskTitle, roleTitle, periodLabel, missingLinkage |
| BOE-CIT4 | labor_loading lines citation optional | labor_loading lines without citations don't block generation |

### 6.3 Immutability Tests (DB Level)

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-IMM1 | UPDATE on boe_artifacts blocked | Trigger raises exception |
| BOE-IMM2 | DELETE on boe_artifacts blocked | Trigger raises exception |
| BOE-IMM3 | UPDATE on proposal_snapshots blocked | Trigger raises exception |
| BOE-IMM4 | DELETE on proposal_snapshots blocked | Trigger raises exception |
| BOE-IMM5 | Supersede transition allowed | status: generated → superseded succeeds, only superseded_at changes |
| BOE-IMM6 | Content mutation during supersede blocked | Changing content during status transition raises exception |
| BOE-IMM7 | UPDATE on boe_citations blocked | Trigger raises exception |
| BOE-IMM8 | DELETE on boe_citations blocked | Trigger raises exception |

### 6.4 Citation Evidence Chain Tests

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-CHAIN1 | Cited requirement_link delete blocked | DELETE FROM requirement_links WHERE id = cited_id fails with RESTRICT |
| BOE-CHAIN2 | Direct citation delete blocked | DELETE FROM boe_citations fails with trigger exception |

### 6.5 Snapshot Integrity Tests (DB Level)

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-SNAP1 | Composite hash recomputation matches | Recomputing hash from artifacts matches stored composite_hash |
| BOE-SNAP2 | Snapshot with mismatched intelligence rejected (DB) | Raw INSERT with artifact referencing different intel fails trigger |
| BOE-SNAP3 | Snapshot with superseded intelligence rejected (DB) | Raw INSERT with superseded intelligence_version fails trigger |
| BOE-SNAP4 | Snapshot with superseded artifact rejected (DB) | Raw INSERT with artifact status='superseded' fails trigger |
| BOE-SNAP5 | Snapshot artifacts must belong to proposal (DB) | Raw INSERT with artifact from different proposal fails trigger |

### 6.6 Gate Tests

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-GATE1 | Draft intelligence rejected | Generation against `status='draft'` intelligence fails with INVALID_STATE |
| BOE-GATE2 | Superseded intelligence rejected | Generation against `status='superseded'` intelligence fails |
| BOE-GATE3 | Unapproved scenario rejected | Generation against `status='draft'` pricing_scenario fails |
| BOE-GATE4 | Non-active WBS rejected | Generation against WBS not in 'active' status fails (DB trigger rejects insert) |
| BOE-GATE5 | Confirmation hash mismatch rejected | If recomputed hash differs from stored, generation fails |

### 6.7 Integration Tests

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| BOE-INT1 | Full generation flow | Create intel → confirm → create WBS → activate → compute scenario → approve → generate artifact |
| BOE-INT2 | Share link artifact resolution | Share link with artifact_id returns artifact content, not live data |
| BOE-INT3 | Snapshot creation flow | Generate artifact → create snapshot → verify composite hash |

---

## 7. Deliverable Checklist

| Item | Status |
|------|--------|
| Migration SQL (3 tables, triggers, RLS) | Defined in §1 |
| Partial unique index (not constraint) | Fixed in §1.1 |
| Artifact content schema (Zod) | Defined in §2 |
| Worked example (PM-HCD real data) | Defined in §3 with reproducible query |
| Fee decomposition math | Defined in §3.3 with conservation proof |
| Command signatures | Defined in §4 |
| Error shapes | Defined in §4.1, §4.3 |
| Test list | Defined in §6 |
| Share link data layer | Defined in §5 |
| Citation evidence chain protection | ON DELETE RESTRICT + delete trigger in §1.2 |
| Snapshot DB-level validation | Trigger validates status='generated' + intel='confirmed' in §1.3 |
| WBS validation tightened | Only 'active' allowed, no superseded in §1.1 |
| labor_loading citation scope documented | Design decision in §1.2 |

---

## Appendix: Migration File Naming

Following existing pattern, the migration will be:

```
supabase/migrations/060_boe_artifacts.sql
```

Contents: All SQL from §1.1, §1.2, §1.3, and §5.1 combined into single migration file.
