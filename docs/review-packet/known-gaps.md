# Known Gaps

Generated as of commit 18a69b409e9f6afe65e67bbe404ab8cca5d4e958 on 2026-07-12

This document catalogs known gaps in the TrueBid codebase, verified against source code. Each gap includes its current blast radius.

---

## 1. Single-File Upload UI

**Location:** `/Users/lapedratolson/Projects/truebid-calculator/components/tabs/upload-tab.tsx`

**Verification:** Lines 521-527 show a single file input with `id="file-upload"` accepting only one PDF. The `handleFileUpload()` function (line 213) processes a single `File` object. While the UI displays an "Add Document" button post-upload (lines 757-785) that calls `/api/proposals/{id}/documents`, the primary extraction flow is single-document only.

**Multi-doc API available:** `/api/proposals/[id]/documents/route.ts` provides POST endpoint for additional documents, but the main extraction pipeline (`handleFileUpload`) does not aggregate multiple documents before AI analysis.

**Blast radius:** Users cannot upload multi-volume solicitations (e.g., separate PWS, Instructions, Pricing docs) through the UI. Set-aside classification requiring instructions document is unavailable through UI workflow.

---

## 2. Evidence on Intelligence Facts Only

**Location:** `supabase/migrations/031_intelligence_versions.sql`, `supabase/migrations/032_intelligence_fact_tables.sql`

**Verification:** The `intelligence_versions.facts_json` column (line 35) stores facts with confidence levels but no evidence spans. The `intelligence_disciplines` and `intelligence_labor_requirements` tables include `source_text` columns (032, lines 59, 91) for snippet storage, but there is no `fact_evidence` table or structured text span mapping (start_offset, end_offset, document_id).

**Blast radius:** Cannot trace extracted facts back to exact document locations. Audit/review workflows must rely on free-text `source_text` snippets rather than clickable source navigation.

---

## 3. Requirements as Tag-Strings

**Location:** `supabase/migrations/000_baseline.sql` (lines 136-150)

**Verification:** The `requirements` table stores:
- `reference_number TEXT` - e.g., "REQ-001"
- `title TEXT NOT NULL`
- `description TEXT` - full requirement text
- `type TEXT DEFAULT 'shall'` - simple string enum
- `source TEXT` - free-text source reference

No normalization exists for requirement hierarchy, cross-references, or structured tagging. Requirements are flat text with string-based categorization.

**Blast radius:** Cannot build hierarchical requirement trees, track requirement dependencies, or perform structured compliance rollup. Requirements tab shows flat list only.

---

## 4. Synchronous Extraction

**Location:** `/Users/lapedratolson/Projects/truebid-calculator/app/api/proposals/[id]/extract-requirements/route.ts`

**Verification:** The POST handler (line 63) directly awaits `anthropic.messages.create()` (line 115) without any job queue, background processing, or webhook callback. The response is returned synchronously to the client.

Similarly verified in:
- `extract-contract-intelligence/route.ts` - synchronous `client.messages.create()` (line 94)
- `extract-compliance/route.ts` - synchronous pattern

No worker processes, job queues (BullMQ, SQS), or async webhook patterns exist in the codebase.

**Blast radius:** Long documents may timeout (Vercel function limit ~10s on hobby, 60s on Pro). No retry mechanism for transient AI failures. User must wait for completion with no progress visibility beyond UI spinner.

---

## 5. Frozen Writing Subsystem Routes

**Location:**
- `/Users/lapedratolson/Projects/truebid-calculator/app/api/proposals/[id]/compliance/generate/route.ts`
- `/Users/lapedratolson/Projects/truebid-calculator/app/api/proposals/[id]/compliance/regenerate/route.ts`

**Verification:** Both routes check for `working_data.solicitationRawText`:

**generate/route.ts** (lines 156-158):
```typescript
const workingData = proposalResult.data?.working_data || {}
const solicitationText = workingData.solicitationRawText || ''
```

**regenerate/route.ts** (lines 167-168):
```typescript
const workingData = proposalResult.data?.working_data || {}
const solicitationText = workingData.solicitationRawText || ''
```

Multi-document uploads via `/api/proposals/{id}/documents` store text in `solicitation_documents.raw_text` (per-document), not in `working_data.solicitationRawText`. The compliance routes cannot access multi-document text.

**Blast radius:** Compliance matrix Section L extraction fails silently for multi-document proposals with message "Re-upload RFP to enable Section L extraction". Users who uploaded via multi-doc API cannot generate full compliance matrices.

---

## 6. Legacy UI Surface Area (@ts-nocheck Files)

**Verified line counts:**

| File | Lines |
|------|-------|
| `components/task-decomposition.tsx` | 535 |
| `components/tabs/upload-tab.tsx` | 808 |
| `components/tabs/export-tab.tsx` | 1,629 |
| `components/tabs/rate-justification-tab.tsx` | 1,568 |
| `components/tabs/sub-rates-tab.tsx` | 1,508 |
| `components/tabs/roles-and-pricing-tab.tsx` | 3,420 |
| **Total** | **9,468** |

**Blast radius:** 9,468 lines of TypeScript bypass type checking. Runtime type errors possible in these components. Refactoring carries elevated risk due to missing type safety. IDE autocomplete and error detection disabled in these files.

---

## 7. PITR Absent

**Status:** Supabase Point-in-Time Recovery is not enabled.

**Verification:** No PITR configuration in `supabase/config.toml`. Per CLAUDE.md "Remote Database Safety Rules", the project relies on daily backups only.

**Blast radius:** Data loss window up to 24 hours in disaster scenario. Cannot recover to arbitrary point in time. Manual backup exports required for tighter RPO requirements.

---

## 8. Multi-Document Upload UI Deferred (from CLAUDE.md Known Limitations)

**Location:** CLAUDE.md "Known Limitations" section

**Verification:** Upload-tab.tsx primary flow uses single `handleFileUpload()`. The `handleAddDocument()` function (line 435) exists but only adds supplementary documents after initial extraction - it does not participate in the core extraction flow.

**Blast radius:** Same as Gap #1. Document-set extraction requiring all documents before AI analysis is API-only. SetAside facts requiring instructions document not available via UI.

---

## 9. Compliance Matrix Predates Multi-Document (from CLAUDE.md Known Limitations)

**Location:** CLAUDE.md "Known Limitations" section, verified in Gap #5 above.

**Blast radius:** Compliance matrix generation is incomplete for multi-document proposals. Feature shows graceful empty-state but cannot extract Section L instructions without `solicitationRawText` in `working_data`.

---

## Summary

| Gap | Category | Blast Radius |
|-----|----------|--------------|
| Single-file upload UI | Feature limitation | Multi-volume solicitations unsupported |
| Evidence on facts only | Data model | No source traceability for extracted facts |
| Requirements as tags | Data model | No hierarchical requirement structure |
| Synchronous extraction | Architecture | Timeout risk, no retry/progress |
| Frozen writing routes | Feature freeze | Multi-doc compliance broken |
| Legacy @ts-nocheck | Tech debt | 9,468 lines without type safety |
| PITR absent | Operations | 24-hour data loss window |
| Multi-doc UI deferred | Feature limitation | API-only for document sets |
| Compliance multi-doc | Feature freeze | Section L extraction broken |
