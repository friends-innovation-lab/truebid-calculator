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

---

## 2026-07-13 — Migrations 061-062: Extraction UI Prep

**Timestamp:** 2026-07-13T22:XX:XXZ (session time)
**Target:** STAGING (`tcobyquewjootwxpqijq`)
**Migrations:**
- `061_solicitation_brief.sql` — fact_evidence table + solicitation_brief column
- `062_proposed_requirement_links.sql` — requirement_link status enum + transition trigger

**Operator:** Claude Code (authorized by user)
**Branch:** `feature/extraction-ui-prep`

### Script Output

```
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 061_solicitation_brief.sql
 • 062_proposed_requirement_links.sql

 [Y/n]
Applying migration 061_solicitation_brief.sql...
Applying migration 062_proposed_requirement_links.sql...
Finished supabase db push.
```

### Post-Migration Verification

See migration 063 below for trigger fix and proofs.

---

## 2026-07-13 — Migration 063: Fix fact_evidence Trigger

**Timestamp:** 2026-07-13T22:58:00Z
**Target:** STAGING (`tcobyquewjootwxpqijq`)
**Migration:** `063_fix_fact_evidence_trigger.sql`
**Operator:** Claude Code (authorized by user)
**Branch:** `feature/extraction-ui-prep`

### Context

Migration 061 applied `check_fact_table_parent_draft()` to `fact_evidence`, but that function expects a column named `version_id`. The `fact_evidence` table uses `intelligence_version_id`. This migration creates a dedicated function.

### Script Output

```
==========================================
  REMOTE DATABASE MIGRATION
==========================================

Target host: db.tcobyquewjootwxpqijq.supabase.co

Environment: STAGING
Project Ref: tcobyquewjootwxpqijq

Command to execute:
  supabase db push --db-url "[REDACTED]"

Pending migrations:
  063_fix_fact_evidence_trigger.sql

Confirmation accepted. Executing migration...
Applying migration 063_fix_fact_evidence_trigger.sql...
Finished supabase db push.

Migration complete.
```

### Post-Migration Trigger Proofs

**Test 2a: INSERT fact_evidence under confirmed version → REJECTED**
```sql
INSERT INTO fact_evidence (intelligence_version_id, quote_text)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test quote that should be rejected');
```
Result:
```
ERROR:  Cannot modify fact_evidence when parent intelligence version is confirmed (intelligence_version_id: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb)
CONTEXT:  PL/pgSQL function check_fact_evidence_parent_draft() line 17 at RAISE
```
✅ PASS

**Test 2b: UPDATE accepted requirement_link status → REJECTED**
```sql
UPDATE requirement_links
SET status = 'proposed'
WHERE id = '346d1b1c-6923-410e-a85e-be947d6e05b4';
```
Result:
```
ERROR:  Cannot change status of non-proposed requirement link (id: 346d1b1c-6923-410e-a85e-be947d6e05b4, current status: accepted)
CONTEXT:  PL/pgSQL function check_requirement_link_status_transition() line 10 at RAISE
```
✅ PASS

**Test 2c: proposed → accepted succeeds and resolved_at auto-stamps**
```sql
-- Create proposed link
INSERT INTO requirement_links (requirement_id, wbs_task_id, status, link_source, suggesting_evidence, proposed_at)
VALUES ('22222222-6666-0001-6666-222222222222', 'e2e22222-2222-2222-2222-222222222222', 'proposed', 'ai', 'Test evidence', now())
RETURNING id, status, resolved_at;
-- Result: id=a7a6218f-5cf9-411e-83ad-148cd31832b3, status=proposed, resolved_at=NULL

-- Transition to accepted
UPDATE requirement_links SET status = 'accepted' WHERE id = 'a7a6218f-5cf9-411e-83ad-148cd31832b3'
RETURNING id, status, resolved_at, resolved_at IS NOT NULL as auto_stamped;
-- Result: status=accepted, resolved_at=2026-07-13 22:58:51.400024+00, auto_stamped=t
```
✅ PASS

---

## 2026-07-14 — Migrations 061-063: Extraction UI Prep (PRODUCTION)

**Timestamp:** 2026-07-14T12:55:00Z
**Target:** PRODUCTION (`qtotsijebcpddipmzstb`)
**Migrations:**
- `061_solicitation_brief.sql` — fact_evidence table + solicitation_brief column
- `062_proposed_requirement_links.sql` — requirement_link status enum + transition trigger
- `063_fix_fact_evidence_trigger.sql` — dedicated trigger function for fact_evidence

**Operator:** Claude Code (authorized by Lapedra)
**CI Run:** `29333570731` (PR #10 commit `b4d65db`)
**Connection:** Via IPv4 pooler (`aws-1-us-east-1.pooler.supabase.com`) due to IPv6 routing issues

### Typed-Ref Confirmation (Verbatim)

```
==========================================
  PRODUCTION MIGRATION via Node.js
==========================================

Target: qtotsijebcpddipmzstb (PRODUCTION)

Typed-ref confirmation: qtotsijebcpddipmzstb
Confirmation accepted.
```

### Script Output

```
Connecting to database...
Connected successfully.

Checking migration status...
Found 61 existing migrations.
Last applied: wbs_versions

[APPLY] 061_solicitation_brief.sql...
[SUCCESS] 061_solicitation_brief.sql
[APPLY] 062_proposed_requirement_links.sql...
[SUCCESS] 062_proposed_requirement_links.sql
[APPLY] 063_fix_fact_evidence_trigger.sql...
[SUCCESS] 063_fix_fact_evidence_trigger.sql

==========================================
  MIGRATION COMPLETE
==========================================
```

### Post-Migration Verification

**1. fact_evidence table:**
```
EXISTS: YES
```

**2. solicitation_brief column on intelligence_versions:**
```
EXISTS: YES
TYPE: jsonb
```

**3. status column on requirement_links:**
```
EXISTS: YES
TYPE: USER-DEFINED (requirement_link_status enum)
DEFAULT: 'accepted'::requirement_link_status
```

**4. Triggers present:**
```sql
SELECT tgname FROM pg_trigger
WHERE tgname LIKE '%fact_evidence%' OR tgname LIKE '%requirement_link%';
```
Result:
```
- enforce_requirement_link_status_transition
- enforce_fact_evidence_parent_draft
```

**5. Negative proof (requirement_links status transition):**
```
No accepted links exist on prod - negative proof skipped.
(Only 2 proposals visible, no WBS/requirement_links generated yet)
```

**6. Health check:**
```json
{
  "db": "ok",
  "proposals_visible": 2,
  "version": "421bd6bbdda396be2fb56e9584cbb6d2065853c3",
  "timestamp": "2026-07-14T12:57:00.468Z"
}
```

✅ All verifications pass
