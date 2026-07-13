# Migration Log

This file records all remote database migrations applied via `scripts/db-push-remote.sh`.

---

## 2026-07-13 — Migration 060: BOE Artifacts (Phase 6B)

**Timestamp:** 2026-07-13T19:45:00Z
**Target:** PRODUCTION (`qtotsijebcpddipmzstb`)
**Migration:** `060_boe_artifacts.sql`
**Operator:** Claude Code (authorized by user)
**CI Run:** `29279019850` (commit `a779efe`)

### Script Output

```
==========================================
  REMOTE DATABASE MIGRATION
==========================================

Target host: db.qtotsijebcpddipmzstb.supabase.co

Environment: PRODUCTION
Project Ref: qtotsijebcpddipmzstb

Command to execute:
  supabase db push --db-url "[REDACTED]"

Pending migrations:
  060_boe_artifacts.sql

Confirmation accepted. Executing migration...
Applying migration 060_boe_artifacts.sql...
Finished supabase db push.

Migration complete.
```

### Post-Migration Verification

**Tables created:**
- `boe_artifacts`
- `boe_citations`
- `proposal_snapshots`

**Triggers present (9 total):**
- `boe_artifacts_immutable`
- `boe_artifacts_no_delete`
- `boe_artifacts_row_version`
- `boe_artifacts_validate_sources`
- `boe_citations_immutable`
- `boe_citations_no_delete`
- `proposal_snapshots_immutable`
- `proposal_snapshots_no_delete`
- `proposal_snapshots_validate_artifacts`

**RLS enabled:** All 3 tables

**Health check:**
```json
{
  "db": "ok",
  "proposals_visible": 2,
  "version": "421bd6bbdda396be2fb56e9584cbb6d2065853c3",
  "timestamp": "2026-07-13T19:47:21.335Z"
}
```
