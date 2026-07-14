# TrueBid — AI-Powered Government Contracting Proposal Tool

## Project Overview

TrueBid helps government contractors build cost proposals. Users upload RFPs, the AI extracts requirements and generates Work Breakdown Structures (WBS), and the tool produces compliant cost estimates with BOE (Basis of Estimate) documentation. Exports to PDF/DOCX.

## Tech Stack

- **Framework:** Next.js 15 (App Router) with React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **State:** React Context (`contexts/app-context.tsx` is the main state store)
- **Auth:** Supabase Auth with SSR middleware
- **Database:** Supabase (PostgreSQL with RLS)
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`) for RFP extraction and WBS generation
- **Validation:** Zod (schemas in `lib/schemas/`)
- **Testing:** Jest + React Testing Library (unit), Playwright (E2E)
- **Git Hooks:** Husky + lint-staged (ESLint on pre-commit)

## Project Structure

```
app/
  (auth)/              # Login, signup, forgot/reset password
  [id]/                # Dynamic proposal detail page
  account/             # User settings, company, billing, labor, rates, team
  api/
    companies/         # Company CRUD + roles + settings
    extract-rfp/       # AI: PDF → structured solicitation data
    generate-wbs/      # AI: requirements → WBS tasks
    proposals/         # Proposal CRUD + requirements + WBS
    user/              # Profile + avatar
  dashboard/           # Main dashboard
  onboarding/          # New user onboarding
  tools/               # Standalone tools page

components/
  account/             # Account settings components
  auth/                # Auth layout
  dashboard/           # Dashboard component
  shared/              # App header, footer, tabs navigation, layout wrapper
  tabs/                # Main proposal tabs (upload, estimate, export, etc.)
  ui/                  # shadcn/ui primitives (button, card, dialog, etc.)

contexts/
  app-context.tsx      # Central state: proposals, roles, settings, WBS, solicitation
  auth-context.tsx     # Auth state

lib/
  api.ts               # Client-side API helpers
  schemas/             # Zod validation schemas
  supabase/            # Supabase client (browser) + server (service role)
  utils.ts             # cn() utility
  export-utils.ts      # PDF/DOCX generation
  boe-export.ts        # BOE document export
  solicitation-type.ts # Solicitation/RFP type definitions
  gsa-schedule-data.ts # GSA schedule reference data
  pricing/             # Centralized pricing engine (Phase 1)
  tenancy/             # Multi-tenancy support (Phase 1)
  commands/            # Command pattern for mutations (Phase 1)

hooks/
  use-proposal-sync.ts # Proposal sync hook
```

## Commands

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build
npm run lint          # ESLint
npm run typecheck     # TypeScript check (tsc --noEmit)
npm test              # Run Jest unit tests
npm run test:watch    # Jest in watch mode
npm run test:coverage # Jest with coverage report
npm run test:e2e      # Playwright E2E tests
npm run test:e2e:ui   # Playwright with UI
```

## CRITICAL RULES

1. **ONE change at a time** — Never make multiple unrelated changes in a single session
2. **NO clever solutions** — Make the minimal change that fixes the issue
3. **NO React Portals, NO major refactors** unless explicitly asked
4. **ASK before committing** — Show me the diff first with `git diff`
5. **TEST before declaring done** — Verify the full flow works

## When Making Changes

1. Show me what you plan to change BEFORE editing
2. Make the smallest possible fix
3. Run `git diff` and show me the output
4. Wait for my approval before committing

## DO NOT

- Add new dependencies without asking
- Refactor working code
- Make "improvements" I didn't ask for
- Create multiple commits for one fix
- Use `@ts-nocheck` in new files
- Use `localStorage` for new features (use Supabase)

## Git Workflow

- All work goes through feature branches and PRs. Direct pushes to develop are blocked for everyone, including admin credentials. Lapedra approves merges.
- Work on `develop` branch only unless explicitly told otherwise
- Do NOT create new branches without explicit permission
- Commit after each logical fix with clear messages (e.g., `fix: dashboard proposal title display`)
- Test changes before committing
- Pre-commit hook runs ESLint via lint-staged

## Database Schema

The Supabase `proposals` table has these columns:
- id, company_id, title, solicitation_number
- client, agency, client_agency (use client + agency, not client_agency)
- status, contract_type, due_date
- estimated_value, total_value, period_of_performance (jsonb)
- team_size, progress, starred, archived
- created_at, updated_at

## API Routes

- All routes use the authenticated user's session via `lib/supabase/server.ts` (anon key + cookies)
- RLS policies enforce data isolation — users can only access their own company's data
- Auth check: `supabase.auth.getUser()` at start of each route
- Return 401 if no session
- Log errors with full details before returning 500
- Validate request bodies with Zod schemas from `lib/schemas/`

## UI Standards

Before writing any UI code, read `DESIGN-SYSTEM.md`. All components, patterns, and decisions must follow it.

## Code Style

- snake_case for database columns
- camelCase for TypeScript/React
- Transform between them in API routes
- Use shadcn/ui components from `components/ui/`
- Follow existing patterns in the codebase

## Known Tech Debt

Files with `@ts-nocheck` (need gradual type fixing):
- `components/task-decomposition.tsx`
- `components/tabs/upload-tab.tsx`
- `components/tabs/export-tab.tsx`
- `components/tabs/rate-justification-tab.tsx`
- `components/tabs/sub-rates-tab.tsx`
- `components/tabs/roles-and-pricing-tab.tsx`

TypeScript strictness: `noUnusedLocals` and `noUnusedParameters` are not enabled yet due to many existing violations. Enable them incrementally.

ESLint: `@typescript-eslint/no-explicit-any` is currently disabled. Tighten once `@ts-nocheck` files are fixed.

## Known Limitations (Frozen Features)

Features that are intentionally limited pending future work:

- **Compliance matrix** — `compliance/generate` and `compliance/regenerate` routes predate multi-document support (Phase 4B). They look for `working_data.solicitationRawText` which is not populated by multi-document uploads. The component shows a graceful empty-state for multi-document proposals. Frozen pending writing-module revival.

- **Multi-document upload UI** — UI supports single-document upload; document-set extraction available via API only (`/api/proposals/{id}/documents`). SetAside-class facts (e.g., WOSB, 8(a)) require the instructions document which is not yet uploadable through the UI. Phase D backlog.

- **Legacy contract-total vs pricing scenario divergence (Phase 6A)** — The legacy Roles & Pricing panel computes contract totals using period definitions from `working_data.proposalSetup.periods` (unconfirmed, manual entry). Pricing scenarios compute labor_loading lines using period definitions from `intelligence_periods` (confirmed intelligence, RFP-extracted). These may differ when:
  - Legacy data was entered before intelligence confirmation
  - User manually edited proposalSetup periods without reconfirming intelligence
  - Intelligence extraction corrected period durations from the RFP

  **Resolution path:** Displays converge when the panel reads from `pricing_scenarios` in Phase 6B/D. Until then, the delta is decomposed and attributed in the conservation gate (must be fully explained with zero residual). If intelligence periods are incorrect, the fix is supersede-and-reconfirm, not code change.

## Environment Variables

See `.env.example` for required keys:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- `ANTHROPIC_API_KEY` — Anthropic Claude API key (server only)

## AI Features

- **Shipley PDF:** Available via `SHIPLEY_PDF_URL` env var. Used as knowledge base for the Phase 4 coaching engine. Never commit the actual URL to the repository.

---

## Phase 1: Integrity Spine (Implemented)

### Pricing Engine (`lib/pricing/`)

THE centralized pricing engine for all rate calculations. **All pricing logic MUST use this module.**

```typescript
import {
  calculateFullyBurdenedRate,
  calculateBillRate,
  normalizeRateToDecimal,
} from '@/lib/pricing'

const breakdown = calculateFullyBurdenedRate({
  annualSalary: 120000,
  rates: { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 },
  profitRate: 0.10,  // REQUIRED - no default, must be explicit
})

console.log(breakdown.fullyBurdenedRate) // $123.71
```

**Key formulas (non-negotiable):**
```
base_hourly        = annual_salary / 2080
fringe_amount      = base_hourly * fringe_rate
overhead_base      = base_hourly + fringe_amount
overhead_amount    = overhead_base * overhead_rate   ← CORRECT (not salary * rate)
ga_base            = overhead_base + overhead_amount
ga_amount          = ga_base * ga_rate
cost_before_profit = ga_base + ga_amount
profit_amount      = cost_before_profit * profit_rate
fully_burdened     = cost_before_profit + profit_amount

fte                = planned_billable_hours / 1920
gsa_year           = floor((cumulative_month - 1) / 12) + 1
```

**Constants:**
- `DEFAULT_STANDARD_HOURS = 2080` (for rate calculation)
- `DEFAULT_BILLABLE_HOURS_PER_YEAR = 1920` (for FTE calculation)

**Rate normalization:** Use `normalizeRateToDecimal()` at boundaries where input may be percentage (21.16) or decimal (0.2116).

**Canonical rate source: `company_settings` table**

Indirect rates (fringe, overhead, G&A) have ONE source of truth: the `company_settings` table.

- **Settings page** (`/account/rates`): Reads and writes to `company_settings` via API
- **Roles & Pricing panel**: Reads from context, which loads from `company_settings` on mount
- **BOE share links**: Reads directly from `company_settings` (not `working_data` snapshots)
- **Export**: Uses context rates, sourced from `company_settings`

**Consequence (accepted interim behavior):** Changing rates in Settings reprices ALL open proposals and refreshes shared BOE links immediately. There is no rate versioning — rates are tenant-wide and live. Phase 5 will introduce versioned rate sets for proposal-level rate snapshots.

**Settings API is never cached.** The `/api/companies/settings` endpoint returns `Cache-Control: no-store` to ensure reads always reflect the latest database state.

### Multi-Tenancy (`lib/tenancy/`)

Tenant context resolution for multi-company support.

```typescript
import { resolveTenantContext, hasRole } from '@/lib/tenancy'

const context = await resolveTenantContext(supabase)
if (hasRole(context, ['owner', 'admin', 'estimator'])) {
  // User can perform this action
}
```

**Roles:** `owner`, `admin`, `estimator`, `writer`, `reviewer`, `accountant`

### Command Layer (`lib/commands/`)

Command pattern for state mutations with audit logging and optimistic concurrency.

```typescript
import { runCommand, createCreateProposalCommand } from '@/lib/commands'

const command = createCreateProposalCommand(supabase)
const result = await runCommand(supabase, command, {
  title: 'New Proposal',
  agency: 'DOD',
})

if (result.success) {
  console.log('Created:', result.data.id)
}
```

**Available commands:**
- `CreateProposal` - Create new proposal
- `ArchiveProposal` - Soft-delete proposal (with optimistic concurrency)
- `UpdateProposalMetadata` - Update title, solicitation number, agency

**Optimistic concurrency:** Pass `expectedVersion` to detect conflicts. Returns `STALE_VERSION` error with conflict details.

### Database Migrations

**Standing rule: NO schema changes via SQL Editor. Migrations only.**

All database changes must go through versioned migration files in `supabase/migrations/`. Never use the Supabase dashboard SQL editor for schema changes—it creates tracking drift between the migration history and actual schema.

### Remote Database Safety Rules (MANDATORY)

These rules exist because `supabase db reset --linked` wiped production on 2026-07-11. They are non-negotiable.

1. **`supabase db reset` is LOCAL-ONLY.** It may NEVER be run with `--linked` or against any remote URL. No exceptions. No prompt-confirmation workaround.

2. **NEVER auto-confirm destructive commands.** Never pipe `yes`, `--yes`, `-y`, or any auto-confirmation into a destructive command. A safety prompt you must defeat is a stop sign, not an obstacle.

3. **This repo is NEVER linked to staging or production.** The `supabase/.temp/` directory must not exist when working with remote databases. If it exists, delete it before any remote operation. Local linking is only permitted if local workflows require it.

4. **All remote migrations go through `scripts/db-push-remote.sh`.** Direct use of `supabase db push` against a remote database is FORBIDDEN. The script:
   - Requires explicit `--db-url` argument
   - Extracts and prints the target host
   - Validates against `docs/ENVIRONMENTS.md`
   - Refuses if `supabase/.temp/` exists
   - Requires typing the target project ref to confirm

5. **Destructive/schema-changing commands require explicit go.** Any destructive or schema-changing command against a remote database requires the user's explicit go in the same session, restated, not carried over from a previous session.

6. **`scripts/db-push-remote.sh` is the ONLY path for remote DB writes.** If it fails for any reason — network, DNS, host rejection — STOP and report the failure. Building, modifying, or substituting an alternate connection path to staging or production is prohibited without explicit prior authorization. Reports must never present an unauthorized path's output in the authorized path's format.

**Environment references:** See `docs/ENVIRONMENTS.md` for verified project refs and connection strings.

### Migration Coding Standards

1. **All PL/pgSQL variables use `v_` prefix.** In migration functions, every declared variable must be prefixed with `v_` (e.g., `v_prop`, `v_count`, `v_status`). This prevents ambiguity with table column names. No exceptions.

2. **Migration failures trigger whole-file audit.** When any migration fails, the fix must audit the entire file for the same bug class—never a single-line fix. If one variable name conflicts with a column, check ALL variables in the file.

New tables (apply in order):
- `025_tenants.sql` - tenants + tenant_memberships + backfill
- `026_audit_events.sql` - immutable audit log
- `027_proposal_row_version.sql` - optimistic concurrency for proposals

### working_data Freeze

**No new writers to `working_data` may be introduced.**
**No new keys may be added.**

All new persistence uses normalized tables + commands. Existing writers continue until their domain migrates (Phases 2-3).

### Testing Standards

1. **Execution requirement.** A test that does not execute the code under test may NEVER be reported as PASS. Tests must invoke the actual implementation to qualify as passing.

2. **Shape/type assertions are labeled separately.** Tests that only assert types, interfaces, or data shapes (without executing runtime behavior) must be:
   - Explicitly labeled as "Shape Assertion" or "Type Check" in the test description
   - Counted separately in every test report
   - Not included in "Tests Passed" counts

3. **Test report format.** Every test report must include:
   - **Executed Tests:** Count of tests that ran actual code
   - **Shape/Type Assertions:** Count of structural/type-only checks
   - **Skipped:** Count of skipped tests (with reason)

4. **Integration tests require real execution.** Integration tests must:
   - Connect to actual database (local Supabase for unit/integration, staging for E2E)
   - Execute actual commands/queries
   - Verify actual state changes in the database

5. **E2E flows must exercise the user's actual path.** An API-level pass does not verify a UI capability. E2E tests must navigate the UI, trigger actions through components, and verify the full flow a user would experience. Testing `/api/foo` directly does not prove the button that calls it works.

6. **Deferred verification is not completion.** If acceptance criteria cannot execute, stop and report the blocker. Do not substitute unit tests for integration proofs and report completion.

### Migration Evidence

1. **All `db-push-remote.sh` output must be logged.** Append migration output to `docs/migration-log.md` at execution time — timestamp, target environment, ref confirmed, migration applied, verification results. Chat context is not a record.

2. **Migration evidence survives session loss.** The migration log in the repo is the authoritative record of what was applied and when.

### Deployment Reports

1. **Deployment reports must include the commit SHA.** "Deployed" without a SHA is not a report. State both the SHA deployed and where it was verified (e.g., Vercel dashboard, `git log origin/main`).

2. **Credential confirmations must not restate the secret.** When confirming a secret was not persisted, state the non-persistence fact without repeating the secret value itself.

### Deployment Attestation

Deployment completion is claimed ONLY by citing the green attestation run (link or run id). A deploy report without an attestation reference is not a report.

### Test Citation

Test results in any report cite the results file or CI run. Counts are copied from reporter output, never typed.

### Canonical Serialization (Hash Stability)

**Canonical serialization is append-only. Existing fields' serialization never changes; new fields are omit-when-absent.**

The confirmation hash for `intelligence_versions` is computed from canonical JSON. This serialization format is frozen:

**Phase 2 field set (frozen forever, nulls included):**
- periods: id, name, months, cumulativeMonthsEnd, gsaRateYear, sortOrder
- disciplines: id, discipline, confidence, sourceText
- laborRequirements: id, title, laborCategory, hoursPerMonth, utilizationPct, appearsInPeriods, confidence, sourceText
- factsJson, versionId

**Post-Phase-2 fields (omit when absent/default):**
- laborRequirements: isPrescribed (omit if false), laborCategoryId, matchType, matchConfidence (omit if null)
- solicitationBrief (omit if null)

**Rules:**
1. Any change to `lib/commands/intelligence/hash-utils.ts` requires the golden-file test (`__tests__/lib/commands/intelligence.test.ts` → "Hash Stability Golden-File") to pass unchanged.
2. Before merging changes to canonical serialization: run stored-vs-recomputed hash verification against all confirmed versions on staging.
3. New fields added in future phases follow the omit-when-absent rule: default/null values are omitted, meaningful values are included.

### AI Eval Harness

**Any prompt, schema, or model change in the active AI pipeline requires an eval run.**

```bash
npm run evals              # Run evals
npm run evals -- --compare # Compare to baseline
```

The eval report must be included in the completion summary showing:
- Extraction F1 (baseline vs current)
- Discipline violations (target: zero at generation time)
- Schema validation pass rate

Corpus location: `evals/corpus/`. Ground truth is generated by querying production (`npm run evals:generate-expected`), never recalled from memory.

---
