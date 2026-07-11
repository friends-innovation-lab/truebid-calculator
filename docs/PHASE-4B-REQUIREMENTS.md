# Phase 4B Requirements

Requirements identified during Phase 4A implementation.

## 4B-001: Multi-File Solicitation Ingestion

**Status:** Not Started
**Priority:** High
**Acceptance Test:** setAside field extraction

### Problem

The current extraction pipeline processes only a single document (typically the PWS). Government solicitations consist of multiple files:
- SF-1449 (cover form) - contains set-aside designation, NAICS code, contract number
- PWS/SOW (scope) - contains requirements, deliverables, period of performance
- Amendments - contain modifications to the above

The `setAside` field (WOSB, 8(a), SDVOSB, etc.) is on the SF-1449, not in the PWS. This means:
1. Models correctly extract `UNKNOWN` when given only the PWS
2. Ground truth shows `WOSB` from the actual solicitation package
3. This is a missing-document problem, not a prompt problem

### Evidence

pm-hcd corpus sample:
- PWS document: 26,491 chars, NO set-aside language
- Expected: WOSB (confirmed by user, from SF-1449)
- Model output: UNKNOWN (correct given input)

### Acceptance Criteria

1. Ingestion accepts multiple file uploads per solicitation
2. Files are classified by type (SF-1449, PWS, Amendment)
3. Extraction prompt receives content from all relevant documents
4. setAside field extraction accuracy ≥ 90% when SF-1449 is included
5. eval harness supports multi-document corpus samples

### Implementation Notes

- Consider using document classification before extraction
- SF-1449 has standardized fields that could be extracted with regex
- Amendments should be ordered chronologically and supersede prior content

---

## 4B-002: Corpus Sample #2 (CAMP) Required

**Status:** Not Started
**Priority:** High
**Blocking:** Discipline precision tuning

### Problem

The eval corpus currently contains only one sample (pm-hcd). Tuning discipline extraction rules against a single sample risks overfitting — rules that achieve 100% precision on pm-hcd may fail on other contract types.

### Requirements

1. Add CAMP solicitation as corpus sample #2
2. CAMP should have different discipline mix than pm-hcd (ideally includes engineering)
3. Run evals against both samples before making prompt changes
4. Discipline precision target (≥0.80) must be measured across both samples

### Rationale

One-sample targets risk overfitting. The "service design is research" rule was tuned for pm-hcd's HCD context — it may not generalize to other solicitations without CAMP as a check.

---

## 4B-003: Product vs Management Discipline Boundary

**Status:** Deferred (pending CAMP corpus sample)
**Blocking:** Discipline precision ≥0.80 target

### Observation

On pm-hcd, model extracts `product, research, management` but ground truth is `product, research`. The model sees management-style activities (coordination, delivery oversight) in the PWS and infers `management` discipline.

### Ground Truth Ruling

- "Senior Product Manager" role → `product` discipline (not `management`)
- Management activities within a product/research contract don't constitute a separate `management` discipline
- `management` discipline is for dedicated program management roles (e.g., Program Manager, Portfolio Lead)

### Deferred

Further prompt tuning deferred until CAMP sample available to prevent one-sample overfitting.
