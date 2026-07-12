# Eval Metrics Summary

Generated as of commit 18a69b409e9f6afe65e67bbe404ab8cca5d4e958 on 2026-07-12

---

## Chronological Eval Score Trajectory

| Run Date | Phase/Change | Sample | F1 Score | Role Precision | Role Recall | Discipline Violations | Schema Pass | Input Tokens | Output Tokens | Cost (USD) |
|----------|--------------|--------|----------|----------------|-------------|----------------------|-------------|--------------|---------------|------------|
| 2026-07-11 | Phase 4A baseline | pm-hcd | 0.833 | 0.67 | 1.00 | 0 | 100% | 12,691 | 8,236 | $0.16 |
| 2026-07-12 | Phase 4B multi-doc + Phase 5 catalog | pm-hcd | 1.000 | 1.00 | 1.00 | 0 | 100% | — | — | — |
| 2026-07-12 | Phase 4B multi-doc + Phase 5 catalog | camp | 0.667 | 0.86 | 1.00 | 0 | 0% | — | — | — |
| 2026-07-12 | **Summary** | 2 samples | **0.833** | — | — | **0** | **50%** | 51,671 | 28,379 | **$0.58** |

---

## Per-Sample Details

### pm-hcd (PM/HCD Solicitation)

| Run Date | Contract Type | Vehicle | Set-Aside | Periods | Disciplines | Labor Reqs | F1 |
|----------|---------------|---------|-----------|---------|-------------|------------|----|
| 2026-07-11 | FFP | GSA MAS | UNKNOWN | 4 | product, research, management (P=0.67) | 2 | 0.833 |
| 2026-07-12 | FFP | GSA MAS / FSS Task Order | WOSB | 4 | product, research (P=1.00 R=1.00) | 2 | **1.000** |

**Key improvements:**
- Set-aside extraction fixed: `UNKNOWN` -> `WOSB` (from RFQ Instructions Section 1.1)
- Discipline precision improved: removed spurious "management" discipline
- All 6 fields now match expected values

### camp (CAMP Solicitation)

| Run Date | Contract Type | Vehicle | Set-Aside | Periods | Disciplines | Labor Reqs | F1 |
|----------|---------------|---------|-----------|---------|-------------|------------|----|
| 2026-07-12 | T&M | GSA MAS 54151S | UNKNOWN | 3 (expected: 4) | engineering, design, research, product, management, devops, security (P=0.86 R=1.00) | 7 (expected: 13) | 0.667 |

**Known issues:**
- Period count mismatch: extracted 3, expected 4
- Labor requirements undercount: extracted 7, expected 13
- Schema validation failure (details TBD)

---

## Summary Metrics Across Phases

| Metric | Phase 4A (2026-07-11) | Phase 5 (2026-07-12) | Delta |
|--------|----------------------|----------------------|-------|
| Samples evaluated | 1 | 2 | +1 |
| Extraction F1 (mean) | 0.833 | 0.833 | 0.0% |
| pm-hcd F1 | 0.833 | 1.000 | +16.7% |
| camp F1 | — | 0.667 | (new) |
| Discipline violations | 0 | 0 | — |
| Schema pass rate | 100% | 50% | -50% |
| Total tokens (in+out) | 20,927 | 80,050 | +282% |
| Cost per run | $0.16 | $0.58 | +263% |

---

## Role Extraction Quality

### pm-hcd Roles (2026-07-12)

| Role | Status |
|------|--------|
| Delivery Manager | Extracted |
| Product Manager | Extracted |
| UX Researcher | Extracted |
| Content/UX Writer | Extracted |
| Product Designer | Extracted |

Discipline violations: **0** (no engineering roles on PM/HCD contract)

### pm-hcd Roles (2026-07-11)

| Role | Status |
|------|--------|
| Delivery Manager | Extracted |
| Product Manager | Extracted |
| UX Researcher | Extracted |
| Content/UX Writer | Extracted |
| Design Lead | Extracted |

**Note:** "Design Lead" renamed to "Product Designer" between runs (catalog alignment).

---

## Cost Analysis

| Run | Input Tokens | Output Tokens | Total Tokens | USD |
|-----|--------------|---------------|--------------|-----|
| 2026-07-11 | 12,691 | 8,236 | 20,927 | $0.161613 |
| 2026-07-12 | 51,671 | 28,379 | 80,050 | $0.580698 |

**Cost increase drivers:**
1. Added second sample (CAMP) to corpus
2. Multi-document extraction processes more source material
3. No Opus-vs-Sonnet comparison data available in these runs

---

## Model Configuration

- **Model:** claude-sonnet-4-6 (Phase 4A upgrade)
- **Tool-use pattern:** Structured outputs via tool definitions
- **Validation:** Zod schema with repair pass

---

## Notes

1. **Schema pass rate drop:** The 50% pass rate on 2026-07-12 is due to CAMP failing schema validation. PM-HCD passes 100%. Investigation needed for CAMP extraction.

2. **Discipline precision:** PM-HCD improved from P=0.67 to P=1.00 by correctly excluding "management" from disciplines (product + research only).

3. **Set-aside extraction:** Now correctly identifies WOSB from instructions document, demonstrating multi-document capability.

4. **Penny conservation:** Phase 5 catalog migration conserved 28/28 staffing assignments to the penny (verified separately from eval harness).
