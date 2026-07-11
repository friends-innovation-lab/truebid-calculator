# API Contract Documentation

This document describes the command-backed API endpoints. It serves as the UI build contract.

**Maintenance rule:** Keep this document current as new command-backed endpoints are added.

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

**Error Shapes:**
- `401` - Unauthorized (no session or invalid tenant)
- `500` - Internal error

---

### PATCH `/api/proposals/[id]/intelligence`

Update facts on a draft intelligence version.

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

## WBS Generation Endpoint

### POST `/api/proposals/[id]/generate-wbs`

Generate Work Breakdown Structure from confirmed intelligence.

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
  "wbsElements": [
    {
      "id": "uuid",
      "ref": "WBS-01",
      "wbsNumber": "WBS-01",
      "title": "Work Package Name",
      "description": "Description",
      "tasks": [ ... ],
      "laborEstimates": [ ... ],
      "totalHours": 1920,
      "requirementLinks": ["uuid"],
      "dependencies": [],
      "assumptions": ["..."],
      "isAIGenerated": true
    }
  ],
  "roles": [ ... ],
  "count": 8,
  "rolesCount": 11
}
```

**Error Shapes:**
- `400` - Intelligence not confirmed (`INTELLIGENCE_REQUIRED`, `NOT_CONFIRMED`)
- `400` - No requirements found
- `404` - Proposal not found, intelligence version not found (`NOT_FOUND`)
- `500` - Hash verification failed (`HASH_MISMATCH`)
- `401` - Unauthorized

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
