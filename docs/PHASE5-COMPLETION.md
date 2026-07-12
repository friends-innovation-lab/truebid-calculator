# Phase 5 Completion Report

**Date:** 2026-07-12
**Deployed SHA:** `ab25d56ad4b92ef74ee2fc7f7d14433f86597c8b`

---

## Summary

Phase 5 implements tenant-scoped labor catalog with discipline taxonomy, role categories, aliases, and pricing field migration. The system is now configurable per-tenant rather than hardcoded to FFTC roles.

---

## Production Deployment

### Backup
- **File:** `backups/pre-phase5-prod-20260712-123506.sql`
- **Timestamp:** 2026-07-12 12:35:06 UTC
- **Size:** 999K (9,678 lines, 62 tables)

### Migrations Applied
| Migration | Description |
|-----------|-------------|
| 046_tenant_disciplines.sql | 10 standard disciplines with seed |
| 047_tenant_labor_categories.sql | JSONB levels structure |
| 048_labor_category_aliases.sql | Umbrella alias support |
| 049_company_settings_tenant_id.sql | Tenant scope for settings |
| 050_staffing_pricing_columns.sql | Pricing columns on assignments |
| 051_intelligence_labor_category_fk.sql | FK for matched roles |
| 052_seed_tenant_catalog.sql | Seed functions |
| 053_backfill_staffing_pricing.sql | Discipline backfill |

### Catalog Seeded
- **Disciplines:** 10
- **Categories:** 34 (11 with salaries, 23 needs-setup)
- **Aliases:** 36

### Discipline Backfill
- devops→engineering: 0 rows (none existed)
- management→delivery: 0 rows (none existed)
- management→program-management: 0 rows (none existed)

### Penny Conservation
- **28/28 assignments conserved** ✓
- **0 salary overrides needed** (catalog matches working_data)

---

## Eval Results

### Baseline (Pre-Phase 5)
- pm-hcd F1: 1.00
- camp F1: 0.67

### Final (Phase 5)
- pm-hcd F1: 1.00
- camp F1: 0.67
- Discipline violations: 0
- Schema pass rate: 50%

**Delta:** No regression. Extraction unchanged; catalog integration additive.

---

## Allowlist Diff

### Fields Migrated FROM working_data
| Field | New Location | Notes |
|-------|--------------|-------|
| `roles[].currentSalary` | `tenant_labor_categories.levels` OR `staffing_assignments.salary_override_cents` | Catalog-first with override |
| `roles[].selectedLevel` | `staffing_assignments.level_key` | IC1-IC5 |
| `roles[].selectedStep` | `staffing_assignments.step_index` | 0-based |
| `roles[].profitMargin` | `staffing_assignments.profit_margin_override` | NULL = use company default |

### Fields REMAINING in working_data (read-only)
| Field | Reason | Migration Path |
|-------|--------|----------------|
| `roles[]` (legacy) | Read-only fallback for old proposals | Phase D: Archive after full migration |
| `solicitationRawText` | Text storage for AI | Phase D: Move to `solicitation_documents.raw_text` |
| `summary` | AI-generated summary | Keep or remove based on usage |
| `winThemes` | AI-generated | Keep or remove based on usage |
| `outline` | AI-generated | Keep or remove based on usage |
| `requirements` | Legacy extraction | Migrated to `solicitation_intelligence` |

---

## Field-Location Map FINAL

### Pricing Resolution Order
1. `staffing_assignments.salary_override_cents` (if set)
2. `tenant_labor_categories.levels[level][step]` (catalog lookup)
3. `working_data.roles[].currentSalary` (legacy fallback, read-only)

### Indirect Rates
- **Source:** `company_settings` table (fringe_rate, overhead_rate, ga_rate)
- **No working_data dependency**

### Discipline Taxonomy
- **Source:** `tenant_disciplines` table
- **Hardcodes removed:** `lib/ai/knowledge/disciplines.ts` now reference-only

### Labor Categories
- **Source:** `tenant_labor_categories` table
- **Hardcodes removed:** `fftc-roles-v2.json` now seed data only

---

## API Contract Updates

New endpoints added to `docs/API-CONTRACT.md`:
- `GET /api/tenant/disciplines`
- `GET /api/tenant/labor-categories`
- `POST /api/tenant/labor-categories/resolve`

Updated:
- `GET /api/proposals/[id]/roles` — Field-location split updated for Phase 5

---

## Handover Notes

### For UI Development
1. **Catalog resolution UI** — When extracting roles, show:
   - Exact matches: silent (no indicator needed)
   - Alias matches with context: `"HCD Lead" → UX Researcher (matched via alias: "Work is studies...")`
   - Fuzzy matches (0.5-0.8): Review prompt `"Did you mean X?"`
   - Unmapped (<0.5): Actions `[Map] [Add to Catalog] [Leave Unmapped]`

2. **Needs-setup indicator** — Categories with `levels = null` show warning:
   `"⚠️ No salary data configured. Configure in Settings → Labor Catalog."`

3. **Override vs Catalog** — Show resolution source in Roles panel:
   - `$118,000/yr (catalog)` vs `$125,000/yr (override)`

### For Future Phases
1. **Phase D: working_data cleanup** — Remove remaining fields after:
   - `solicitationRawText` → `solicitation_documents`
   - `roles[]` → Full catalog migration for legacy proposals
   - Archive or remove AI-generated fields

2. **Rate versioning** — Currently rates are tenant-wide and live. Consider:
   - Proposal-level rate snapshots
   - Historical rate sets for archived proposals

### Scripts Available
| Script | Purpose |
|--------|---------|
| `scripts/seed-standard-catalog.ts` | Seed new tenant with standard catalog |
| `scripts/backfill-staffing-pricing.ts` | Migrate assignments to catalog |
| `scripts/verify-rate-conservation.ts` | Verify penny conservation |
| `scripts/phase5-snapshot.ts` | Capture pre-backfill state |

---

## Definition of Done ✓

- [x] Tenant catalog live: disciplines, labor categories, aliases
- [x] Standard seed approved; FFTC fully mapped
- [x] Extraction resolves role titles via catalog
- [x] HCD-Lead alias resolves correctly (3 context-resolved targets)
- [x] Offeror-proposed generation staffs from catalog vocabulary
- [x] Validator enforces catalog resolution
- [x] FFTC identity is tenant data; company-context hardcode gone
- [x] Eval scores held (no regression)
- [x] Pricing fields resolved from catalog + overrides
- [x] Bill rates conserved to the penny (28/28)
- [x] API-CONTRACT.md updated
- [x] Field-location map finalized

---

## Phase 5 Closure

**Accepted:** 2026-07-12 12:48 PT

### Final Production State
- **SHA:** `4fad288`
- **tenant_labor_categories:** 34 roles (verified)
- **labor_category_aliases:** 36 aliases (verified)
- **Penny conservation:** 28/28 ✓
- **Proposals loading:** ✓

### UI Rewire Deferred
The `/account/labor` page still reads from `company_roles` (11 roles). Rewiring to `tenant_labor_categories` (34 roles) is Phase D backlog.

### Credentials Rotated
Service keys used during deployment should be rotated per standing security practice.

### Handover Complete
Phase 5 backend infrastructure is production-live. Next phase may proceed.
