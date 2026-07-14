# TrueBid Environment Configuration

This document describes the three deployment environments, their configurations, and the migration workflow.

## Environment Overview

| Environment | Supabase Project    | Anthropic Key     | Git Branch | Vercel Scope |
|-------------|---------------------|-------------------|------------|--------------|
| **Local**   | Local (Docker)      | `truebid-dev`     | any        | N/A          |
| **Staging** | `truebid-staging`   | `truebid-staging` | `develop`  | Preview      |
| **Production** | `truebid-prod`   | `truebid-prod`    | `main`     | Production   |

## Verified Project References (Last verified: 2026-07-11)

### Production

| Field | Value |
|-------|-------|
| **Project Ref** | `qtotsijebcpddipmzstb` |
| **Project Name** | `truebid-production` |
| **Region** | `us-east-1` |
| **Database Host (direct)** | `db.qtotsijebcpddipmzstb.supabase.co` |
| **Pooler Host** | `aws-1-us-east-1.pooler.supabase.com` |
| **Pooler URL (session)** | `postgresql://postgres.qtotsijebcpddipmzstb:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres` |

### Staging

| Field | Value |
|-------|-------|
| **Project Ref** | `tcobyquewjootwxpqijq` |
| **Project Name** | `truebid-staging` |
| **Region** | `us-east-2` |
| **Database Host (direct)** | `db.tcobyquewjootwxpqijq.supabase.co` |
| **Pooler Host** | `aws-1-us-east-2.pooler.supabase.com` |
| **Pooler URL (session)** | `postgresql://postgres.tcobyquewjootwxpqijq:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres` |

### Connection Path Selection

The guarded migration script (`scripts/db-push-remote.sh`) accepts two connection paths:

| Path | Host Format | Ref Extraction | Use Case |
|------|-------------|----------------|----------|
| **Direct** | `db.REF.supabase.co` | From hostname | Default when IPv6 routing available |
| **Pooler** | `aws-N-REGION.pooler.supabase.com` | From username (`postgres.REF`) | When direct host unreachable (IPv6) |

**Rule:** The script accepts direct or pooler connections it can verify; anything else is rejected, and rejection means stop-and-report.

**IPv6 Constraint:** Supabase direct database hosts (`db.*.supabase.co`) resolve to IPv6 only. If your development machine lacks IPv6 routing capability, use the session pooler URL instead. The pooler hosts resolve to IPv4.

**Session vs Transaction Pooler:**
- **Session pooler (port 5432):** Use for migrations. Supports prepared statements and multi-statement DDL.
- **Transaction pooler (port 6543):** Do NOT use for migrations. PgBouncer transaction mode breaks session-dependent operations.

## Local Development

### Initial Setup

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Start local Supabase (Docker must be running)
supabase start

# 3. Apply migrations and seed data
supabase db reset

# 4. Create .env.local with local credentials
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
#   SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
#   ANTHROPIC_API_KEY=<truebid-dev key>

# 5. Start the app
npm run dev
```

### Test Login Credentials (Local Only)

After `supabase db reset`, a synthetic user is available for local development:
- **Email:** `lapedra@cityfriends.tech`
- **Password:** `password123` (local only — never use this password on remote environments)

**Note:** This user is created via direct SQL insert, which only works locally.
For staging, see "Staging Test User Setup" below.

### Local Commands

```bash
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase db reset       # Reset DB, apply all migrations + seed
supabase migration list # Show migration status
supabase db diff        # Generate migration from schema changes
```

## Staging Environment

Staging mirrors production structure but uses sanitized data. It receives deployments from `develop` branch.

### Staging Deployment URL

| Field | Value |
|-------|-------|
| **Stable URL** | `https://truebid-calculator-git-develop-friends-innovation-lab.vercel.app` |
| **Supabase Project** | `tcobyquewjootwxpqijq` (truebid-staging) |
| **Branch** | `develop` |

**Note:** Deployment-hash URLs (e.g., `truebid-calculator-i5mra0cvn-...`) require a separate Vercel login. Use the stable `git-develop` URL above for consistent session continuity.

### Staging Database Operations

Always use explicit `--db-url` to prevent wrong-database accidents:

```bash
# Check staging migration status
supabase migration list --db-url "$STAGING_DB_URL"

# Apply pending migrations to staging
supabase db push --db-url "$STAGING_DB_URL"

# NEVER run without --db-url against staging/prod
```

### Staging Auth Configuration

Redirect URLs configured in Supabase dashboard:
- `https://*-truebid.vercel.app/**` (preview deployments)
- `https://staging.truebid.io/**` (if custom domain)

### Staging Test User Setup

**IMPORTANT:** Do NOT apply `supabase/seed.sql` to staging. Direct auth.users inserts bypass GoTrue and create users that cannot log in.

To create/fix a test user in staging:

```bash
# Set staging credentials
export STAGING_SUPABASE_URL=https://tcobyquewjootwxpqijq.supabase.co
export STAGING_SERVICE_ROLE_KEY=<from-supabase-dashboard>

# Run the fix script
npx tsx scripts/fix-staging-auth.ts
```

This creates a user via the Admin API (GoTrue-compatible):
- **Email:** `lapedra@cityfriends.tech`
- **Password:** Generated at runtime (displayed once, not stored)

### Loading Sanitized Production Data

```bash
# 1. Dump production (do NOT store this file in git!)
pg_dump --no-owner --no-acl \
  -h db.XXX.supabase.co -U postgres -d postgres \
  > prod-dump.sql

# 2. Sanitize for staging
npx tsx scripts/sanitize-dump.ts prod-dump.sql staging-safe.sql

# 3. Load into staging
psql -h db.STAGING.supabase.co -U postgres -d postgres < staging-safe.sql

# 4. Clean up (never commit dumps)
rm prod-dump.sql staging-safe.sql
```

## Production Environment

Production receives deployments from `main` branch only.

### Production Migration Protocol

**Before applying any migration to production:**

1. ✅ Migration applies cleanly to local (`supabase db reset`)
2. ✅ Migration applies cleanly to staging (`supabase db push --db-url "$STAGING_DB_URL"`)
3. ✅ App tested against staging post-migration
4. ✅ Fresh `pg_dump` taken immediately before applying to prod

```bash
# 1. Backup production before risky migrations
pg_dump --no-owner --no-acl \
  -h db.PROD.supabase.co -U postgres -d postgres \
  > backups/pre-migration-XXX-$(date +%Y%m%d-%H%M%S).sql

# 2. Apply to production
supabase db push --db-url "$PROD_DB_URL"

# 3. Verify
supabase migration list --db-url "$PROD_DB_URL"
```

## Migration Flow

```
┌──────────────────┐
│  Local Dev       │
│  supabase db     │
│  reset           │
└────────┬─────────┘
         │ PR to develop
         ▼
┌──────────────────┐
│  CI Check        │
│  (migration-     │
│   check job)     │
└────────┬─────────┘
         │ Manual push
         ▼
┌──────────────────┐
│  Staging         │
│  supabase db     │
│  push --db-url   │
└────────┬─────────┘
         │ Test, then PR to main
         ▼
┌──────────────────┐
│  Production      │
│  pg_dump backup  │
│  supabase db     │
│  push --db-url   │
└──────────────────┘
```

## Upgrade Triggers

### PITR (Point-in-Time Recovery)

**Status:** NOT enabled

**Rationale:** Cost not justified at single-tenant/zero-revenue stage. Current recovery posture:
- Daily automatic backups
- Migration reproducibility
- Fresh `pg_dump` before risky migrations

This was proven in the 2026-07-11 incident: full recovery, zero net loss.

**Trigger:** Enable PITR the day a second tenant's data enters production, priced into their subscription.

**Storage Objects Limitation:** Supabase backups do NOT include storage bucket objects. Document re-upload is part of the restore runbook.

## Standing Rules

### Database

1. **NO SQL Editor schema changes.** All changes via `supabase/migrations/` only.
2. **No migration to prod without local AND staging rehearsal.**
3. **Risky prod migrations get a fresh `pg_dump` immediately before applying.**
4. **Always use `--db-url` for staging/prod pushes.**

### MANDATORY Remote Database Safety Rules

These rules exist because `supabase db reset --linked` wiped production on 2026-07-11. They are non-negotiable.

1. **`supabase db reset` is LOCAL-ONLY.** It may NEVER be run with `--linked` or against any remote URL. No exceptions. No prompt-confirmation workaround.

2. **NEVER auto-confirm destructive commands.** Never pipe `yes`, `--yes`, `-y`, or any auto-confirmation into a destructive command. A safety prompt you must defeat is a stop sign, not an obstacle.

3. **`supabase link` is FORBIDDEN for staging/prod.** Every remote operation uses explicit `--db-url` with the target host printed and checked against this file immediately before execution.

4. **Destructive/schema-changing commands require explicit go.** Any destructive or schema-changing command against a remote database requires the user's explicit go in the same session, restated, not carried over from a previous session.

### FORBIDDEN Commands

```bash
# NEVER run these against remote databases:
supabase db reset --linked        # FORBIDDEN
supabase db reset --db-url "..."  # FORBIDDEN
supabase link --project-ref ...   # FORBIDDEN for staging/prod
yes | supabase ...                # FORBIDDEN (auto-confirm)
```

### Secrets

1. **Never commit database URLs or API keys.** Use environment variables.
2. **Database dumps are sensitive.** Never commit, delete after use.
3. **Staging uses sanitized data only.** No production PII.

### Git Flow

1. `develop` → staging deployments (Vercel preview)
2. `main` → production deployments
3. Feature branches → PRs to `develop`
4. `develop` → PRs to `main` (after staging validation)

## Environment Variables by Scope

### Local Development (`.env.local`)

```bash
# Supabase (from supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>

# Anthropic
ANTHROPIC_API_KEY=<truebid-dev-key>

# Optional
SHIPLEY_PDF_URL=<if-available>
```

### Staging (Vercel Environment)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://XXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>

# Anthropic
ANTHROPIC_API_KEY=<truebid-staging-key>

# Optional
SHIPLEY_PDF_URL=<if-available>
```

### Production (Vercel Environment)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://XXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-key>

# Anthropic
ANTHROPIC_API_KEY=<truebid-prod-key>

# Optional
SHIPLEY_PDF_URL=<if-available>
```

## CI/CD Jobs

The following jobs run on every PR and push:

| Job | Purpose | Required Check |
|-----|---------|----------------|
| `lint` | ESLint validation | Yes |
| `typecheck` | TypeScript compilation | Yes |
| `test` | Jest unit tests | Yes |
| `migration-check` | Apply all migrations from scratch | Yes |
| `working-data-check` | Enforce `working_data` freeze | Yes |

Configure these as required checks in GitHub branch protection settings for `main` and `develop`.

## Troubleshooting

### Local Supabase won't start

```bash
# Check Docker is running
docker ps

# Full reset
supabase stop
docker system prune -f
supabase start
```

### Migration fails locally but works in CI

```bash
# Ensure you're on the same migration chain
supabase migration list
supabase db reset  # Full reset to baseline
```

### "Permission denied" on staging/prod

1. Verify you're using the correct project URL
2. Check the service role key is correct
3. Ensure RLS isn't blocking your operation

### Auth redirect not working on staging

Verify these redirect URLs are configured in Supabase dashboard:
- `https://*-truebid.vercel.app/**`
- `https://staging.truebid.io/**` (if applicable)

---

## Incident Record

### 2026-07-11: Production Database Wiped

**What happened:** Claude ran `yes | supabase db reset --linked` while the CLI was linked to production (`qtotsijebcpddipmzstb`) instead of staging. The `yes |` bypassed the CLI's safety confirmation prompt.

**Timeline:**
- 16:09:46 - Linked to staging (tcobyquewjootwxpqijq)
- 16:10:01 - Linked to production (qtotsijebcpddipmzstb)
- 16:25:31 - Ran `yes | supabase db reset --linked` — **PRODUCTION WIPED**
- 16:26:53 - Linked back to staging (too late)

**Root cause:** Did not re-verify which project was linked before running destructive command. Auto-confirmed a safety prompt.

**Resolution:** Restored from Supabase automatic backup. Added mandatory safety rules to CLAUDE.md and this file.

**Prevention:** The four mandatory rules above were added to prevent recurrence.
