# API Contract Documentation

**Verified complete against code as of 18a69b409e9f6afe65e67bbe404ab8cca5d4e958**

This document describes all command-backed API endpoints. It serves as the UI build contract.

**Maintenance rule:** Keep this document current as new command-backed endpoints are added.

---

## Table of Contents

1. [Proposal Endpoints](#proposal-endpoints)
2. [Intelligence Endpoints](#intelligence-endpoints)
3. [WBS Endpoints](#wbs-endpoints)
4. [Labor Catalog Endpoints](#labor-catalog-endpoints-phase-5)
5. [Error Code Reference](#error-code-reference)
6. [Type Coercion Notes](#type-coercion-notes)

---

## Proposal Endpoints

### GET `/api/proposals`

List all proposals for the authenticated user's company.

**Inputs:** None

**Outputs:**
```json
{
  "proposals": [
    {
      "id": "uuid",
      "title": "Proposal Title",
      "solicitation": "FA8075-24-R-0001",
      "client": "DOD",
      "status": "draft" | "in_progress" | "submitted" | "won" | "lost",
      "totalValue": 1500000,
      "dueDate": "2024-03-15T00:00:00Z" | null,
      "updatedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T09:00:00Z",
      "teamSize": 5,
      "progress": 45,
      "starred": false,
      "archived": false,
      "contractType": "tm" | "ffp" | "cpff" | "idiq" | "hybrid",
      "periodOfPerformance": "Base + 4 Option Years",
      "workingData": {}
    }
  ]
}
```

**Error Shapes:**
- `401` - Unauthorized

---

### POST `/api/proposals`

Create a new proposal.

**Command:** `CreateProposal` (via `createCreateProposalCommand`)

**Inputs:**
```json
{
  "title": "New Proposal",           // Required
  "solicitation_number": "FA8075-24-R-0001",  // Optional
  "agency": "DOD",                   // Optional
  "contract_type": "tm",             // Optional (default: "tm")
  "due_date": "2024-03-15",          // Optional
  "description": "Description"       // Optional
}
```

**Outputs:**
```json
{
  "proposal": {
    "id": "uuid",
    "title": "New Proposal",
    "solicitation": "FA8075-24-R-0001",
    "client": "DOD",
    "status": "draft",
    "totalValue": 0,
    "dueDate": "2024-03-15T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "teamSize": 0,
    "progress": 0,
    "starred": false,
    "archived": false,
    "contractType": "tm",
    "periodOfPerformance": "",
    "workingData": {}
  }
}
```

**Error Shapes:**
- `400` - Validation error (title required)
- `401` - Unauthorized
- `404` - No company found for user
- `500` - Internal error

---

### GET `/api/proposals/[id]`

Fetch a single proposal with requirements and WBS elements.

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "proposal": {
    "id": "uuid",
    "title": "Proposal Title",
    "solicitation": "FA8075-24-R-0001",
    "client": "DOD",
    "status": "draft",
    "totalValue": 1500000,
    "dueDate": "2024-03-15T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-01T09:00:00Z",
    "teamSize": 5,
    "progress": 45,
    "starred": false,
    "archived": false,
    "contractType": "tm",
    "periodOfPerformance": "Base + 4 Option Years",
    "workingData": {},
    "strategy": {},
    "aiSummary": null,
    "requirements": [],
    "wbsElements": []
  }
}
```

**Error Shapes:**
- `401` - Unauthorized
- `500` - Internal error

---

### PUT `/api/proposals/[id]`

Update proposal fields.

**Command:** `UpdateProposalMetadata` (via `createUpdateProposalMetadataCommand`)

**Inputs:**
```json
{
  "title": "Updated Title",          // Optional
  "solicitation_number": "string",   // Optional
  "agency": "DOD",                   // Optional
  "contract_type": "tm",             // Optional
  "due_date": "2024-03-15",          // Optional
  "total_value": 1500000,            // Optional
  "status": "in_progress",           // Optional
  "starred": true,                   // Optional
  "archived": false,                 // Optional
  "working_data": {},                // Optional (merged with existing)
  "strategy": {},                    // Optional
  "ai_summary": "string"             // Optional
}
```

**Outputs:**
```json
{
  "proposal": { /* same shape as GET */ }
}
```

**Error Shapes:**
- `401` - Unauthorized
- `500` - Internal error

---

### DELETE `/api/proposals/[id]`

Delete a proposal (hard delete, cascades to requirements/WBS).

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "success": true
}
```

**Note:** For soft-delete (archive), use `PUT` with `archived: true` or the `ArchiveProposal` command.

**Error Shapes:**
- `401` - Unauthorized
- `500` - Internal error

---

### Archive Proposal (Command-only)

**Command:** `ArchiveProposal` (via `createArchiveProposalCommand`)

Soft-deletes a proposal by setting `archived: true`. Supports optimistic concurrency.

**Input:**
```typescript
{
  proposalId: string
  expectedVersion?: number  // Optimistic concurrency
}
```

**Output:**
```typescript
{
  id: string
  archived: boolean
  rowVersion: number
}
```

**Error Codes:**
- `NOT_FOUND` - Proposal not found or not accessible
- `STALE_VERSION` - Concurrent modification detected

---

## Intelligence Endpoints

### GET `/api/proposals/[id]/intelligence`

Load the current intelligence version with all facts.

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "version": {
    "id": "uuid",
    "versionNumber": 1,
    "status": "draft" | "confirmed" | "superseded",
    "confirmationHash": "sha256-hash" | null,
    "contractType": "FFP" | "T&M" | "IDIQ" | "BPA" | "CPFF" | "unknown" | null,
    "extractedAt": "2024-01-15T10:30:00Z",
    "confirmedAt": "2024-01-15T11:00:00Z" | null,
    "rowVersion": 1
  },
  "periods": [
    {
      "id": "uuid",
      "name": "Base Period",
      "months": 12,
      "cumulativeMonthsEnd": 12,
      "gsaRateYear": 1,
      "sortOrder": 0
    }
  ],
  "disciplines": [
    {
      "id": "uuid",
      "discipline": "engineering" | "design" | "research" | etc.,
      "confidence": "high" | "medium" | "low",
      "sourceText": "string" | null
    }
  ],
  "laborRequirements": [
    {
      "id": "uuid",
      "title": "Senior Developer",
      "laborCategory": "string" | null,
      "hoursPerMonth": 160 | null,
      "utilizationPct": 100 | null,
      "appearsInPeriods": ["Base Period"],
      "confidence": "high" | "medium" | "low",
      "sourceText": "string" | null
    }
  ],
  "factsJson": {
    "documentType": { "value": "RFP", "confidence": "high" },
    "vehicle": { "value": "GSA MAS", "confidence": "medium" },
    "contractType": { "value": "T&M", "confidence": "high" },
    "setAside": { "value": "small_business", "confidence": "medium" },
    "rateSource": { "value": "gsa_mas", "confidence": "high" }
  }
}
```

**If no intelligence version exists:**
```json
{
  "version": null,
  "periods": [],
  "disciplines": [],
  "laborRequirements": [],
  "factsJson": {}
}
```

**Error Shapes:**
- `401` - Unauthorized (no session or invalid tenant)
- `500` - Internal error

---

### PATCH `/api/proposals/[id]/intelligence`

Update facts on a draft intelligence version.

**Command:** `UpdateIntelligenceFacts` (via `createUpdateIntelligenceFactsCommand`)

**Inputs:**
```json
{
  "versionId": "uuid",           // Required
  "expectedVersion": 1,           // Optional (optimistic concurrency)
  "factsJson": { ... },           // Optional
  "contractType": "FFP",          // Optional
  "periods": [ ... ],             // Optional (replaces all periods)
  "disciplines": [ ... ],         // Optional (replaces all disciplines)
  "laborRequirements": [ ... ]    // Optional (replaces all labor reqs)
}
```

**Outputs:**
```json
{
  "version": {
    "id": "uuid",
    "rowVersion": 2
  }
}
```

**Error Shapes:**
- `400` - Version is not draft (`INVALID_STATE`)
- `404` - Version not found
- `409` - Version conflict (`STALE_VERSION`)
- `401` - Unauthorized

---

### POST `/api/proposals/[id]/intelligence/confirm`

Confirm a draft intelligence version. Computes SHA-256 hash from fresh DB read-back.

**Command:** `ConfirmIntelligenceVersion` (via `createConfirmIntelligenceVersionCommand`)

**Inputs:**
```json
{
  "versionId": "uuid",       // Optional (defaults to current draft)
  "expectedVersion": 1       // Optional (optimistic concurrency)
}
```

**Outputs:**
```json
{
  "version": {
    "id": "uuid",
    "confirmationHash": "sha256-64-char-hex",
    "confirmedAt": "2024-01-15T11:00:00Z",
    "rowVersion": 2
  }
}
```

**Error Shapes:**
- `400` - Version is already confirmed/superseded (`INVALID_STATE`)
- `404` - Version not found
- `409` - Version conflict (`STALE_VERSION`)
- `401` - Unauthorized

---

### POST `/api/proposals/[id]/intelligence/supersede`

Create a new draft version from the current confirmed version.

**Command:** `SupersedeIntelligenceVersion` (via `createSupersedeIntelligenceVersionCommand`)

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "newVersion": {
    "id": "uuid",
    "versionNumber": 2
  },
  "supersededVersionId": "uuid"
}
```

**Error Shapes:**
- `400` - No confirmed version to supersede (`INVALID_STATE`)
- `404` - Proposal not found
- `401` - Unauthorized

---

## WBS Endpoints

### POST `/api/proposals/[id]/generate-wbs`

Generate WBS candidate from confirmed intelligence. Creates a versioned WBS candidate that must be reviewed and accepted.

**Command:** `CreateWbsCandidate` (via `createWbsCandidate`)

**Gate:** Requires confirmed intelligence version. Returns error if intelligence is not confirmed or hash verification fails.

**Inputs:**
```json
{
  "intelligenceVersionId": "uuid",    // Optional (defaults to active version)
  "selectedRequirementIds": ["uuid"]  // Optional (filters requirements)
}
```

**Outputs:**
```json
{
  "candidateVersionId": "uuid",
  "versionNumber": 2,
  "taskCount": 37,
  "assignmentCount": 112,
  "workPackageCount": 9,
  "catalogResolution": {
    "exactMatches": 8,
    "aliasMatches": 3,
    "fuzzyMatches": 1,
    "unmappedCount": 0
  }
}
```

**Error Shapes:**
- `400` - Intelligence not confirmed (`INTELLIGENCE_REQUIRED`, `NOT_CONFIRMED`)
- `400` - WBS validation failed (`VALIDATION_FAILED`) with `violations` array
- `400` - No requirements found
- `404` - Proposal not found, intelligence version not found (`NOT_FOUND`)
- `500` - Hash verification failed (`HASH_MISMATCH`)
- `401` - Unauthorized

---

### GET `/api/proposals/[id]/wbs/candidate`

Fetch the latest WBS candidate with diff against active version.

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "hasCandidate": true,
  "candidateVersionId": "uuid",
  "candidateVersionNumber": 2,
  "candidateStatus": "generated_candidate" | "draft",
  "candidateRowVersion": 1,
  "generationNote": "AI-generated from 15 requirements",
  "createdAt": "2024-01-15T10:30:00Z",
  "hasActive": true,
  "activeVersionId": "uuid" | null,
  "diff": {
    "totalTasks": 45,
    "addedTasks": 8,
    "changedTasks": 3,
    "removedTasks": 2,
    "conflictTasks": 1,
    "totalConflicts": 2,
    "taskDiffs": [
      {
        "status": "added" | "changed" | "removed" | "conflict" | "unchanged",
        "wbsCode": "WBS-01.01",
        "title": "Task name",
        "hasUserModifiedConflict": false,
        "assignmentSummary": {
          "total": 5,
          "added": 2,
          "changed": 1,
          "conflicts": 0
        }
      }
    ]
  }
}
```

**If no candidate:**
```json
{
  "hasCandidate": false,
  "hasActive": true,
  "activeVersionId": "uuid" | null,
  "activeVersionNumber": 1 | null
}
```

**Error Shapes:**
- `401` - Unauthorized
- `500` - Internal error

---

### POST `/api/proposals/[id]/wbs/candidate`

Accept or discard a WBS candidate.

**Commands:**
- `AcceptWbsCandidate` (via `acceptWbsCandidate`)
- `DiscardWbsCandidate` (via `discardWbsCandidate`)

**Inputs:**
```json
{
  "action": "accept" | "discard",
  "candidateVersionId": "uuid",
  "expectedRowVersion": 1,
  "conflictResolutions": [    // Optional, only for accept
    {
      "taskId": "uuid",
      "assignmentId": "uuid" | null,
      "resolution": "keep_user" | "accept_candidate"
    }
  ]
}
```

**Outputs (accept):**
```json
{
  "success": true,
  "action": "accepted",
  "activeVersionId": "uuid",
  "supersededVersionId": "uuid" | null,
  "conflictsResolved": 2
}
```

**Outputs (discard):**
```json
{
  "success": true,
  "action": "discarded"
}
```

**Error Shapes:**
- `400` - Missing required fields, invalid action
- `404` - Candidate not found for this proposal
- `409` - Version conflict (`STALE_VERSION`)
- `401` - Unauthorized

---

### WBS Task Commands (Command-only, no REST endpoint)

These commands are available for direct use but are not exposed as REST endpoints. They support inline editing in the UI.

#### UpdateWbsTask

**Command:** `updateWbsTask`

Updates a WBS task on a draft or active version. Sets `user_modified = true`.

**Input:**
```typescript
{
  taskId: string
  expectedRowVersion: number
  title?: string
  description?: string
  deliverable?: string
  sowReference?: string
  startMonth?: number
  endMonth?: number
}
```

**Output:** `WbsTask` object

**Errors:**
- `WbsTaskNotFoundError` - Task not found
- `WbsTaskStaleError` - Concurrent modification
- `WbsTaskImmutableError` - Version is superseded

---

#### AddWbsTask

**Command:** `addWbsTask`

Adds a new user-created task to a WBS version.

**Input:**
```typescript
{
  wbsVersionId: string
  wbsCode: string
  title: string
  description?: string
  deliverable?: string
  sowReference?: string
  startMonth?: number
  endMonth?: number
  parentTaskId?: string
  sortOrder?: number
}
```

**Output:** `WbsTask` object

---

#### RemoveWbsTask

**Command:** `removeWbsTask`

Removes a task from a WBS version.

**Input:**
```typescript
{
  taskId: string
  expectedRowVersion: number
}
```

---

### Staffing Assignment Commands (Command-only, no REST endpoint)

#### UpdateStaffingAssignment

**Command:** `updateStaffingAssignment`

Updates a staffing assignment. Sets `user_modified = true`.

**Input:**
```typescript
{
  assignmentId: string
  expectedRowVersion: number
  roleTitle?: string
  discipline?: string
  primeOrSub?: "prime" | "sub"
  subcontractorName?: string
  periodLabel?: string
  hours?: number
  hoursPerMonth?: number
  rationale?: string
}
```

**Output:** `StaffingAssignment` object

---

#### AddStaffingAssignment

**Command:** `addStaffingAssignment`

Adds a new staffing assignment to a task.

**Input:**
```typescript
{
  wbsTaskId: string
  roleTitle: string
  discipline: string
  primeOrSub: "prime" | "sub"
  subcontractorName?: string
  periodLabel: string
  hours: number
  hoursPerMonth?: number
  rationale?: string
}
```

**Output:** `StaffingAssignment` object

---

#### RemoveStaffingAssignment

**Command:** `removeStaffingAssignment`

Removes a staffing assignment.

**Input:**
```typescript
{
  assignmentId: string
  expectedRowVersion: number
}
```

---

### GET `/api/proposals/[id]/roles`

Fetch projected roles from staffing_assignments + labor catalog.

**Field-location split (Phase 5):**
- Hours by period: from `staffing_assignments` table
- Salary: from `tenant_labor_categories.levels` OR `staffing_assignments.salary_override_cents`
- Level/step: from `staffing_assignments.level_key`, `step_index`
- Rate source: from `staffing_assignments.rate_source` ('catalog' | 'manual')
- Indirect rates: from `company_settings` table
- Legacy pricing: from `working_data.roles` (read-only fallback)

**Inputs:** None (proposal ID in URL)

**Outputs:**
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "Back-end Developer",
      "fte": 0.75,
      "hoursByYear": {
        "baseYear": 1440,
        "oy1": 1440,
        "oy2": 960,
        "oy3": 0,
        "oy4": 0
      },
      "totalHoursFromWBS": 3840,
      "currentSalary": 120000,
      "billRateBase": 123.71,
      "profitMargin": 0.10,
      "laborCategory": "Software Developer",
      "isManual": false
    }
  ],
  "hasActiveWbs": true,
  "wbsVersionId": "uuid" | null
}
```

**Error Shapes:**
- `401` - Unauthorized
- `500` - Internal error

---

## Labor Catalog Endpoints (Phase 5)

### GET `/api/tenant/disciplines`

List tenant disciplines.

**Status:** Documented but not yet implemented as REST endpoint. Available via commands.

**Outputs:**
```json
{
  "disciplines": [
    { "key": "engineering", "displayName": "Engineering", "sortOrder": 10, "active": true }
  ]
}
```

---

### GET `/api/tenant/labor-categories`

List tenant labor categories with optional filtering.

**Status:** Documented but not yet implemented as REST endpoint. Available via commands.

**Query params:** `?discipline=engineering&active=true`

**Outputs:**
```json
{
  "categories": [
    {
      "id": "uuid",
      "key": "backend_developer",
      "title": "Back-end Developer",
      "disciplineKey": "engineering",
      "levels": { "levels": [{ "level": "IC3", "steps": [120000, 126000] }] },
      "hasSalaryData": true
    }
  ]
}
```

---

### POST `/api/tenant/labor-categories/resolve`

Resolve a role title to a catalog category.

**Status:** Documented but not yet implemented as REST endpoint. Available via `resolveLaborCategory` function.

**Inputs:**
```json
{
  "roleTitle": "HCD Lead"
}
```

**Outputs:**
```json
{
  "matchType": "exact" | "alias" | "fuzzy" | "unmapped",
  "confidence": 0.95,
  "categoryId": "uuid" | null,
  "categoryTitle": "UX Researcher",
  "aliasUsed": "HCD Lead",
  "contextNote": "Work is studies, synthesis, interviews, usability testing"
}
```

---

### Labor Catalog Commands (Available)

These commands are implemented and available for use:

#### CreateLaborCategory

**Command:** `createLaborCategory`

Creates a new labor category in the tenant catalog.

**Input:**
```typescript
{
  tenantId: string
  key: string              // Unique key (e.g., "backend_developer")
  title: string            // Display title
  disciplineKey: string    // Must match existing discipline
  sortOrder?: number
  levels?: LevelConfig
}
```

---

#### UpdateLaborCategory

**Command:** `updateLaborCategory`

Updates an existing labor category.

**Input:**
```typescript
{
  categoryId: string
  title?: string
  disciplineKey?: string
  sortOrder?: number
  active?: boolean
  levels?: LevelConfig
}
```

---

#### AddCategoryAlias

**Command:** `addCategoryAlias`

Adds an alias to a labor category for resolution matching.

**Input:**
```typescript
{
  categoryId: string
  alias: string
}
```

---

## Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | No session or invalid credentials |
| `FORBIDDEN` | 403 | User lacks required role |
| `NOT_FOUND` | 404 | Resource not found or not accessible |
| `STALE_VERSION` | 409 | Optimistic concurrency conflict |
| `VALIDATION_FAILED` | 400 | Input validation failed |
| `INVALID_STATE` | 400 | Resource in wrong state for operation |
| `INTELLIGENCE_REQUIRED` | 400 | WBS generation requires confirmed intelligence |
| `NOT_CONFIRMED` | 400 | Intelligence version not confirmed |
| `NOT_ACTIVE` | 400 | Intelligence version not active for proposal |
| `HASH_MISMATCH` | 500 | Hash verification failed (data tampering) |
| `WRONG_PROPOSAL` | 400 | Version doesn't belong to proposal |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Type Coercion Notes

PostgreSQL types are coerced as follows when loading intelligence data:

| Postgres Type | JavaScript Type | Notes |
|--------------|-----------------|-------|
| `NUMERIC` | `number` | Postgres returns strings, must parseFloat |
| `UUID` | `string` | Lowercase for consistent hashing |
| `TIMESTAMPTZ` | `string` | ISO8601 format |
| `BOOLEAN` | `boolean` | |
| `JSONB` | `object` | Keys sorted recursively for hashing |

This coercion is critical for hash consistency between confirm-time and guard-time.

---

## Command Layer Summary

All command-backed operations follow this pattern:

```typescript
import { runCommand, createXxxCommand } from '@/lib/commands'

const command = createXxxCommand(supabase)
const result = await runCommand(supabase, command, input)

if (result.success) {
  // result.data contains output
} else {
  // result.error contains { code, message }
}
```

### Commands by Domain

**Proposals:**
- `createCreateProposalCommand`
- `createArchiveProposalCommand`
- `createUpdateProposalMetadataCommand`

**Intelligence:**
- `createCreateIntelligenceDraftCommand`
- `createUpdateIntelligenceFactsCommand`
- `createConfirmIntelligenceVersionCommand`
- `createSupersedeIntelligenceVersionCommand`

**WBS:**
- `createWbsCandidate`
- `acceptWbsCandidate`
- `discardWbsCandidate`
- `updateWbsTask`
- `updateStaffingAssignment`
- `addWbsTask`
- `addStaffingAssignment`
- `removeWbsTask`
- `removeStaffingAssignment`

**Labor Catalog (Phase 5):**
- `createLaborCategory`
- `updateLaborCategory`
- `addCategoryAlias`
- `resolveLaborCategory` (query)
- `bulkResolveLaborCategories` (query)
