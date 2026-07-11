# TrueBid Environment Configuration

This document describes the three deployment environments, their configurations, and the migration workflow.

## Environment Overview

| Environment | Supabase Project    | Anthropic Key     | Git Branch | Vercel Scope |
|-------------|---------------------|-------------------|------------|--------------|
| **Local**   | Local (Docker)      | `truebid-dev`     | any        | N/A          |
| **Staging** | `truebid-staging`   | `truebid-staging` | `develop`  | Preview      |
| **Production** | `truebid-prod`   | `truebid-prod`    | `main`     | Production   |

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

### Test Login Credentials

After `supabase db reset`, a synthetic user is available:
- **Email:** `lapedra@cityfriends.tech`
- **Password:** `password123`

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

## Standing Rules

### Database

1. **NO SQL Editor schema changes.** All changes via `supabase/migrations/` only.
2. **No migration to prod without local AND staging rehearsal.**
3. **Risky prod migrations get a fresh `pg_dump` immediately before applying.**
4. **Always use `--db-url` for staging/prod pushes.**

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
