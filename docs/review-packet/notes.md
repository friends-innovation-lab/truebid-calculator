# Notes — Observations During Review Packet Assembly

**Generated:** 2026-07-12
**Commit:** 18a69b409e9f6afe65e67bbe404ab8cca5d4e958
**Assembler:** Claude Code (read-only evidence gathering)

---

## Discrepancies Between Docs and Code

### 1. API-CONTRACT.md was incomplete
The original `docs/API-CONTRACT.md` did not document several command-backed endpoints:
- Proposal CRUD endpoints (`GET/POST/PUT/DELETE /api/proposals`)
- WBS task mutation commands (`updateWbsTask`, `addWbsTask`, `removeWbsTask`)
- Staffing assignment commands (`updateStaffingAssignment`, `addStaffingAssignment`, `removeStaffingAssignment`)

These have been added to `api-contract.md` in this packet.

### 2. Tenant routes not yet implemented as REST
The Phase 5 completion report mentions tenant discipline and labor category endpoints, but the only REST implementations found are:
- `/api/tenant/disciplines` — EXISTS but limited (GET only)
- `/api/tenant/labor-categories` — EXISTS (CRUD via commands)
- `/api/tenant/labor-categories/resolve` — EXISTS (POST)

The command layer is complete; some endpoints use command invocation internally.

### 3. Missing E2E tests
CLAUDE.md specifies "E2E flows must exercise the user's actual path" but no Playwright tests were found in the expected `e2e/` or `tests/e2e/` directories. The `playwright.config.ts` exists but the test files appear minimal or absent.

---

## Schema Observations

### Custom Types (Domain Modeling)
Production schema uses 10 custom ENUM types:
- `intelligence_status` (draft/confirmed/superseded)
- `wbs_status` (generated_candidate/draft/active/superseded)
- `staffing_model` (prescribed/offeror_proposed/unclear)
- `document_type`, `document_status`, `doc_type_source`
- `prime_or_sub`, `rate_source_type`, `staffing_source`, `wbs_task_source`

### Composite Type
- `labor_category_match` (category_id, match_type, confidence) — used by `resolve_labor_category()` function

### Trigger Coverage
8 immutability/guard triggers found in production:
1. `check_intelligence_version_immutability` — blocks mutations on confirmed/superseded versions
2. `check_fact_table_parent_draft` — blocks fact table writes when parent not draft
3. `check_intelligence_version_delete` — blocks delete on confirmed/superseded
4. `check_active_intelligence_version_ownership` — validates FK integrity
5. `v_block_active_wbs_delete` — prevents deleting active WBS
6. `v_block_child_mutation_on_superseded` — guards child tables
7. `v_block_superseded_wbs_mutation` — guards WBS version
8. `increment_row_version` — optimistic concurrency support

### Notable Stored Procedures
- `resolve_labor_category(tenant_id, role_title)` — three-tier resolution (exact → alias → fuzzy)
- `get_staffing_effective_salary_cents(assignment_id)` — override → catalog → NULL fallback
- `compute_document_set_hash(proposal_id)` — SHA-256 for document fingerprinting
- Seed functions: `seed_tenant_labor_catalog`, `seed_fftc_roles_from_json`, `seed_standard_aliases`

---

## Code Observations

### Legacy Surface Area
Six `@ts-nocheck` files totaling 9,468 lines remain in `components/tabs/`:
- `roles-and-pricing-tab.tsx` alone is 3,420 lines
- These files handle core pricing and export functionality

### Compliance Routes Frozen
Both `compliance/generate/route.ts` (482 lines) and `compliance/regenerate/route.ts` look for `workingData.solicitationRawText` at lines 156-158 and 167-168 respectively. Multi-document uploads do not populate this field, so the compliance matrix feature is effectively frozen for multi-doc proposals.

### Generate-WBS Route Size
`app/api/proposals/[id]/generate-wbs/route.ts` is 1,039 lines — unusually large for a route handler. The file contains:
- Full AI system prompt (300+ lines)
- Schema transformation logic
- Tenant catalog integration
- Multiple fallback paths

This could benefit from extraction to separate modules.

### Intelligence Guard Pattern
The `requireConfirmedIntelligence` guard in `lib/commands/intelligence/guards.ts` performs 5 checks:
1. Version exists
2. Belongs to correct tenant
3. Belongs to correct proposal
4. Status is 'confirmed'
5. Hash recomputes correctly

This is the primary gate preventing WBS generation on unconfirmed intelligence.

---

## Test Coverage Observations

### Test File Inventory (10 files found)
```
__tests__/lib/commands/intelligence.test.ts
__tests__/lib/commands/wbs.test.ts
__tests__/lib/commands/wbs-integration.test.ts
__tests__/lib/pricing/engine.test.ts
__tests__/lib/pricing/escalation.test.ts
__tests__/lib/pricing/salary-resolution.test.ts
__tests__/lib/pricing/salary-projection.test.ts
__tests__/lib/solicitation/classifier.test.ts
__tests__/lib/solicitation/validation.test.ts
__tests__/lib/commands/proposal.test.ts
```

### No Direct SQL Attack Tests
No tests found that directly inject malicious SQL or test RLS bypass attempts. The project relies on Supabase RLS policies enforced at the database level, tested indirectly.

### Shape Assertion Tests
Several test files use `toMatchObject` or `toHaveProperty` assertions that check data shape rather than executing business logic. Per CLAUDE.md rules, these should be labeled separately. Files with significant shape-only tests:
- `wbs.test.ts` — some tests verify output structure without executing actual WBS logic
- `intelligence.test.ts` — some tests verify hash computation output format

---

## Missing Documentation

### No Architecture Decision Records (ADRs)
No `docs/adr/` directory or similar decision record trail exists. Architectural decisions (pricing engine formula, intelligence versioning, catalog resolution order) are documented only in CLAUDE.md and inline comments.

### No Runbook
No operational runbook exists for:
- Database recovery procedures
- Rate rollback scenarios
- Intelligence version conflict resolution

The incident post-mortem (`INCIDENT-2026-07-11.md`) serves as partial operational documentation.

---

## Recommendations (Not Fixes — Observations Only)

1. **E2E test gap** should be addressed before production scale
2. **Generate-WBS route** could be refactored into smaller modules
3. **ADR directory** would help preserve architectural context
4. **Shape-only tests** should be explicitly labeled per testing standards

---

*End of observations. No code changes made during this assembly.*
