# TrueBid Eval Harness

Evaluates AI extraction and WBS generation quality against ground truth from production.

## Quick Start

```bash
# 1. Generate ground truth from production
DATABASE_URL="postgresql://..." npm run evals:generate-expected

# 2. Run evals and save baseline
npm run evals -- --save-baseline

# 3. After changes, compare to baseline
npm run evals -- --compare
```

## Directory Structure

```
evals/
├── run.ts                    # Main eval harness
├── scripts/
│   └── generate-expected.ts  # Queries production for ground truth
├── corpus/
│   └── pm-hcd/
│       ├── expected.json     # Ground truth (generated, not hand-written)
│       └── solicitation.pdf  # Optional: source document
├── metrics/
│   ├── extraction.ts         # Precision/recall for facts
│   ├── discipline-violations.ts
│   └── schema-validation.ts
├── reports/                  # Generated reports
└── baseline/                 # Saved baselines for comparison
```

## Metrics

### Extraction Metrics
- **Field Precision**: Correct extractions / Total extractions
- **Field Recall**: Correct extractions / Expected fields
- **F1 Score**: Harmonic mean of precision and recall

Fields measured:
- contractType
- vehicle
- setAside
- periods (count)
- disciplines (set overlap)
- laborRequirements (title overlap)

### Schema Validation
- **Pass Rate**: Percentage of AI outputs that pass Zod schema validation
- Tracks repair attempts and success rate

### Discipline Violations
- **Raw Generation Violations**: Count of roles generated that violate discipline constraints (BEFORE validator runs)
- **Target**: Zero violations at generation time

### Cost & Latency
- Input/output token counts
- Estimated cost in USD
- Total latency in milliseconds

## Adding New Corpus Samples

1. Create a folder: `evals/corpus/<sample-id>/`
2. Generate expected.json from production (or create manually)
3. Optionally add the source PDF
4. Run evals

## Ground Truth Generation

The `generate-expected.ts` script queries production to extract ground truth:

```bash
# Get the DATABASE_URL from Supabase dashboard or ENVIRONMENTS.md
DATABASE_URL="postgresql://postgres.qtotsijebcpddipmzstb:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  npx tsx evals/scripts/generate-expected.ts
```

This queries:
- `intelligence_versions` (confirmed)
- `intelligence_periods`
- `intelligence_disciplines`
- `intelligence_labor_requirements`
- `wbs_versions` (active)
- `wbs_tasks`
- `staffing_assignments`

**RULE**: Ground truth is queried from production, never recalled from memory.

## Baseline Workflow

```bash
# Before changes: save baseline
npm run evals -- --save-baseline

# Make prompt/schema changes...

# After changes: compare
npm run evals -- --compare
```

The comparison shows delta for:
- Extraction F1
- Discipline violations
- Schema pass rate

## CI Integration (Future)

Currently local-only due to API cost concerns. CI integration planned for later.

## CLAUDE.md Rule

> Any prompt, schema, or model change requires an eval run. The report must be included in the completion summary.
