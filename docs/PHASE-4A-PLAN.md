# Phase 4A Implementation Plan — Structured Outputs, Prompt Architecture, Eval Harness

**Date**: 2026-07-11
**Status**: PENDING REVIEW
**Prerequisite**: Read CLAUDE.md, docs/ENVIRONMENTS.md, docs/HANDOVER-2026-07-11.md, docs/API-CONTRACT.md, AUDIT-REPORT.md (Bucket 2)

---

## 1. Active-Path AI Route Inventory

Every route below uses manual JSON parsing. None use Claude's structured outputs.

| Route | File | Model | Current Parsing | Zod Schema | Truncation | Frozen? |
|-------|------|-------|-----------------|------------|------------|---------|
| **extract-contract-intelligence** | `app/api/proposals/[id]/extract-contract-intelligence/route.ts` | claude-sonnet-4 | `.replace(/```json\|```/g)` + `JSON.parse` (line 163) | None (TypeScript interfaces only) | 15K chars (line 134) | No |
| **extract-requirements** | `app/api/proposals/[id]/extract-requirements/route.ts` | claude-haiku-4.5 | `indexOf` + `JSON.parse` (lines 136-141) | `extractionResponseSchema` | Inherits 150K from PDF | No |
| **extract-compliance** | `app/api/proposals/[id]/extract-compliance/route.ts` | claude-sonnet-4 | `indexOf` + `JSON.parse` (lines 232-242) | None | None | No |
| **generate-wbs** | `app/api/proposals/[id]/generate-wbs/route.ts` | claude-sonnet-4 | Regex `/\[[\s\S]*\]/` + `JSON.parse` (line 728) | `ParsedWbsElement` interface | Disciplines filter only | No |
| **generate-summary** | `app/api/proposals/[id]/generate-summary/route.ts` | claude-sonnet-4 | `indexOf` + `JSON.parse` (lines 151-159) | `aiSummarySchema` | None | No |
| **generate-outline** | `app/api/proposals/[id]/generate-outline/route.ts` | claude-sonnet-4 | Regex `/\{[\s\S]*\}/` + `JSON.parse` (lines 147-153) | None | None | **YES** |
| **extract-rfp** | `app/api/extract-rfp/route.ts` | None (PDF only) | N/A | N/A | 150K chars (lines 62-65) | No |

### Frozen Writing Subsystem (DO NOT TOUCH)

| Route | File | Parsing |
|-------|------|---------|
| draft-section | `app/api/proposals/[id]/draft-section/route.ts` | SSE streaming (two-pass) |
| draft-subsection | `app/api/proposals/[id]/draft-subsection/route.ts` | SSE streaming |
| transform-section | `app/api/proposals/[id]/transform-section/route.ts` | Direct text response |
| coach-section | `app/api/proposals/[id]/sections/[sectionId]/coach/route.ts` | JSON.parse (manual shape) |
| generate-win-themes | `app/api/proposals/[id]/generate-win-themes/route.ts` | JSON.parse |
| collaborate/coach | `app/api/collaborate/[token]/coach/route.ts` | JSON.parse |
| collaborate/transform | `app/api/collaborate/[token]/transform/route.ts` | Direct text |
| compliance/generate | `app/api/proposals/[id]/compliance/generate/route.ts` | indexOf + JSON.parse |
| compliance/regenerate | `app/api/proposals/[id]/compliance/regenerate/route.ts` | indexOf + JSON.parse |

**Note:** `generate-outline` is borderline — it creates proposal structure from Section L. It saves to `working_data.outline` which feeds into the frozen writing flow. I will leave it unchanged unless explicitly told otherwise.

### FFTC Hardcoding Found

| Location | Content |
|----------|---------|
| `generate-wbs/route.ts:197` | "FFTC's Delivery Manager and Product Manager are FULL-TIME (1.0 FTE) on every project" |
| `generate-wbs/route.ts:260` | "Available FFTC roles (use ONLY these 11):" |
| `generate-summary/route.ts:179` | `fftcRelevance` variable name, win themes correlation |
| `generate-summary/route.ts:31-39` | RELEVANCE_PROMPT asks about "this company" position |

---

## 2. Structured Outputs Conversion

### Approach

Use Anthropic's tool-use pattern for schema-constrained output:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  tools: [{
    name: 'extract_intelligence',
    description: 'Extract contract intelligence from RFP',
    input_schema: contractIntelligenceSchema  // JSON Schema
  }],
  tool_choice: { type: 'tool', name: 'extract_intelligence' },
  messages: [...]
})

// Response is in tool_use block — already JSON, no parsing needed
const toolUse = response.content.find(b => b.type === 'tool_use')
const parsed = contractIntelligenceSchema.parse(toolUse.input)
```

### Routes to Convert (5 active-path routes)

1. **extract-contract-intelligence**
   - Create `lib/schemas/contract-intelligence.ts` with Zod schema
   - Schema includes: documentType, vehicle, contractType, setAside, rateSource, periods, disciplines, laborRequirements
   - All with confidence levels and optional sourceText

2. **extract-requirements**
   - Fix enum mismatch: prompt says `shall|should`, Zod says `delivery|reporting|...`
   - Decision: Change prompt to match Zod enum (domain-correct values)
   - Remove `.catch('other')` silent coercion — let validation fail visibly

3. **extract-compliance**
   - Create `lib/schemas/compliance.ts` with Zod schema
   - Schema: array of `{ ref, rfpSection, type, text, source }`
   - Type enum: `instruction|evaluation|certification|deliverable|technical|special`

4. **generate-wbs**
   - Create `lib/schemas/wbs-generation.ts` with Zod schema
   - Schema matches `ParsedWbsElement[]` interface but enforced at runtime
   - Output feeds into `CreateWbsCandidate` command

5. **generate-summary**
   - Already has `aiSummarySchema` — convert to tool-use pattern
   - Keep two-pass (summary + relevance) but both use structured outputs

### Error Handling

```typescript
type AIExtractionResult<T> =
  | { success: true; data: T }
  | { success: false; error: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'REPAIR_FAILED'; raw?: string }

// One repair pass max
async function extractWithSchema<T>(
  client: Anthropic,
  schema: ZodSchema<T>,
  messages: Message[],
  systemPrompt: string
): Promise<AIExtractionResult<T>> {
  const response = await client.messages.create({...})
  const toolUse = response.content.find(b => b.type === 'tool_use')

  if (!toolUse) return { success: false, error: 'PARSE_ERROR' }

  const validated = schema.safeParse(toolUse.input)
  if (validated.success) return { success: true, data: validated.data }

  // One repair pass
  const repairResponse = await attemptRepair(client, schema, toolUse.input, validated.error)
  const repairValidated = schema.safeParse(repairResponse)

  if (repairValidated.success) return { success: true, data: repairValidated.data }
  return { success: false, error: 'REPAIR_FAILED', raw: JSON.stringify(toolUse.input) }
}
```

---

## 3. Prompt Architecture

### New Directory Structure

```
lib/ai/
├── index.ts                    # Public exports
├── extract.ts                  # extractWithSchema helper
├── company-context.ts          # FFTC identity (interim — tenant-sourced Phase 5)
├── prompts/
│   ├── extract-intelligence.ts
│   ├── extract-requirements.ts
│   ├── extract-compliance.ts
│   ├── generate-wbs.ts
│   └── generate-summary.ts
└── knowledge/
    ├── index.ts
    ├── team-shapes.ts          # Role compositions by discipline
    ├── hours-heuristics.ts     # Hours estimation bands
    ├── compliance-multipliers.ts
    ├── wbs-numbering.ts
    └── disciplines.ts          # Discipline definitions and role mappings
```

### company-context.ts (Interim FFTC Extraction)

```typescript
// Single source for company identity — tenant-sourced in Phase 5
export const COMPANY_CONTEXT = {
  name: 'Friends From The City (FFTC)',
  certifications: ['8(a)', 'WOSB', 'SDVOSB'],
  coreCapabilities: [
    'Human-centered design',
    'Agile software development',
    'Digital transformation'
  ],
  laborCategories: [
    'Back-end Developer',
    'Front-end Developer',
    'DevOps Engineer',
    'QA Engineer',
    'Product Manager',
    'Product Designer',
    'UX Researcher',
    'Content/UX Writer',
    'Delivery Manager',
    'Technical Lead',
    'Design Lead'
  ]
} as const
```

### knowledge/team-shapes.ts (Discipline-Conditional)

```typescript
export type Discipline = 'Engineering' | 'HCD' | 'Management' | 'Product' | 'Research'

export const TEAM_SHAPES: Record<Discipline, TeamShape> = {
  Engineering: {
    requiredRoles: ['Technical Lead', 'Back-end Developer', 'QA Engineer'],
    optionalRoles: ['Front-end Developer', 'DevOps Engineer'],
    fteGuidance: { minimum: 0.5, typical: 1.0 }
  },
  HCD: {
    requiredRoles: ['Product Designer', 'UX Researcher'],
    optionalRoles: ['Content/UX Writer', 'Design Lead'],
    fteGuidance: { minimum: 0.25, typical: 0.75 }
  },
  // ... etc
}

export function getTeamShapeForDisciplines(disciplines: Discipline[]): string {
  // Returns prompt fragment with ONLY the relevant role guidance
  // PM/HCD contract → no engineering role text
}
```

### WBS System Prompt Rewrite

**Current problem**: 293-line system prompt mandates all 8 USDS roles regardless of disciplines.

**Solution**: Discipline-filtered prompt assembly.

```typescript
// lib/ai/prompts/generate-wbs.ts

export function buildWbsSystemPrompt(params: {
  confirmedDisciplines: Discipline[]
  confirmedRoles: string[]
  periods: Period[]
  billableHoursPerYear: number
}): string {
  const { confirmedDisciplines, confirmedRoles, periods, billableHoursPerYear } = params

  // Only include team shape guidance for confirmed disciplines
  const teamGuidance = getTeamShapeForDisciplines(confirmedDisciplines)

  // Role vocabulary is ONLY the confirmed roles
  const roleVocabulary = confirmedRoles.length > 0
    ? confirmedRoles
    : getRolesForDisciplines(confirmedDisciplines)

  return `You are a government contracting estimator generating a Work Breakdown Structure.

## Discipline Scope

This contract has ONLY these disciplines: ${confirmedDisciplines.join(', ')}

## Available Roles (use ONLY these)

${roleVocabulary.map(r => `- ${r}`).join('\n')}

Do not invent roles outside this list. If work requires a role not listed, flag it in assumptions.

## Team Composition Guidance

${teamGuidance}

## Contract Periods

${periods.map((p, i) => `- ${p.name}: ${p.months} months`).join('\n')}

Billable hours per year: ${billableHoursPerYear}

## Hours Estimation

${getHoursHeuristics(confirmedDisciplines)}

## Output Format

Return a JSON array of work packages...`
}
```

**Key change**: Engineering guidance (USDS Play 7, Team Topologies backend/platform/QA requirements) is ONLY included when `confirmedDisciplines` includes `Engineering`. A PM/HCD contract's prompt contains zero engineering text.

---

## 4. Truncation Honesty

### Token-Aware Budget

```typescript
// lib/ai/truncation.ts

const CHARS_PER_TOKEN = 4  // Conservative estimate for English text
const MODEL_CONTEXT_LIMITS = {
  'claude-sonnet-4': 200_000,
  'claude-haiku-4.5': 200_000
}

export interface TruncationResult {
  text: string
  wasTruncated: boolean
  originalCharCount: number
  includedCharCount: number
  estimatedCoverage: string  // e.g., "pages ~1-45 of ~120"
}

export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
  pageCount?: number
): TruncationResult {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  const originalCharCount = text.length

  if (originalCharCount <= maxChars) {
    return {
      text,
      wasTruncated: false,
      originalCharCount,
      includedCharCount: originalCharCount,
      estimatedCoverage: pageCount ? `pages 1-${pageCount}` : 'full document'
    }
  }

  const truncated = text.slice(0, maxChars)
  const includedCharCount = truncated.length

  // Estimate page coverage (rough: 3000 chars/page typical for RFPs)
  const charsPerPage = pageCount ? originalCharCount / pageCount : 3000
  const estimatedPagesIncluded = Math.floor(includedCharCount / charsPerPage)
  const estimatedTotalPages = pageCount || Math.ceil(originalCharCount / 3000)

  return {
    text: truncated,
    wasTruncated: true,
    originalCharCount,
    includedCharCount,
    estimatedCoverage: `pages ~1-${estimatedPagesIncluded} of ~${estimatedTotalPages}`
  }
}
```

### Route Changes

**extract-contract-intelligence** (15K → token-aware):

```typescript
// Current: solicitationText.slice(0, 15000)
// New:
const truncation = truncateToTokenBudget(solicitationText, 10_000, pageCount)

// Response includes warning if truncated
return NextResponse.json({
  ...result,
  truncationWarning: truncation.wasTruncated
    ? `Document exceeds processing limit — extraction covered ${truncation.estimatedCoverage}; review beyond that point manually.`
    : null,
  coverage: truncation.estimatedCoverage
})
```

**extract-rfp** (150K → token-aware + marker):

```typescript
// Current: pdfText.substring(0, 150000) + marker
// New: same token-aware approach, with warning in response
```

### UI Surfacing

The API response includes `truncationWarning` string. The calling component shows it:

```tsx
{truncationWarning && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    {truncationWarning}
  </Alert>
)}
```

---

## 5. Eval Harness

### Directory Structure

```
evals/
├── README.md                   # Usage instructions
├── run.ts                      # Main harness script
├── corpus/
│   └── pm-hcd/
│       ├── solicitation.pdf    # Optional
│       └── expected.json       # Generated via generate-expected.ts
├── metrics/
│   ├── extraction.ts           # Precision/recall for facts
│   ├── schema-validation.ts    # Pass rate
│   ├── discipline-violations.ts # Pre-validator violation count
│   └── hours-plausibility.ts   # Hours band checking
├── reports/
│   └── .gitkeep
└── baseline/
    └── .gitkeep
```

### expected.json Format (PM-HCD)

**Generated via**: `DATABASE_URL="..." npm run evals:generate-expected`

Ground truth is queried from production's confirmed intelligence version and active WBS — never recalled from memory.

```json
{
  "metadata": {
    "proposalId": "490ea2dd-6a5b-417a-b121-919477f4df82",
    "solicitationName": "USDA PM-HCD Proposal",
    "generatedAt": "2026-07-11T...",
    "source": "production database query via generate-expected.ts"
  },
  "intelligence": {
    "contractType": { "expected": "FFP", "required": true },
    "vehicle": { "expected": "...", "required": false },
    "setAside": { "expected": "...", "required": false },
    "periods": {
      "count": 4,
      "details": [
        { "name": "Base Period", "months": 7 },
        { "name": "Option Period 1", "months": 3 },
        { "name": "Option Period 2", "months": 3 },
        { "name": "Option Period 3", "months": 3 }
      ]
    },
    "disciplines": {
      "expected": ["product", "hcd", "management"],
      "forbidden": ["engineering", "devops", "security"]
    },
    "laborRequirements": {
      "count": 2,
      "titles": ["Human-Centered Design Lead", "Senior Product Manager"]
    }
  },
  "wbs": {
    "parentTaskCount": 9,
    "totalTaskCount": 37,
    "totalAssignments": 28,
    "totalHours": 2334.5,
    "disciplineCompliance": {
      "allowedDisciplines": ["product", "hcd", "management"],
      "forbiddenRoles": ["Back-end Developer", "DevOps Engineer", "QA Engineer", "Technical Lead"]
    },
    "hoursPlausibility": {
      "minTotalHours": 1634,
      "maxTotalHours": 3035
    }
  }
}
```

### Metrics

```typescript
// evals/metrics/extraction.ts

export interface ExtractionMetrics {
  fieldPrecision: Record<string, number>  // Correct extractions / total extractions
  fieldRecall: Record<string, number>     // Correct extractions / expected fields
  overall: {
    precision: number
    recall: number
    f1: number
  }
}

// evals/metrics/discipline-violations.ts

export interface DisciplineViolationMetrics {
  rawGenerationViolations: number  // BEFORE validator runs
  validatorCaught: number          // Violations caught by Phase 3 validator
  passedThrough: number            // Violations that made it through
  targetZero: boolean              // Did we achieve zero raw violations?
}
```

### Run Script

```bash
# Package.json
"scripts": {
  "evals": "tsx evals/run.ts",
  "evals:baseline": "tsx evals/run.ts --save-baseline",
  "evals:compare": "tsx evals/run.ts --compare-baseline"
}
```

```typescript
// evals/run.ts

async function runEvals() {
  const corpus = await loadCorpus()
  const results: EvalResult[] = []

  for (const sample of corpus) {
    console.log(`Running: ${sample.id}`)

    // Run extraction
    const extractionResult = await runExtractionEval(sample)

    // Run WBS generation
    const wbsResult = await runWbsEval(sample)

    results.push({
      sampleId: sample.id,
      extraction: extractionResult.metrics,
      wbs: wbsResult.metrics,
      cost: extractionResult.cost + wbsResult.cost,
      latency: extractionResult.latency + wbsResult.latency
    })
  }

  // Generate report
  const report = generateReport(results)
  await saveReport(report)

  if (flags.compareBaseline) {
    const baseline = await loadBaseline()
    printComparison(baseline, report)
  }
}
```

### Report Format

```
=== TrueBid Eval Report ===
Date: 2026-07-11T15:30:00Z
Samples: 1 (CAMP)

EXTRACTION METRICS
  Contract Type: Precision 1.0, Recall 1.0
  Vehicle: Precision 1.0, Recall 1.0
  Set-Aside: Precision 1.0, Recall 1.0
  Periods: Precision 1.0, Recall 1.0
  Disciplines: Precision 1.0, Recall 1.0
  Labor Requirements: Precision 0.5, Recall 1.0

  Overall F1: 0.92

SCHEMA VALIDATION
  Pass Rate: 100%

DISCIPLINE VIOLATIONS (raw generation, before validator)
  Violations: 0 ← TARGET ACHIEVED

WBS METRICS
  Task Coverage: 24/25 PWS sections covered
  Hours Plausibility: Within band

COST & LATENCY
  Total Cost: $0.12
  Total Latency: 8.2s

COMPARISON TO BASELINE (if available)
  Extraction F1: 0.92 vs 0.78 (+18%)
  Discipline Violations: 0 vs 4 (-100%)
```

---

## 6. Sequencing

| Step | Description | Deliverable |
|------|-------------|-------------|
| 1 | **You review this plan** | Go/no-go |
| 2 | Create eval harness + run against CURRENT prompts | `evals/reports/baseline-YYYYMMDD.json` |
| 3 | Create `lib/ai/` directory structure | Prompt modules, knowledge fragments |
| 4 | Structured outputs for extract-contract-intelligence | Route + schema + tests |
| 5 | Structured outputs for extract-requirements | Route + schema (fix enum mismatch) + tests |
| 6 | Structured outputs for extract-compliance | Route + schema + tests |
| 7 | Structured outputs for generate-wbs | Route + schema + tests |
| 8 | Structured outputs for generate-summary | Route + tests |
| 9 | Prompt architecture rewrite (WBS focus) | Discipline-conditional assembly |
| 10 | Truncation honesty | Token-aware budgets + warnings |
| 11 | Post-change eval run | `evals/reports/post-YYYYMMDD.json` |
| 12 | Deploy to staging + real test | CAMP extraction + WBS generation |
| 13 | Completion report | Baseline vs final, all metrics |

---

## 7. Tests

### Schema Validation Tests

```typescript
// __tests__/lib/ai/extract.test.ts

describe('extractWithSchema', () => {
  it('rejects malformed AI output with typed error', async () => {
    const malformed = { contractType: 'INVALID' }
    const result = await extractWithSchema(mockClient, schema, malformed)
    expect(result.success).toBe(false)
    expect(result.error).toBe('VALIDATION_ERROR')
  })

  it('attempts one repair pass on validation failure', async () => {
    // Mock first call returns invalid, repair returns valid
    const result = await extractWithSchema(mockClient, schema, messages)
    expect(mockClient.messages.create).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it('returns REPAIR_FAILED after second validation failure', async () => {
    // Mock both calls return invalid
    const result = await extractWithSchema(mockClient, schema, messages)
    expect(result.success).toBe(false)
    expect(result.error).toBe('REPAIR_FAILED')
  })
})
```

### Prompt Assembly Tests

```typescript
// __tests__/lib/ai/prompts/generate-wbs.test.ts

describe('buildWbsSystemPrompt', () => {
  it('excludes engineering guidance for HCD-only contract', () => {
    const prompt = buildWbsSystemPrompt({
      confirmedDisciplines: ['HCD', 'Product'],
      confirmedRoles: ['Product Designer', 'UX Researcher', 'Product Manager'],
      periods: [{ name: 'Base Period', months: 12 }],
      billableHoursPerYear: 1920
    })

    // String-level assertions
    expect(prompt).not.toContain('Back-end Developer')
    expect(prompt).not.toContain('DevOps Engineer')
    expect(prompt).not.toContain('QA Engineer')
    expect(prompt).not.toContain('Technical Lead')
    expect(prompt).not.toContain('USDS Play 7')
    expect(prompt).not.toContain('Team Topologies')

    // Should contain HCD roles
    expect(prompt).toContain('Product Designer')
    expect(prompt).toContain('UX Researcher')
  })

  it('includes engineering guidance when Engineering discipline present', () => {
    const prompt = buildWbsSystemPrompt({
      confirmedDisciplines: ['Engineering', 'HCD'],
      confirmedRoles: ['Back-end Developer', 'Product Designer', 'QA Engineer'],
      periods: [{ name: 'Base Period', months: 12 }],
      billableHoursPerYear: 1920
    })

    expect(prompt).toContain('Back-end Developer')
    expect(prompt).toContain('QA Engineer')
  })
})
```

### Truncation Tests

```typescript
// __tests__/lib/ai/truncation.test.ts

describe('truncateToTokenBudget', () => {
  it('returns warning when input exceeds budget', () => {
    const longText = 'x'.repeat(100_000)
    const result = truncateToTokenBudget(longText, 10_000, 50)

    expect(result.wasTruncated).toBe(true)
    expect(result.estimatedCoverage).toMatch(/pages ~1-\d+ of ~50/)
  })

  it('returns full document when within budget', () => {
    const shortText = 'x'.repeat(10_000)
    const result = truncateToTokenBudget(shortText, 10_000)

    expect(result.wasTruncated).toBe(false)
    expect(result.text).toBe(shortText)
  })
})
```

### Enum Alignment Tests

```typescript
// __tests__/lib/schemas/rfp.test.ts

describe('extractedRequirementSchema type enum', () => {
  it('matches types used in extract-requirements prompt', () => {
    const promptTypes = ['delivery', 'reporting', 'staffing', 'compliance', 'governance', 'transition', 'other']
    const schemaEnum = extractedRequirementSchema.shape.type._def.innerType._def.values

    expect(schemaEnum.sort()).toEqual(promptTypes.sort())
  })

  it('rejects mismatched types without silent coercion', () => {
    const result = extractedRequirementSchema.safeParse({
      title: 'Test',
      text: 'Test requirement',
      type: 'shall',  // Old prompt value, should fail
      sourceSection: 'C.1'
    })

    expect(result.success).toBe(false)
  })
})
```

---

## 8. Definition of Done Checklist

- [ ] Zero manual JSON extraction in active pipeline (5 routes converted)
- [ ] Every AI output schema-validated with typed failure handling
- [ ] Assembled prompts contain only task-relevant knowledge
- [ ] Discipline-conditional injection proven by tests
- [ ] Validator violation count at generation time measurably reduced (eval evidence)
- [ ] No silent truncation anywhere in active path
- [ ] Eval harness runnable with documented baseline and post-change scores
- [ ] CLAUDE.md rule recorded for eval runs
- [ ] Writing subsystem untouched
- [ ] No schema/database changes
- [ ] API-CONTRACT.md updated with any response shape changes

---

## 9. Explicitly Deferred (Out of Scope)

- Document segments, page-level ingestion, OCR routing, manifests (4B)
- Evidence spans and citation links (4B)
- Background jobs/queue/idempotency keys (4B)
- Tenant configuration tables (Phase 5)
- Any writing-subsystem changes
- CI-integrated evals (local discipline first)
- Streaming UX changes

---

**READY FOR REVIEW**

Awaiting your go before starting Step 2 (eval harness baseline).
