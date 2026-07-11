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

---
