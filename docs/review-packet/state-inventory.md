# State Inventory

Generated as of commit 18a69b409e9f6afe65e67bbe404ab8cca5d4e958 on 2026-07-12

---

## working_data Residents (FINAL Field Map)

The `working_data` JSONB blob on the `proposals` table contains legacy fields. Per Phase 1 rules: **no new writers may be introduced; no new keys may be added.**

### Fields Remaining in working_data

| Key | What It Holds | Who Reads | Who Writes (Allowlisted) | Scheduled Home |
|-----|---------------|-----------|--------------------------|----------------|
| `roles[]` (legacy) | Array of role pricing data: salary, level, step, profit margin | `lib/roles-projection.ts` (fallback), `/api/proposals/[id]/roles/route.ts`, BOE export components | `app/api/proposals/[id]/route.ts`, `hooks/use-proposal-sync.ts` (PRICING FIELDS ONLY) | Phase D: Archive after full catalog migration |
| `roles[].currentSalary` | Role annual salary | Roles & Pricing panel, BOE export | Read-only (migrated to `tenant_labor_categories.levels` + `staffing_assignments.salary_override_cents`) | Phase 5: MIGRATED |
| `roles[].selectedLevel` | IC1-IC5 level key | Roles & Pricing panel | Read-only (migrated to `staffing_assignments.level_key`) | Phase 5: MIGRATED |
| `roles[].selectedStep` | 0-based step index | Roles & Pricing panel | Read-only (migrated to `staffing_assignments.step_index`) | Phase 5: MIGRATED |
| `roles[].profitMargin` | Role-level profit override | Pricing engine | Read-only (migrated to `staffing_assignments.profit_margin_override`) | Phase 5: MIGRATED |
| `solicitationRawText` | Full PDF text for AI prompts | `app/api/extract-rfp/route.ts`, compliance routes | `app/api/extract-rfp/route.ts` | Phase D: Move to `solicitation_documents.raw_text` |
| `summary` | AI-generated proposal summary | Dashboard, proposal detail UI | `app/api/extract-rfp/route.ts` | Keep or remove based on usage |
| `winThemes` | AI-generated win themes | Proposal detail UI | `app/api/extract-rfp/route.ts` | Keep or remove based on usage |
| `outline` | AI-generated outline | Proposal detail UI | `app/api/extract-rfp/route.ts` | Keep or remove based on usage |
| `requirements` | Legacy extracted requirements | Legacy UI components | `app/api/extract-rfp/route.ts` | Migrated to `solicitation_intelligence` (Phase 2) |
| `estimateWbsElements` | REMOVED from sync | N/A | NONE (WBS in normalized tables) | Phase 3: MIGRATED to `wbs_versions` + `wbs_tasks` |

### Pricing Resolution Order (Phase 5)

1. `staffing_assignments.salary_override_cents` (if set)
2. `tenant_labor_categories.levels[level][step]` (catalog lookup)
3. `working_data.roles[].currentSalary` (legacy fallback, read-only)

### Fields NO LONGER in working_data

| Field | Migrated To | Migration Phase |
|-------|-------------|-----------------|
| `estimateWbsElements` | `wbs_versions` + `wbs_tasks` tables | Phase 3 |
| Role hours/FTE/periods | `staffing_assignments` table | Phase 3 |
| Pricing fields (salary, level, step, profit) | `tenant_labor_categories` + `staffing_assignments` | Phase 5 |
| Contract intelligence facts | `intelligence_versions` + fact tables | Phase 2 |

---

## Allowlist History

The `scripts/working-data-allowlist.txt` tracks the ONLY files permitted to write to working_data. History showing shrink trajectory:

### Phase 1 (Initial Freeze)

```
# Original allowlist (pre-Phase 1)
# - No explicit tracking; multiple writers scattered across codebase
```

### Phase 2 (Intelligence Normalization)

```
# Allowlist established
app/api/proposals/[id]/route.ts
app/api/extract-rfp/route.ts
app/api/proposals/route.ts
contexts/app-context.tsx
hooks/use-proposal-sync.ts
```

**Writers: 5 files**

### Phase 3 (WBS & Staffing Normalization)

Removed: `contexts/app-context.tsx`

Restriction added: `use-proposal-sync.ts` writes ONLY pricing fields (no hours, FTE, periods)

Restriction added: `estimateWbsElements` no longer written (WBS in normalized tables)

```
app/api/proposals/[id]/route.ts
hooks/use-proposal-sync.ts      # RESTRICTED: pricing fields only
app/api/extract-rfp/route.ts
app/api/proposals/route.ts
```

**Writers: 4 files (1 restricted)**

### Phase 4A-4B (Structured Outputs & Multi-Document)

No changes to allowlist.

**Writers: 4 files**

### Phase 5 (Tenant Labor Catalog) - CURRENT

Pricing fields migrated FROM working_data TO normalized tables:
- `roles[].currentSalary` -> `tenant_labor_categories.levels` OR `staffing_assignments.salary_override_cents`
- `roles[].selectedLevel` -> `staffing_assignments.level_key`
- `roles[].selectedStep` -> `staffing_assignments.step_index`
- `roles[].profitMargin` -> `staffing_assignments.profit_margin_override`

```
# Current allowlist (Phase 5 - 2026-07-12)

# Proposal sync and persistence (RESTRICTED)
# - Writes ONLY pricing fields for roles (no hours, FTE, periods)
# - Does NOT write estimateWbsElements (WBS in normalized tables)
app/api/proposals/[id]/route.ts
hooks/use-proposal-sync.ts

# AI extraction results (temporary storage)
app/api/extract-rfp/route.ts

# Legacy imports/exports
app/api/proposals/route.ts
```

**Writers: 4 files (2 restricted)**

### Shrink Trajectory Summary

| Phase | Writer Count | Delta | Notes |
|-------|--------------|-------|-------|
| Pre-Phase 1 | Many | - | No tracking |
| Phase 2 | 5 | Baseline | Allowlist established |
| Phase 3 | 4 | -1 | Removed app-context, added restrictions |
| Phase 4A-B | 4 | 0 | No changes |
| Phase 5 | 4 | 0 | Pricing fields migrated (read-only fallback) |

**Target (Phase D):** 0-2 writers (AI extraction temporary storage may remain)

---

## Test Census

### Test Files Inventory

| File | Category | Test Type |
|------|----------|-----------|
| `__tests__/lib/pricing/engine.test.ts` | Pricing | Behavioral (23 tests) |
| `__tests__/lib/pricing/profit-resolver.test.ts` | Pricing | Behavioral (13 tests) |
| `__tests__/lib/pricing/rate-convergence.test.ts` | Pricing | Behavioral (5 tests) |
| `__tests__/lib/commands/stale-version.test.ts` | Commands | Behavioral (5 tests) |
| `__tests__/lib/commands/intelligence.test.ts` | Commands | Behavioral (25 tests) + Shape Assertions (5 tests) |
| `__tests__/lib/commands/wbs.test.ts` | Commands | Behavioral (22 tests) + Shape Assertions (15 tests) |
| `__tests__/lib/commands/wbs-integration.test.ts` | Commands | Integration/Behavioral (4 tests, requires local DB) |
| `__tests__/lib/solicitation-type.test.ts` | Utilities | Behavioral (6 tests) |
| `__tests__/lib/utils.test.ts` | Utilities | Behavioral (5 tests) |
| `__tests__/evals/catalog-mapping.test.ts` | Evals | Behavioral (9 tests) |

### Test Counts by Type

| Type | Count | Description |
|------|-------|-------------|
| **Behavioral (Executed Tests)** | ~112 | Tests that invoke actual implementation code |
| **Shape/Type Assertions** | ~20 | Tests that only assert types, interfaces, or data shapes (explicitly labeled in wbs.test.ts, intelligence.test.ts) |
| **Integration Tests** | 4 | Tests requiring local Supabase (`wbs-integration.test.ts`) |
| **Skipped** | Variable | Integration tests skip when `SUPABASE_URL` not set or not local |

### Behavioral Test Categories

1. **Pricing Engine Tests** (41 tests)
   - Full cascade calculations with externally verified values
   - Formula A vs Formula B divergence proof
   - Rate normalization, FTE calculation, GSA year
   - Validation (negative inputs, >= 100% profit guard)
   - Convergence tests (all call sites produce same rate)

2. **Command Tests** (47 tests)
   - Optimistic concurrency (stale version rejection)
   - Intelligence hash computation and round-trip consistency
   - Type coercion from Postgres types
   - Canonical serialization (deterministic ordering)
   - WBS validation (discipline, period, prime/sub, prescribed staffing)
   - Conflict resolution payloads
   - Error class identity verification

3. **Integration Tests** (4 tests)
   - Atomic supersession on WBS accept
   - user_modified conflict default behavior (keep_user)
   - user_modified with accept_candidate resolution

4. **Utility Tests** (20 tests)
   - Solicitation data helpers
   - Class name utility (cn)
   - Catalog mapping metrics

### Shape/Type Assertions (per Testing Standards)

Tests labeled or identified as shape/type assertions (not behavioral execution):

| File | Shape Assertion Tests |
|------|----------------------|
| `wbs.test.ts` | ConflictResolution shape, AcceptWbsCandidateInput shape, CreateWbsCandidateInput shape (~8 tests) |
| `intelligence.test.ts` | Guard rejection logic patterns (NOT_FOUND, NOT_CONFIRMED, WRONG_PROPOSAL, NOT_ACTIVE, HASH_MISMATCH), staffing model gate structure (~12 tests) |

These are explicitly documented as "Logic Only - No DB" or pattern documentation.

### DB-Integrity Tests

**No dedicated direct-SQL attack or DB-integrity tests found.**

The project uses:
- RLS policies for data isolation (enforced at database level)
- Triggers for immutability (`wbs_immutability.sql`, `intelligence_immutability.sql`)
- Row version checks for optimistic concurrency

DB-level constraints are tested indirectly via integration tests in `wbs-integration.test.ts`.

### Test Standards Compliance

Per `CLAUDE.md` Testing Standards:

1. **Execution requirement**: All behavioral tests invoke actual code
2. **Shape assertions labeled**: Shape/type tests are grouped under descriptive names like "ConflictResolution shape" or "documents expected behavior"
3. **Integration tests execute real code**: `wbs-integration.test.ts` requires local Supabase

---

## Summary

- **working_data residents**: 10 keys, 4 migrated (read-only), 6 active
- **Allowlist writers**: 4 files (shrunk from 5 in Phase 3)
- **Test coverage**: ~132 tests (112 behavioral, 20 shape assertions)
- **DB-integrity tests**: Indirect via RLS + triggers; no dedicated attack tests
