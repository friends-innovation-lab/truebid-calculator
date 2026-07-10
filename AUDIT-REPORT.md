# TrueBid Architectural Audit Report

**Date**: 2026-07-10
**Auditor**: Claude (AI-assisted, full codebase read)
**Scope**: All source files in `app/`, `components/`, `contexts/`, `hooks/`, `lib/`, `scripts/`
**Commit**: `db9ce24` on `develop`

---

## 1. Executive Summary

### Domain Logic Layer — REFACTOR
The pricing math is mostly correct and follows government contracting rules, but it is **duplicated across 5 locations** with one confirmed formula bug. Extract all rate calculations into a single tested module (`lib/rate-calculations.ts`), fix the incorrect formula in `wbs-to-roles.ts`, and add unit tests. This is a week of focused work, not a rebuild.

### AI Layer — REDESIGN
Every AI module uses fragile JSON parsing (manual `indexOf`/regex), none use Claude's structured output feature, and 700+ lines of government contracting domain knowledge are embedded directly in prompt strings. Two divergent WBS generators exist with conflicting logic. The WBS constraint failure (producing engineering roles for PM/HCD contracts) is a direct result of a 293-line system prompt contradicting a 9-line discipline constraint. The prompt architecture needs to be redesigned from scratch, but the extraction schemas and domain knowledge should be ported, not rewritten.

### Data Model — REFACTOR
The `working_data` JSONB structure works but has key duplication (`selectedRoles`/`roles`), unmanaged fields (`contractIntelligence`), and a race condition between 5 competing writers that causes the roles-reverting bug. Fix the sync mechanism and key duplication; the underlying storage model (single JSONB blob per proposal) is adequate for the current scale.

### UI Layer — KEEP (with targeted fixes)
Most components carry real domain logic and would be expensive to regenerate. The main issues are design system violations (~24 raw `<button>` elements, inline error styles) and the 2,800-line `app-context.tsx` that mixes calculation logic with UI state. Extract calculations, fix the violations incrementally. Do not rebuild the UI.

---

## 2. Bucket 1 — Durable Domain Logic

### Module Inventory

| Module | File | Correctness | Separation | Tests | Verdict | Notes |
|--------|------|-------------|------------|-------|---------|-------|
| GSA Schedule Data | `lib/gsa-schedule-data.ts` | **ISSUE**: `getCurrentGSAYear` uses `365` days (no leap year). Will drift. Hardcoded to single contractor (FFTC). Static rates stale after 2028-04-16. | Clean — pure data + utils | None | Port | Year calc should use date comparison, not ms math. Multi-company needed. |
| WBS-to-Roles Sync | `lib/wbs-to-roles.ts` | **BUG**: `calculateBillRate` applies overhead to base salary only, not salary+fringe. Every other location uses correct cascading formula. | Clean — pure logic, but hardcoded `INDIRECT_RATES` duplicate values in app-context | None | Rewrite | See Critical Finding below. |
| BOE Export | `lib/boe-export.ts` | Correct — aggregation logic sound. No rate calculations performed. | Clean — pure document generation | None | Keep | Well-structured DOCX generation. |
| Export Utils (Cost Proposal) | `lib/export-utils.ts` | Rate buildup in audit section is correct (cascading). Hardcodes `2080` for standard hours while system uses configurable `standardHours` (often `1920`). Mock role descriptions at lines 796–840. | Partially tangled — mock data hardcoded; two rate code paths (callback + inline) that could diverge | None | Port | Inline rate formula (audit section) could diverge from callback version. |
| Solicitation Types | `lib/solicitation-type.ts` | Correct | Clean | **Yes** (2 test files, 7 tests) | Keep | Only module with tests. |
| CAMP Scoping Data | `lib/camp-scoping-data.ts` | `console.log` at line 2020 runs at module load. `generateId()` uses `Date.now()` — non-deterministic. `totalHours` manually set rather than computed from `laborEstimates`. | Tangled — mock/demo data lives in `lib/` and is imported at runtime | None | Port | Move to fixtures/seed data. |
| App Context Rate Funcs | `contexts/app-context.tsx:2147–2199` | **Correct** cascading formula. But `calculateLoadedRate` uses `uiProfitMargin / 100` while `calculateFullyBurdenedRate(salary, true)` uses `profitTargets.tmDefault` — two different profit sources. | Tangled — lives inside 2,800-line React Context | None | Port | Extract to `lib/rate-calculations.ts`. |
| Roles & Pricing Tab | `components/tabs/roles-and-pricing-tab.tsx:563–637` | Correct cascade formula. Rates stored as percentages (21.16, not 0.2116). Has `@ts-nocheck`. Debug `console.log` at line 370. | Tangled — domain math in 3,100-line UI component. Own `calculateRateBreakdownStatic`/`calculateRateBreakdown` duplicate app-context. | None | Port | Extract to shared module. |
| Roles Pricing (Staff) | `components/tabs/staff/roles-pricing.tsx:36–72` | `getRateForPeriod` has 3 code paths (sub, GSA, internal). Fallback rate calc at line 146–149 is a copy of cascade formula. | Partially clean — good period abstraction, inline fallback calc | None | Port | Fallback should use shared module. |
| Sub Rate Calculator | `components/tabs/staff/sub-rate-calculator.tsx` | Correct cascade + `minimumViableRate` formula. | Partially clean — calc logic in `useMemo` inside UI component | None | Port | Extract calculation kernel. |
| GSA Bid Tab | `components/tabs/gsa-bid-tab.tsx` | Correct — margin calc, IFF at 0.75%, labor mix % for small business compliance. Uses `calculateLoadedCost` from context (no duplication). | Clean-ish | None | Keep | IFF handling correct. |
| Labor Matrix | `components/tabs/staff/labor-matrix.tsx` | Correct — simple hours aggregation | Clean — pure display | None | Keep | |
| Labor Loading | `components/tabs/staff/labor-loading.tsx` | Correct — FTE = hours / billableHrs | Clean — display | None | Keep | |
| GSA Rates API | `app/api/companies/gsa-rates/route.ts` | CRUD correct. No Zod validation. PUT/DELETE lack company ownership check. | Clean | None | Port | Add validation + ownership check. |
| Roles API | `app/api/companies/roles/route.ts` | CRUD correct. Same ownership gap on PUT/DELETE. | Clean | None | Port | Same fix needed. |
| WBS Schema | `lib/schemas/wbs.ts` | Correct — validates WBS generation request inputs | Clean | None | Keep | |
| Proposal Schema | `lib/schemas/proposal.ts` | Correct — accepts both camelCase and snake_case | Clean | None | Keep | |

### Critical Finding: Rate Formula Inconsistency

Three different rate calculation formulas exist:

**Formula A — CORRECT** (app-context, export-utils, roles-and-pricing-tab, sub-rate-calculator):
```
direct = salary / standardHours
withFringe = direct × (1 + fringe)
withOH = withFringe × (1 + overhead)     ← overhead cascades on salary+fringe
withGA = withOH × (1 + ga)
billed = withGA × (1 + profit)
```

**Formula B — WRONG** (`lib/wbs-to-roles.ts:33–41`):
```
fringe = salary × fringe_rate
overhead = salary × overhead_rate          ← BUG: should be (salary + fringe) × overhead_rate
loaded = salary + fringe + overhead
ga = loaded × ga_rate
perHour = (loaded + ga) / hours
billed = perHour × (1 + profit)
```

**Impact**: For a $120,000 salary with 21.16% fringe and 34.26% overhead:
- Formula A overhead/hr: ($57.69 × 1.2116) × 0.3426 = **$23.93/hr**
- Formula B overhead/hr: $57.69 × 0.3426 = **$19.76/hr**

Rates shown in WBS sync are **~$4/hr lower** than rates shown everywhere else. This cascades into total proposal value calculations when initial roles are created from WBS generation.

### Additional Formula Conflict

`calculateLoadedRate` in app-context uses `uiProfitMargin / 100` (percentage units), while `calculateFullyBurdenedRate(salary, true)` uses `profitTargets.tmDefault` (decimal units). If `uiProfitMargin = 10` (10%) but `profitTargets.tmDefault = 0.08` (8%), these return different values for the same salary.

### Test Coverage

**Essentially zero for domain logic.** Only `cn()` utility and solicitation type helpers have tests. No tests exist for any rate calculation, hours rollup, FTE computation, GSA year mapping, or WBS sync logic.

---

## 3. Bucket 2 — AI Plumbing

### Module Inventory

| Module | File | Model-Era Assumptions | Domain Logic Tangling | Verdict | Notes |
|--------|------|----------------------|----------------------|---------|-------|
| PDF Text Extraction | `app/api/extract-rfp/route.ts` | Hardcoded 150K char truncation (line 62–64); no chunking; `mergePages: true` loses page boundaries | Minimal | Keep | Truncation is silent data loss |
| Top-level WBS Gen | `app/api/generate-wbs/route.ts` | Fragile JSON parsing (indexOf/lastIndexOf, lines 283–288); prompt-based schema; mock data fallback; no structured outputs | **Massive** — role assignments, hours guidance, compliance multipliers, WBS numbering all in prompt (lines 108–213) | Rewrite | Has ZERO discipline awareness. Second WBS generator with divergent logic. |
| Proposal WBS Gen | `app/api/proposals/[id]/generate-wbs/route.ts` | Same fragile JSON parsing (regex `\[[\s\S]*\]` at line 539); 293-line monolithic system prompt; `.stream().finalMessage()` negates streaming benefit | **Extreme** — Team Topologies, SFIA, USDS Play 7, compliance multipliers, sprint math, role mappings all in prompt (lines 7–293) | Rewrite | Primary WBS generator. See WBS Constraint Failure Trace below. |
| Contract Intelligence | `app/api/proposals/[id]/extract-contract-intelligence/route.ts` | Manual JSON parsing; 15K char input truncation (line 132); max_tokens=2000 is tight | Clean — mostly extraction | Port | `confirmed: false` initially — critical gate field |
| Requirements Extraction | `app/api/proposals/[id]/extract-requirements/route.ts` | Uses Haiku 4.5; dynamic ceiling logic (lines 6–12); fragile JSON parsing | Ceiling logic embedded; type enum mismatch: prompt uses `shall|should`, Zod schema has `delivery|reporting|...` | Port | Zod `.catch('other')` silently converts all mismatched types |
| Compliance Extraction | `app/api/proposals/[id]/extract-compliance/route.ts` | temperature=0; full text untruncated | 117-line system prompt embeds all compliance matrix domain knowledge (Section L/M/K/J/C/H) | Port | Domain knowledge should be separated |
| Draft Section | `app/api/proposals/[id]/draft-section/route.ts` | Two-pass generation (outline + prose); SSE streaming correct; 300+ line system prompt | **Extreme** — writing guide, Shipley methodology, FFTC voice, anti-hallucination rules, banned words all in one prompt | Port | Two-pass approach is smart; prompts need extraction |
| Transform Section | `app/api/proposals/[id]/transform-section/route.ts` | Simple pass-through | Hardcoded WORDS_TO_AVOID (lines 6–33) and WRITING_GUIDE (lines 35–69) **duplicate** `lib/writing-guide.ts` | Rewrite | Duplicates shared utility |
| Compliance Generate | `app/api/proposals/[id]/compliance/generate/route.ts` | Up to 3 sequential AI calls; fragile JSON parsing | Section L category-to-section mapping hardcoded (lines 473–481) | Port | 3 AI calls in one request is expensive |
| Compliance Regenerate | `app/api/proposals/[id]/compliance/regenerate/route.ts` | Nearly identical copy of generate route (~400 lines) | Same hardcoded mappings | Rewrite | Should share code with generate |
| Section Draft (DB) | `app/api/proposals/[id]/sections/[sectionId]/draft/route.ts` | Module-level `new Anthropic()` (line 7–9) reads env at import; custom markdown-to-TipTap converter strips all bold/italic (line 336) | TipTap converter should be utility | Port | |
| Outline Generation | `app/api/proposals/[id]/generate-outline/route.ts` | Fragile JSON parsing; no output validation | Proposal structure rules in prompt | Port | |
| Summary Generation | `app/api/proposals/[id]/generate-summary/route.ts` | Two sequential AI calls; fragile JSON parsing | **Hardcoded "Friends From The City" identity** in RELEVANCE_PROMPT | Port | Not multi-tenant safe |
| Win Themes | `app/api/proposals/[id]/generate-win-themes/route.ts` | Fragile JSON parsing; max_tokens=1000 | **Hardcoded company certifications** ("8(a), WOSB, SDVOSB") at line 105 | Port | Not multi-tenant safe |
| Shipley Helper | `lib/shipley.ts` | URL-based PDF document source | Clean utility | Keep | |
| Writing Guide | `lib/writing-guide.ts` | N/A | Clean utility | Keep | |

### Cross-Cutting AI Issues

1. **Every AI module uses fragile JSON parsing.** None use Claude's structured output / tool_use feature. All do manual indexOf, regex, or markdown-fence stripping.
2. **No output validation.** Only `extract-requirements` validates AI output with Zod. All others trust the AI to conform to prompt instructions.
3. **Two divergent WBS generators** (`/api/generate-wbs/` and `/api/proposals/[id]/generate-wbs/`) with completely different prompts, role lists, and constraint handling.
4. **Company-specific content hardcoded** in multiple files (FFTC identity, certifications, indirect rates) rather than loaded from company settings. Not multi-tenant safe.
5. **Code duplication**: `compliance/generate` and `compliance/regenerate` are ~400 lines each, nearly identical. `transform-section` duplicates `lib/writing-guide.ts`.

### WBS Constraint Failure Trace

This traces the exact path showing how confirmed Contract Intelligence discipline constraints are dropped.

**Step 1 — Contract Intelligence Extracted**
`app/api/proposals/[id]/extract-contract-intelligence/route.ts:176–188`
Disciplines extracted (e.g., `["design", "research", "product", "delivery"]` for a PM/HCD contract). Saved to `workingData.contractIntelligence` with `confirmed: false`. User reviews and sets `confirmed: true` in UI.

**Step 2 — WBS Generation reads Contract Intelligence**
`app/api/proposals/[id]/generate-wbs/route.ts:343–345`
```typescript
const intelligence = workingData.contractIntelligence as ContractIntelligence | undefined
const disciplines = intelligence?.disciplines?.required || []
const confirmedRoles = intelligence?.roles || []
```
**PROBLEM 1**: No check of `intelligence.confirmed`. Unconfirmed (potentially incorrect) extractions feed into WBS generation.

**Step 3 — Discipline constraints injected into USER prompt**
`app/api/proposals/[id]/generate-wbs/route.ts:406–415`
```
DISCIPLINE CONSTRAINTS — CRITICAL
This contract requires ONLY these disciplines: design, research, product, delivery
Generate WBS tasks ONLY within these disciplines...
```
This is **9 lines** in the user prompt.

**Step 4 — System prompt CONTRADICTS discipline constraints**
`app/api/proposals/[id]/generate-wbs/route.ts:7–293` (the `SYSTEM_PROMPT` constant)

The 293-line system prompt mandates:

- **Lines 18–29 (Team Topologies)**: "A well-formed stream-aligned team always contains ALL of these capabilities: ...Backend delivery, Platform/infrastructure, Quality assurance..." and "EVERY work package must be evaluated against each capability."
- **Lines 107–122 (USDS Play 7)**: "REQUIRED across the full contract: Technical Lead / Back-end Developer, Front-end Developer, DevOps Engineer, QA Engineer..." and "If any of these roles does NOT appear anywhere in the WBS, that is a gap."
- **Lines 195–212 (PM Rule)**: "ALWAYS create WBS-01 as a dedicated 'Program Management & Delivery' package" with Technical Lead and Design Lead on "every development-heavy package."
- **Lines 258–272 (Available Roles)**: Hardcoded list of 11 roles including all engineering roles.

**ROOT CAUSE**: The system prompt mandates all 8 USDS-required roles (including QA Engineer, Technical Lead, DevOps Engineer, Backend/Frontend Developer) MUST appear. The verification checklist at lines 446–452 reinforces this. When a PM/HCD contract has only design/research disciplines, the model receives two conflicting instructions:
1. User prompt (9 lines): "ONLY these disciplines"
2. System prompt (293 lines + verification checklist): "ALL 8 roles MUST appear"

The system prompt wins because it is 30× longer, reinforced by three frameworks, and has a verification checklist.

**Step 5 — No post-processing filter**
`app/api/proposals/[id]/generate-wbs/route.ts:578–646`
After the AI returns WBS elements, `laborEstimates` are mapped directly from AI output. There is **no code that strips roles violating discipline constraints**. The `syncRolesFromWBS` call at line 675 passes them all through.

**Step 6 — The other WBS generator has no constraints at all**
`app/api/generate-wbs/route.ts` has its own separate system prompt (lines 108–213) with no reference to contract intelligence or discipline constraints. If the frontend ever calls this endpoint, constraints are completely bypassed.

**Constraint Failure Diagram:**
```
Contract Intelligence (confirmed: true)
  └── disciplines: ["design", "research", "product", "delivery"]
       │
       ▼
Proposal WBS Generator
  ├── Does NOT check confirmed flag
  └── Injects 9-line discipline constraint in user prompt
       │
       ▼
System Prompt (293 lines):
  ├── "ALL 8 USDS-required roles MUST appear"
  ├── "EVERY work package evaluated against EACH capability"
  ├── "Technical Lead on every development-heavy package"
  └── Verification checklist requires engineering roles
       │
       ▼
AI resolves conflict → system prompt wins
  └── Generates QA, Tech Lead, DevOps for PM/HCD contract
       │
       ▼
Post-processing: NO discipline filter
  └── All roles pass through → synced to pricing
```

### Domain Logic Embedded in AI Code

| File:Line | Embedded Logic | Impact |
|-----------|---------------|--------|
| `generate-wbs/route.ts:108–213` | Role assignment guidelines, hours allocation, compliance multipliers | Reusable estimating rules locked in prompt text |
| `proposals/[id]/generate-wbs/route.ts:7–293` | Team Topologies, SFIA levels, USDS Play 7, sprint math, role mappings | 290 lines of domain knowledge unreachable by other code |
| `proposals/[id]/extract-requirements/route.ts:6–12` | Requirements ceiling by page count | Domain rule hardcoded |
| `proposals/[id]/re-extract/route.ts:7–13` | Same ceiling logic duplicated | Copy-paste |
| `proposals/[id]/extract-compliance/route.ts:9–117` | Complete compliance matrix domain knowledge (Section L/M/K/J/C/H) | Government proposal structure locked in prompt |
| `proposals/[id]/draft-section/route.ts:181–186` | Blocked content library categories (devops, infrastructure, backend, security) | Business rule in AI handler |
| `proposals/[id]/draft-section/route.ts:222–317` | FFTC voice, good/bad examples, banned words, capability list rules | Company-specific rules should come from DB |
| `proposals/[id]/generate-win-themes/route.ts:105` | Hardcoded company certifications "8(a), WOSB, SDVOSB" | Should come from company settings |
| `lib/wbs-to-roles.ts:10–16` | Hardcoded FFTC indirect rates | Should come from company settings |
| `lib/wbs-to-roles.ts:19–31` | Hardcoded default salaries by role name | Should come from company labor categories |

---

## 4. Bucket 3 — UI and App Shell

### Component Quality

| Component | File | Real Logic? | Cheap to Regenerate? | Verdict |
|-----------|------|-------------|---------------------|---------|
| RolesPricing | `staff/roles-pricing.tsx` | Yes — bill rate calc, period mapping, CI integration | No | Keep, extract rate calc |
| ScopeOfWork | `staff/scope-of-work.tsx` | Yes — WBS management, AI generation, role sync | No | Keep, fix role sync |
| LaborLoading | `staff/labor-loading.tsx` | Yes — FTE capacity analysis | Partially | Keep |
| LaborMatrix | `staff/labor-matrix.tsx` | Yes — cross-tab hours matrix | Partially | Keep |
| ContractIntelligenceCard | `scope/contract-intelligence-card.tsx` | Yes — editable extraction review, period computation | No | Keep |
| Solicitation | `scope/solicitation.tsx` | Yes — PDF viewer, extraction, CI rendering | No | Keep |
| EstimateTab | `estimate-tab.tsx` | Yes — WBS CRUD, requirement linking, charge codes | No | Keep |
| RateJustificationTab | `rate-justification-tab.tsx` | Yes — BLS comparison, premium factors | No | Keep |
| SectionEditor | `write/section-editor.tsx` | Yes — rich text editing, AI generation | No | Keep |
| TechnicalVolume | `write/technical-volume.tsx` | Yes — outline + editor orchestration | Partially | Keep |
| DeliverShare | `deliver/deliver-share.tsx` | Yes — share link management | Partially | Keep |
| Team | `staff/team.tsx` | Moderate — team member management | Yes | Could simplify |

### Design System Violations

**Raw `<button>` instead of `<Button>` (~24 instances):**
- `roles-pricing.tsx`: 11 raw `<button>` (escalation toggle, delete role, close panel, level/step selectors, filter tabs)
- `scope-of-work.tsx`: 7 raw `<button>`
- `contract-intelligence-card.tsx`: Multiple raw `<button>` for disciplines, periods, toggles
- `teaming-partners-tab.tsx`: 6 raw `<button>`
- `deliver-share.tsx`: 4 raw `<button>`

**Inline error text instead of `<ErrorAlert>`:**
- `export-tab.tsx:1283–1284`: Inline `AlertCircle` + `text-red-800` span
- `teaming-partners-tab.tsx:967`: `<p className="text-xs text-red-500">`

**Missing `<EmptyState>`:**
- `labor-matrix.tsx:67–84`: Uses `<Card className="p-12 text-center">` with manual icon/heading

**Inline containers instead of `<Card>`:**
- `roles-pricing.tsx`, `labor-loading.tsx`, `scope-of-work.tsx` use raw divs with inline `style={{ backgroundColor: '#FFFFFF' }}` instead of `<Card>`

**Hardcoded INDIRECT rates duplicated in UI:**
- `roles-pricing.tsx:841`: `const INDIRECT = { fringe: 0.2116, overhead: 0.3426, ga: 0.1983, hoursPerYear: 2080 }`

---

## 5. Sources-of-Truth Map

### `working_data` JSONB Shape

| Key | Writers | Readers | Issues |
|-----|---------|---------|--------|
| `solicitation` | `useProposalSync` save effect | `hydrateContext`, all tabs via context | Merged with API metadata on load |
| `selectedRoles` | `useProposalSync` (line 327) | `hydrateContext` (line 100, **preferred**) | **DUPLICATED** with `roles` |
| `roles` | `useProposalSync` (line 328), `generate-wbs` API (line 684) | `hydrateContext` (line 100, **fallback** for `selectedRoles`) | **DUPLICATED** — same data as `selectedRoles` |
| `estimateWbsElements` | `useProposalSync`, `generate-wbs` API | `hydrateContext` | Two writers (client debounced, server immediate) |
| `contractIntelligence` | `ContractIntelligenceCard` (direct API), RFP extraction | `scope-of-work.tsx`, `roles-pricing.tsx`, `solicitation.tsx` (each loads independently) | **NOT managed by useProposalSync** — bypasses context entirely |
| `subcontractors` | `useProposalSync` | `hydrateContext` | |
| `teamingPartners` | `useProposalSync` | `hydrateContext` | |
| `teamMembers` | `useProposalSync` | `hydrateContext` | |
| `directors` | `useProposalSync` | `hydrateContext` | |
| `rateJustifications` | `useProposalSync` | `hydrateContext` | |
| `odcs` | `useProposalSync` | `hydrateContext` | |
| `perDiem` | `useProposalSync` | `hydrateContext` | |
| `extractedRequirements` | `useProposalSync` | `hydrateContext` | |
| `proposalSetup` | `useProposalSync` | `hydrateContext` | |
| `outline` | `useProposalSync` | `hydrateContext` | |
| `sectionContent` | `useProposalSync` | `hydrateContext` | |
| `gsaEnabled` | `useProposalSync` | `hydrateContext` | |
| `solicitationRawText` | Upload/extraction flow | Preserved via `extraFieldsRef` | Not a MANAGED_FIELD |
| `solicitationSummary` | Extraction flow | `generate-wbs` API route | Not a MANAGED_FIELD |
| `solicitationMetadata` / `metadata` | Extraction flow | `generate-wbs` API route | Not a MANAGED_FIELD |

### Roles Reverting — Root Cause Analysis

There are **5 competing writers** to `selectedRoles`/`roles`:

| # | Writer | Location | When | What It Does |
|---|--------|----------|------|-------------|
| 1 | `hydrateContext` | `use-proposal-sync.ts:100` | Page load | Reads `selectedRoles || roles` from DB, replaces entire context array |
| 2 | `useProposalSync` save | `use-proposal-sync.ts:317–406` | Any context state change + 2s debounce | Writes context snapshot to `working_data.selectedRoles` AND `working_data.roles` |
| 3 | `generate-wbs` API | `generate-wbs/route.ts:683–684` | WBS generation completes | Writes `working_data.roles` only (**NOT** `selectedRoles`) — server-side |
| 4 | `scope-of-work.tsx` sync | `scope-of-work.tsx:166–206` | WBS elements change + 500ms debounce | Calls `syncRolesFromWBS()` → `setSelectedRoles()` — replaces entire array |
| 5 | `scope-of-work.tsx` doGenerate | `scope-of-work.tsx:284–293` | After WBS generation API returns | Calls `setSelectedRoles(roles)` with server response |

**The Race Condition (exact sequence):**

1. User opens proposal → `hydrateContext` loads roles: `[RoleA, RoleB]`
2. User edits RoleA in roles-pricing panel → `updateRole(id, { subRate: 150 })` → context now: `[RoleA{subRate:150}, RoleB]`
3. Save effect fires (2s) → writes `selectedRoles: [RoleA{subRate:150}, RoleB]` to DB ✓
4. User triggers WBS generation (or WBS elements change from another action)
5. `syncRolesFromWBS` runs at `lib/wbs-to-roles.ts:155–256`:
   - Matches existing roles by name (line 180)
   - Builds `SyncedRole` carrying forward ONLY: `id`, `type`, `subcontractorName`, `billRateBase`, `selectedLevel`, `selectedStep`, `currentSalary`, `profitMargin`, `isManual`
   - **Does NOT carry forward**: `subRate`, `subMarkup`, `hoursPerMonth`, `gsaLaborCategory`, `gsaHourlyRate`, `loadedRate`, `description`
6. `mapToRole` at `lib/wbs-to-roles.ts:113–153` builds final `Role` from `SyncedRole` — missing fields are simply absent
7. `setSelectedRoles(syncedRoles)` overwrites the entire array → user's edits are **lost**
8. Save effect fires → writes reverted roles to DB

**Additional sync bug**: The comparison at `scope-of-work.tsx:198` only checks role **names** (not values), so the sync only triggers `setSelectedRoles` when the set of role names changes. However, Writer 5 (`doGenerate`) always replaces, and Writer 3 writes `roles` (not `selectedRoles`) to DB — which is then ignored on next load because `hydrateContext` prefers `selectedRoles`.

**Fix**: Either (a) make `syncRolesFromWBS` spread all `existing` fields via `...existing` instead of cherry-picking, or (b) stop doing destructive array replacement and instead merge changes per-role.

---

## 6. Gate Analysis — Contract Intelligence Confirmation

| Generation Path | File | Frontend Gate | Backend Gate | Can Bypass? |
|----------------|------|--------------|--------------|-------------|
| WBS Generation | `scope-of-work.tsx:246` | `contractIntelligence?.confirmed === true` | **NONE** — reads roles without checking `confirmed` (line 343) | Yes, via direct API call |
| Compliance Matrix | `compliance-matrix.tsx` | None | None | Fully ungated |
| Technical Volume Outline | `outline.tsx`, `sections/generate` | None | None | Fully ungated |
| Section Content Generation | `section-editor.tsx` | None | None | Fully ungated |
| Role Sync from WBS | `scope-of-work.tsx:166` | Triggered automatically on WBS change | N/A (client-side) | Always runs |
| Staffing/Pricing | `roles-pricing.tsx` | None | N/A | Fully ungated |

**Summary**: Only WBS generation has a frontend gate. No server-side validation exists. All other generation paths are completely ungated, meaning they can run with unconfirmed (potentially incorrect) intelligence data.

---

## 7. Edge-Case Test Candidates

### Pricing/Rate Logic

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 1 | `lib/wbs-to-roles.ts:35–38` | Compare `calculateBillRate(120000)` vs `calculateFullyBurdenedRate(120000)` — should match but don't | Confirms the overhead formula bug |
| 2 | `contexts/app-context.tsx:2170` | `uiProfitMargin=10` (10%) vs `profitTargets.tmDefault=0.08` (8%) → different rates for same salary | Dual profit source conflict |
| 3 | `lib/export-utils.ts:989` | Audit package hardcodes `/2080` while company uses 1920 productive hours | Audit shows different rate than rate card |
| 4 | `lib/export-utils.ts:489` | `rate * productiveHours * quantity * yearsToInclude` — if productiveHours differs from billable hours used in rate calc | Total cost wrong |
| 5 | `components/tabs/roles-and-pricing-tab.tsx:571` | Rates stored as percentages (21.16) vs decimals (0.2116) — if context provides decimals, component divides by 100 again | Near-zero rates |
| 6 | `components/tabs/staff/sub-rate-calculator.tsx:172` | `targetMargin = 100%` → division by zero. `> 100%` → negative rate | Unguarded boundary |

### GSA Logic

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 7 | `lib/gsa-schedule-data.ts:44` | Leap year 2024-04-17 — year calculation uses 365 days | Wrong GSA year at contract boundaries |
| 8 | `lib/gsa-schedule-data.ts:326–488` | Cloud SIN (518210C) has null rates years 1–3 | `getGSARate` returns null — what does the UI show? |
| 9 | `components/tabs/staff/roles-pricing.tsx:71` | Escalation applied to GSA rates: `baseRate * Math.pow(1 + escalation, yearIndex)` but GSA rates are fixed per contract year | Escalation should not apply to GSA rate source |

### WBS/Role Sync

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 10 | `lib/wbs-to-roles.ts:117–118` | WBS assigns 5000 hours to single role — capped at billableHrs per year but `totalHoursFromWBS` stays uncapped | Inconsistent hours display |
| 11 | `lib/wbs-to-roles.ts:199` | Labor category has fewer than 3 levels or none | Fallback chain: `levels[2] || levels[0] || DEFAULT_SALARIES || 120000` |
| 12 | `lib/wbs-to-roles.ts:223` | `hoursByYear` caps each year at `billableHrs` independently but `totalHoursFromWBS` stays uncapped | Sum of yearly hours ≠ total |

### AI Extraction

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 13 | `extract-rfp/route.ts:62–64` | RFP where critical Section L/M content past 150K chars | Silently dropped — extraction misses evaluation criteria |
| 14 | `extract-contract-intelligence/route.ts:132` | `solicitationText.slice(0, 15000)` — key intelligence past page 10 | Disciplines/roles missed |
| 15 | `extract-requirements/route.ts:22–26` | AI returns type `shall` but Zod schema expects `delivery|reporting|...` — `.catch('other')` silently converts | All requirements typed "other" |
| 16 | `generate-wbs/route.ts:572–575` | Period name "Option Period 10" `.includes("Option Period 1")` → wrong match | Hours assigned to wrong period |
| 17 | `generate-wbs/route.ts:539` | Greedy regex `\[[\s\S]*\]` matches wrong JSON array if response contains brackets in explanation | Parse failure or wrong data |

### Security/Auth

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 18 | `app/api/companies/gsa-rates/route.ts:140–160` | User A creates a rate, User B PUTs with that rate ID — only auth check, no company_id verification | Cross-company data modification |

### State Management

| # | File:Line | Scenario | Why It Matters |
|---|-----------|----------|---------------|
| 19 | `lib/camp-scoping-data.ts:2020` | `console.log` at module import time | Side effect in production |
| 20 | `contexts/app-context.tsx` | `projectVersions` in client-only state | Versions lost on page refresh |

---

## 8. Risk Register — What Would Be Lost in a Rebuild

| Risk | Location | Why It Matters |
|------|----------|---------------|
| **Cascading rate formula** | `app-context.tsx:2147–2199` | The correct formula (fringe → OH → G&A → profit) took multiple iterations to get right. Must be preserved and centralized. |
| **Period-aware rate escalation** | `staff/roles-pricing.tsx:36–72` | `getRateForPeriod` handles three contract types (sub, GSA, internal) with year-over-year escalation. Nuanced logic. |
| **GSA IFF deduction** | `gsa-bid-tab.tsx:162` | IFF at 0.75% of revenue deducted from profit. Small but required for GSA compliance. |
| **Labor mix small business compliance** | `gsa-bid-tab.tsx:159` | Internal vs. sub revenue ratio for small business rules. |
| **TipTap ↔ markdown converter** | `sections/[sectionId]/draft/route.ts:216–341` | Custom parser handles heading levels, lists, paragraphs. Fragile but functional. |
| **Two-pass section drafting** | `draft-section/route.ts` | Pass 1 generates outline, Pass 2 writes prose. This architecture produces better content than single-pass. |
| **Shipley PDF integration** | `lib/shipley.ts` + `sections/[sectionId]/coach/route.ts` | External knowledge base for coaching scoring. |
| **Contract type mappings** | `use-proposal-sync.ts:19–39` | Bidirectional mapping between dashboard types (`tm`, `ffp`) and context types (`T&M`, `FFP`) plus edge cases (`CPFF` → `ffp`, `IDIQ` → `hybrid`). |
| **Extra fields preservation** | `use-proposal-sync.ts:243–249` | `extraFieldsRef` preserves unmanaged working_data fields (like `solicitationRawText`) during save cycles. Loss = silent data destruction. |
| **Content library blocking** | `draft-section/route.ts:181–186` | Specific content categories (devops, infrastructure, backend, security) blocked from PM/HCD proposals. Business rule. |
| **Compliance Section L mapping** | `compliance/generate/route.ts:473–481` | Category-to-section mapping for Section L compliance. Government-specific domain knowledge. |
| **BOE document structure** | `lib/boe-export.ts` | DOCX generation with proper government BOE format — hours rollups, risk scores, section structure. |

---

## 9. Open Questions — For Lapedra

1. **Is the rate formula in `wbs-to-roles.ts` (overhead on base only) intentional or a bug?** Every other location cascades overhead on salary+fringe. If intentional, the reasoning should be documented.

2. **Should `contractIntelligence` be promoted to a managed context field?** Currently three components load it independently via `proposalsApi.get()`, creating independent copies. This is the most obvious architectural gap.

3. **Is the top-level `/api/generate-wbs/` route still used?** It has zero discipline awareness and divergent logic from the proposal-specific version. If dead code, it should be removed. If used, it's a constraint bypass.

4. **What is the intended behavior when a user edits roles between WBS generations?** The current sync destroys user edits. Options: (a) sync preserves all existing fields via spread, (b) sync only adds new roles and updates hours (never removes/resets), (c) roles are fully decoupled from WBS after initial generation.

5. **Are the hardcoded FFTC values (indirect rates, certifications, company identity) expected to become multi-tenant?** Several AI prompts and `wbs-to-roles.ts` reference FFTC-specific data. This determines whether we extract to company settings or just keep them as defaults.

6. **Is `projectVersions` (client-only state, lost on refresh) still a desired feature?** If so, it needs persistence. If not, the dead code should be removed.

7. **Are both compliance routes (`generate` and `regenerate`) needed as separate endpoints?** They are ~400 lines each and nearly identical. Merging would halve the maintenance surface.

8. **What is the intended scope of `solicitationRawText` and `solicitationSummary`?** These live in `working_data` but outside the MANAGED_FIELDS list. The `extraFieldsRef` mechanism preserves them during saves, but they're invisible to the type system.

---

*End of audit. No code was modified during this review.*
