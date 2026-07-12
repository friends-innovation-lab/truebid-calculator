# TrueBid Sequence Flows

Generated as of commit 18a69b409e9f6afe65e67bbe404ab8cca5d4e958 on 2026-07-12

This document contains three Mermaid sequence diagrams illustrating the critical data flows in TrueBid's proposal intelligence and pricing systems.

---

## 1. Intelligence to WBS Flow

Shows the complete pipeline from document upload through WBS acceptance, highlighting gate enforcement points where `requireConfirmedIntelligence` guards the flow.

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant UploadAPI as /api/proposals/{id}/documents
    participant ClassifyAPI as /api/proposals/{id}/intelligence/classify
    participant ReviewUI as Intelligence Review UI
    participant ConfirmAPI as /api/proposals/{id}/intelligence/confirm
    participant GenerateWBS as /api/proposals/{id}/generate-wbs
    participant AcceptWBS as AcceptWbsCandidate Command
    participant DB as Supabase DB

    %% Upload Phase
    User->>UploadAPI: Upload RFP document(s)
    UploadAPI->>DB: Store in solicitation_documents
    UploadAPI-->>User: Document stored

    %% Classification Phase
    User->>ClassifyAPI: Trigger extraction
    ClassifyAPI->>DB: Create intelligence_versions (status: draft)
    ClassifyAPI->>DB: Create intelligence_periods
    ClassifyAPI->>DB: Create intelligence_disciplines
    ClassifyAPI->>DB: Create intelligence_labor_requirements
    ClassifyAPI-->>User: Draft intelligence ready for review

    %% Review Phase
    User->>ReviewUI: Review extracted facts
    ReviewUI->>DB: Read draft version + fact tables
    User->>ReviewUI: Edit/adjust facts (periods, disciplines, roles)
    ReviewUI->>DB: Update fact tables (only while draft)

    %% Confirmation Phase (GATE 1)
    User->>ConfirmAPI: Confirm intelligence
    ConfirmAPI->>DB: Read-back all facts
    ConfirmAPI->>ConfirmAPI: Compute SHA-256 hash
    Note over ConfirmAPI: Hash = SHA-256(canonical JSON of<br/>version + periods + disciplines + labor_reqs)
    ConfirmAPI->>DB: Set status='confirmed', confirmation_hash
    ConfirmAPI->>DB: Set proposals.active_intelligence_version_id
    ConfirmAPI-->>User: Confirmed with hash

    %% WBS Generation (GATE 2)
    User->>GenerateWBS: Generate WBS
    GenerateWBS->>GenerateWBS: requireConfirmedIntelligence()
    Note over GenerateWBS: GATE: Verifies version exists,<br/>status='confirmed', is active,<br/>and hash matches recomputed value
    alt Guard Fails
        GenerateWBS-->>User: 400 INTELLIGENCE_REQUIRED / HASH_MISMATCH
    end
    GenerateWBS->>DB: Load tenant_labor_categories for AI prompt
    GenerateWBS->>GenerateWBS: Call Claude API with requirements
    GenerateWBS->>GenerateWBS: Validate against Zod schema
    GenerateWBS->>DB: Create wbs_versions (status: generated_candidate)
    GenerateWBS->>DB: Create wbs_tasks
    GenerateWBS->>DB: Create staffing_assignments
    GenerateWBS-->>User: Candidate version ready for review

    %% WBS Review
    User->>ReviewUI: Review WBS candidate
    ReviewUI->>DB: Read candidate tasks + assignments
    User->>ReviewUI: Edit tasks/hours (sets user_modified=true)

    %% WBS Acceptance (GATE 3)
    User->>AcceptWBS: Accept WBS candidate
    AcceptWBS->>AcceptWBS: requireWbsVersionWithRowVersion()
    Note over AcceptWBS: GATE: Verifies candidate status<br/>and optimistic concurrency
    AcceptWBS->>DB: Get current active version (if any)
    AcceptWBS->>AcceptWBS: Resolve conflicts (keep_user by default)
    AcceptWBS->>DB: Set old active to status='superseded'
    AcceptWBS->>DB: Set candidate to status='active'
    AcceptWBS-->>User: WBS activated
```

---

## 2. Pricing Resolution Path

Shows how salary is resolved from multiple sources in priority order: assignment override, tenant catalog lookup, and legacy fallback.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Roles & Pricing UI
    participant Projection as projectRoles()
    participant Engine as Pricing Engine
    participant Assignment as staffing_assignments
    participant Catalog as tenant_labor_categories
    participant Legacy as working_data.roles

    UI->>Projection: Load roles for proposal

    %% Step 1: Load staffing data
    Projection->>Assignment: Query active WBS assignments
    Assignment-->>Projection: hours, role_title, period_label,<br/>salary_override_cents, labor_category_id,<br/>level_key, step_index

    %% Step 2: For each unique role, resolve salary
    loop For each unique role_title
        alt Has salary_override_cents (Priority 1)
            Note over Projection: Source: Direct override on assignment
            Projection->>Projection: salary = salary_override_cents / 100
            Projection->>Projection: rateSource = 'manual_override'
        else Has labor_category_id + level_key (Priority 2)
            Projection->>Catalog: Lookup tenant_labor_categories by ID
            Catalog-->>Projection: levels JSON
            Projection->>Projection: Extract levels[level_key].steps[step_index]
            Note over Projection: Source: Catalog lookup<br/>levels.levels[].level + steps[]
            Projection->>Projection: rateSource = 'catalog'
        else Has matching working_data.roles (Priority 3 - Legacy)
            Projection->>Legacy: Find by role name
            Legacy-->>Projection: currentSalary
            Note over Projection: Source: Legacy working_data<br/>Frozen - no new writes
            Projection->>Projection: rateSource = 'working_data'
        else No match (Fallback)
            Note over Projection: Use DEFAULT_SALARIES hardcoded map
            Projection->>Projection: salary = DEFAULT_SALARIES[role] || 120000
            Projection->>Projection: rateSource = 'default'
        end

        %% Step 3: Calculate fully burdened rate
        Projection->>Engine: calculateFullyBurdenedRate({<br/>  annualSalary: salary,<br/>  rates: { fringe, overhead, ga },<br/>  profitRate<br/>})
        Note over Engine: base_hourly = salary / 2080<br/>fringe_amount = base_hourly * fringe<br/>overhead_base = base_hourly + fringe<br/>overhead_amount = overhead_base * overhead<br/>ga_base = overhead_base + overhead<br/>ga_amount = ga_base * ga<br/>cost = ga_base + ga_amount<br/>profit = cost * profitRate<br/>fully_burdened = cost + profit
        Engine-->>Projection: PricingBreakdown { fullyBurdenedRate, ... }

        %% Step 4: Build role projection
        Projection->>Projection: Aggregate hours by period
        Projection->>Projection: Calculate FTE = totalHours / (years * 1920)
    end

    Projection-->>UI: ProjectedRolesResult {<br/>  roles: Role[],<br/>  hasActiveWbs: boolean,<br/>  wbsVersionId: string<br/>}

    %% UI renders the pricing
    UI->>UI: Display rate breakdown per role
    UI->>UI: Allow override edits
```

**Salary Resolution Priority:**

| Priority | Source | Field Path | Notes |
|----------|--------|------------|-------|
| 1 | Assignment Override | `staffing_assignments.salary_override_cents` | User manually set |
| 2 | Catalog Lookup | `tenant_labor_categories.levels[level][step]` | Phase 5 migration |
| 3 | Legacy Fallback | `working_data.roles[].currentSalary` | Frozen, no new writes |
| 4 | Hardcoded Default | `DEFAULT_SALARIES[role]` | Last resort |

---

## 3. Gate Enforcement Points

Shows every location where `requireConfirmedIntelligence`, WBS guards, or DB triggers stand between a request and a write operation.

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant APIRoute as API Route / Command
    participant Guard as Guard Function
    participant DBTrigger as DB Trigger
    participant DB as Database

    %% === INTELLIGENCE GATES ===
    rect rgb(240, 248, 255)
        Note over Client,DB: INTELLIGENCE CONFIRMATION GATE
        Client->>APIRoute: POST /intelligence/confirm
        APIRoute->>Guard: getCurrentIntelligenceVersion()
        Guard->>DB: Check version exists, status='draft'
        alt Not draft
            Guard-->>APIRoute: 400 "already confirmed/superseded"
        end
        APIRoute->>APIRoute: Compute SHA-256 hash from DB read-back
        APIRoute->>DB: UPDATE status='confirmed', confirmation_hash
        DB->>DBTrigger: BEFORE UPDATE trigger
        Note over DBTrigger: check_intelligence_version_immutability()<br/>Allows draft->confirmed transition
        DBTrigger-->>DB: RETURN NEW
    end

    %% === WBS GENERATION GATE ===
    rect rgb(255, 248, 240)
        Note over Client,DB: WBS GENERATION GATE (requires confirmed intelligence)
        Client->>APIRoute: POST /proposals/{id}/generate-wbs
        APIRoute->>Guard: requireConfirmedIntelligence()
        Guard->>DB: Load intelligence_versions by ID
        Guard->>Guard: Check: version.tenant_id = context.tenant_id
        Guard->>Guard: Check: version.proposal_id = proposalId
        Guard->>Guard: Check: version.status = 'confirmed'
        Guard->>DB: Check: proposals.active_intelligence_version_id = versionId
        Guard->>Guard: Recompute hash from DB
        Guard->>Guard: Check: computed_hash = confirmation_hash
        alt Any check fails
            Guard-->>APIRoute: NOT_FOUND / NOT_CONFIRMED /<br/>NOT_ACTIVE / HASH_MISMATCH
            APIRoute-->>Client: 400/404/500 error
        end
        Guard-->>APIRoute: { valid: true, version, periods, disciplines, laborRequirements }
        APIRoute->>DB: INSERT wbs_versions, wbs_tasks, staffing_assignments
    end

    %% === WBS ACCEPTANCE GATE ===
    rect rgb(248, 255, 240)
        Note over Client,DB: WBS ACCEPTANCE GATE
        Client->>APIRoute: Accept WBS Candidate
        APIRoute->>Guard: requireWbsVersionWithRowVersion()
        Guard->>DB: Load wbs_versions by ID
        Guard->>Guard: Check: status IN ('generated_candidate', 'draft')
        Guard->>Guard: Check: row_version = expectedRowVersion
        alt Status invalid or stale
            Guard-->>APIRoute: WbsVersionWrongStatusError / WbsVersionStaleError
            APIRoute-->>Client: 400/409 error
        end
        APIRoute->>DB: UPDATE old active -> status='superseded'
        DB->>DBTrigger: BEFORE UPDATE trigger
        Note over DBTrigger: v_block_superseded_wbs_mutation()<br/>Blocks if OLD.status='superseded'
        DBTrigger-->>DB: RETURN NEW (allowed: active->superseded)
        APIRoute->>DB: UPDATE candidate -> status='active'
    end

    %% === IMMUTABILITY TRIGGERS ===
    rect rgb(255, 240, 245)
        Note over Client,DB: DB TRIGGER ENFORCEMENT (Immutability)

        Note over DBTrigger: INTELLIGENCE IMMUTABILITY
        Client->>APIRoute: Attempt to modify confirmed version
        APIRoute->>DB: UPDATE intelligence_versions
        DB->>DBTrigger: check_intelligence_version_immutability()
        Note over DBTrigger: IF OLD.status='confirmed' AND NOT (supersede transition)<br/>RAISE EXCEPTION
        DBTrigger--xDB: EXCEPTION "Cannot modify confirmed"

        Note over DBTrigger: FACT TABLE IMMUTABILITY
        Client->>APIRoute: Attempt to modify periods/disciplines/labor_reqs
        APIRoute->>DB: UPDATE intelligence_periods
        DB->>DBTrigger: check_fact_table_parent_draft()
        DBTrigger->>DB: SELECT status FROM intelligence_versions
        Note over DBTrigger: IF parent_status != 'draft'<br/>RAISE EXCEPTION
        DBTrigger--xDB: EXCEPTION "Cannot modify when parent is confirmed"

        Note over DBTrigger: WBS IMMUTABILITY
        Client->>APIRoute: Attempt to modify superseded WBS
        APIRoute->>DB: UPDATE wbs_tasks
        DB->>DBTrigger: v_block_child_mutation_on_superseded()
        DBTrigger->>DB: SELECT status FROM wbs_versions
        Note over DBTrigger: IF parent_status='superseded'<br/>RAISE EXCEPTION
        DBTrigger--xDB: EXCEPTION "Cannot modify superseded WBS"

        Note over DBTrigger: ACTIVE WBS DELETE PROTECTION
        Client->>APIRoute: Attempt to delete active WBS
        APIRoute->>DB: DELETE FROM wbs_versions
        DB->>DBTrigger: v_block_active_wbs_delete()
        Note over DBTrigger: IF OLD.status='active'<br/>RAISE EXCEPTION
        DBTrigger--xDB: EXCEPTION "Cannot delete active WBS"
    end
```

---

## Gate Summary Table

| Gate | Location | Function/Trigger | Enforces |
|------|----------|------------------|----------|
| Intelligence Confirmation | `POST /intelligence/confirm` | Command layer | Draft -> Confirmed transition with hash |
| WBS Generation | `POST /generate-wbs` | `requireConfirmedIntelligence()` | Confirmed + active + hash verified |
| WBS Acceptance | `AcceptWbsCandidate` | `requireWbsVersionWithRowVersion()` | Status + optimistic concurrency |
| Intelligence Immutability | DB Trigger | `check_intelligence_version_immutability()` | Blocks confirmed/superseded mutations |
| Fact Table Immutability | DB Trigger | `check_fact_table_parent_draft()` | Blocks when parent not draft |
| WBS Superseded Immutability | DB Trigger | `v_block_superseded_wbs_mutation()` | Blocks all superseded mutations |
| WBS Task/Assignment Immutability | DB Trigger | `v_block_child_mutation_on_superseded()` | Cascades immutability to children |
| Active WBS Delete Protection | DB Trigger | `v_block_active_wbs_delete()` | Must supersede before delete |

---

## Hash Verification Flow

The `requireConfirmedIntelligence` guard performs cryptographic verification:

```
1. Load intelligence_versions row
2. Verify: tenant_id, proposal_id, status='confirmed'
3. Verify: is active version for proposal
4. Call loadAndHashIntelligence():
   a. Load periods, disciplines, labor_requirements
   b. Coerce all rows to canonical form
   c. Build CoercedIntelligenceVersion object
   d. canonicalize() -> sorted JSON string
   e. SHA-256 hash
5. Compare computed hash to stored confirmation_hash
6. On mismatch: return HASH_MISMATCH (indicates tampering)
```

This ensures that WBS generation only proceeds when the intelligence data is exactly as it was when confirmed, providing an audit trail and preventing data corruption.
