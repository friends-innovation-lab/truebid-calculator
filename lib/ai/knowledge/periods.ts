/**
 * Contract Period Definitions
 *
 * Canonical definitions for contract period extraction.
 * Periods = priced CLIN structure, not milestones or phases.
 */

/**
 * Period extraction rules for prompts
 */
export const PERIOD_EXTRACTION_RULES = `
PERIOD EXTRACTION RULES — CRITICAL:
1. Periods = priced CLIN structure. Count the distinct pricing columns (Base Year, Option Year 1, etc.) in the pricing template or CLIN table.
2. Transition/phase-in is a MILESTONE within the base period, NEVER a separate period.
3. "Ramp-up", "mobilization", "transition-in" are work items, not periods — they occur within Base Year.
4. Periods drive GSA rate year mapping. If the contract has Base + 3 Option Years, that's 4 periods regardless of phase-in language.
5. If pricing template columns show: Base Year | Option Year 1 | Option Year 2 | Option Year 3 → return 4 periods.
6. Do NOT count "phase-in" or "transition" as additional periods beyond the priced structure.
`.trim()

/**
 * Common period patterns in government contracts
 */
export const PERIOD_PATTERNS = {
  /** Standard naming for base period */
  basePeriodNames: ['Base Year', 'Base Period', 'Base', 'Year 1'],

  /** Standard naming for option periods */
  optionPeriodNames: [
    'Option Year',
    'Option Period',
    'Option',
    'OY',
    'OP',
  ],

  /** Terms that indicate milestones, NOT separate periods */
  milestoneTerms: [
    'transition',
    'phase-in',
    'phase in',
    'ramp-up',
    'ramp up',
    'mobilization',
    'transition-in',
    'transition in',
    'onboarding',
    'startup',
  ],
} as const

/**
 * Check if a term indicates a milestone (not a period)
 */
export function isMilestoneTerm(term: string): boolean {
  const normalized = term.toLowerCase().trim()
  return PERIOD_PATTERNS.milestoneTerms.some(m => normalized.includes(m))
}

/**
 * Standard period durations in months
 */
export const STANDARD_PERIOD_MONTHS = {
  /** Common base period duration */
  baseYear: 12,
  /** Common option period duration */
  optionYear: 12,
  /** Short option period (quarterly) */
  optionQuarter: 3,
} as const
