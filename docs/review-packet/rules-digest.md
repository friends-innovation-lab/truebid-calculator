# Rules Digest

Generated from CLAUDE.md as of commit 18a69b409e9f6afe65e67bbe404ab8cca5d4e958 on 2026-07-12

---

## Remote Database Safety Rules

**Rule:** `supabase db reset` is LOCAL-ONLY; may NEVER be run with `--linked` or against any remote URL. No exceptions. No prompt-confirmation workaround. — **Origin:** `supabase db reset --linked` wiped production on 2026-07-11. — **Date:** 2026-07-11

**Rule:** NEVER auto-confirm destructive commands; never pipe `yes`, `--yes`, `-y`, or any auto-confirmation into a destructive command. A safety prompt you must defeat is a stop sign, not an obstacle. — **Origin:** Production wipe incident on 2026-07-11. — **Date:** 2026-07-11

**Rule:** This repo is NEVER linked to staging or production; the `supabase/.temp/` directory must not exist when working with remote databases. Delete it before any remote operation. — **Origin:** Production wipe incident on 2026-07-11. — **Date:** 2026-07-11

**Rule:** All remote migrations go through `scripts/db-push-remote.sh`; direct use of `supabase db push` against a remote database is FORBIDDEN. Script requires explicit `--db-url`, prints target host, validates against `docs/ENVIRONMENTS.md`, refuses if `supabase/.temp/` exists, requires typing target project ref to confirm. — **Origin:** Production wipe incident on 2026-07-11. — **Date:** 2026-07-11

**Rule:** Destructive/schema-changing commands require explicit go in the same session, restated, not carried over from a previous session. — **Origin:** Production wipe incident on 2026-07-11. — **Date:** 2026-07-11

---

## working_data Freeze

**Rule:** No new writers to `working_data` may be introduced; no new keys may be added. All new persistence uses normalized tables + commands. Existing writers continue until their domain migrates (Phases 2-3). — **Origin:** Phase 1 Integrity Spine architecture decision to migrate away from unstructured JSONB storage. — **Date:** Phase 1 implementation

---

## Testing Standards

**Rule:** A test that does not execute the code under test may NEVER be reported as PASS; tests must invoke the actual implementation to qualify as passing. — **Origin:** Discovery of tests that passed without executing runtime code, giving false confidence. — **Date:** Not specified

**Rule:** Shape/type assertions must be labeled separately ("Shape Assertion" or "Type Check"), counted separately in every test report, and not included in "Tests Passed" counts. — **Origin:** Need to distinguish structural checks from behavioral verification in test reporting. — **Date:** Not specified

**Rule:** Test reports must include: Executed Tests count, Shape/Type Assertions count, and Skipped count (with reason). — **Origin:** Standardization of test reporting format after discovering tests without execution. — **Date:** Not specified

**Rule:** Integration tests must connect to actual database (local Supabase for unit/integration, staging for E2E), execute actual commands/queries, and verify actual state changes in the database. — **Origin:** Need to ensure integration tests perform real database operations. — **Date:** Not specified

---

## E2E User Path Rule

**Rule:** E2E flows must exercise the user's actual path; an API-level pass does not verify a UI capability. E2E tests must navigate the UI, trigger actions through components, and verify the full flow a user would experience. Testing `/api/foo` directly does not prove the button that calls it works. — **Origin:** Discovery that API-level tests did not catch UI integration failures. — **Date:** Not specified

---

## Eval-per-AI-Change Rule

**Rule:** Any prompt, schema, or model change in the active AI pipeline requires an eval run with report included in completion summary showing Extraction F1, discipline violations (target: zero), and schema validation pass rate. — **Origin:** Need to verify AI pipeline changes do not regress extraction quality. — **Date:** Not specified

---

## Deployment SHA Rule

**Rule:** Deployment reports must include the commit SHA; "Deployed" without a SHA is not a report. State both the SHA deployed and where it was verified (e.g., Vercel dashboard, `git log origin/main`). — **Origin:** Need for traceability between deployment claims and actual deployed code. — **Date:** Not specified

---

## Migration Coding Standards

**Rule:** All PL/pgSQL variables must use `v_` prefix (e.g., `v_prop`, `v_count`, `v_status`) to prevent ambiguity with table column names. No exceptions. — **Origin:** Migration failures caused by variable names conflicting with column names in PostgreSQL. — **Date:** Not specified

**Rule:** Migration failures trigger whole-file audit; the fix must audit the entire file for the same bug class—never a single-line fix. If one variable name conflicts with a column, check ALL variables in the file. — **Origin:** Pattern of migration failures where single-line fixes missed other instances of the same bug class. — **Date:** Not specified

---

## No-SQL-Editor Rule

**Rule:** NO schema changes via SQL Editor; migrations only. All database changes must go through versioned migration files in `supabase/migrations/`. Never use the Supabase dashboard SQL editor for schema changes—it creates tracking drift between the migration history and actual schema. — **Origin:** Schema drift discovered between migration history and actual database state due to ad-hoc SQL editor changes. — **Date:** Not specified

---

## Credential Handling Rules

**Rule:** Credential confirmations must not restate the secret; when confirming a secret was not persisted, state the non-persistence fact without repeating the secret value itself. — **Origin:** Security practice to avoid secret exposure in logs, reports, or conversation history. — **Date:** Not specified

**Rule:** Never commit the Shipley PDF URL to the repository (referenced via `SHIPLEY_PDF_URL` env var). — **Origin:** Protection of proprietary knowledge base URL. — **Date:** Not specified
