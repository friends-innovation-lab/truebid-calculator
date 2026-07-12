/**
 * Pricing Engine Types
 *
 * Central type definitions for the TrueBid pricing engine.
 * All financial calculations go through these interfaces.
 */

import Decimal from 'decimal.js'

// Configure Decimal.js for financial calculations
// 20 significant digits, rounding half-up (banker's rounding alternative)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Indirect rate structure.
 * All rates are decimals (0.2116, not 21.16%).
 */
export interface IndirectRates {
  fringe: number
  overhead: number
  ga: number
}

/**
 * Optional escalation parameters for rate calculation.
 * GSA contracts do NOT use this — they have pre-escalated schedule rates.
 */
export interface EscalationParams {
  /** Annual escalation rate as decimal (0.03 = 3%) */
  rate: number
  /** Year index (1 = base year with no escalation, 2+ = escalation applied) */
  yearIndex: number
}

/**
 * Input for calculating a fully burdened rate.
 */
export interface PricingInput {
  /** Annual salary in dollars */
  annualSalary: number
  /** Indirect rates as decimals */
  rates: IndirectRates
  /** Profit rate as decimal (0.10 = 10%). REQUIRED - no default. */
  profitRate: number
  /** Standard hours per year for rate calculation (defaults to 2080) */
  standardHours?: number
  /** Optional escalation params. Omit for GSA (uses pre-escalated schedule rates). */
  escalation?: EscalationParams
}

/**
 * Complete breakdown of a rate calculation.
 * All monetary values are in dollars per hour unless noted.
 */
export interface PricingBreakdown {
  /** Input annual salary */
  annualSalary: number
  /** Hours used for rate calculation */
  standardHours: number

  /** Base hourly rate (salary / standardHours) */
  baseHourly: number
  /** Fringe amount per hour */
  fringeAmount: number
  /** Rate after fringe (base + fringe) */
  afterFringe: number
  /** Overhead amount per hour (calculated on afterFringe) */
  overheadAmount: number
  /** Rate after overhead */
  afterOverhead: number
  /** G&A amount per hour */
  gaAmount: number
  /** Rate after G&A (cost before profit) */
  costBeforeProfit: number
  /** Profit amount per hour */
  profitAmount: number
  /** Fully burdened rate (cost + profit, after escalation if applied) */
  fullyBurdenedRate: number

  /** Input rates used */
  rates: IndirectRates
  /** Input profit rate used */
  profitRate: number

  /**
   * Escalation rate applied (null for GSA or when no escalation requested).
   * Stored as decimal (0.03 = 3%).
   */
  escalationRateApplied: number | null
  /**
   * Escalation year index (null for GSA or when no escalation requested).
   * 1 = base year (no escalation), 2+ = escalation applied.
   */
  escalationYearIndex: number | null

  /** Formula version for audit trail */
  formulaVersion: string
}

/**
 * Input for FTE calculation.
 */
export interface FTEInput {
  /** Planned billable hours for this role */
  plannedBillableHours: number
  /** Billable hours per year (defaults to 1920) */
  billableHoursPerYear?: number
}

/**
 * FTE calculation result.
 */
export interface FTEResult {
  /** Full-time equivalent (0.0 to N.0) */
  fte: number
  /** Hours used in calculation */
  plannedBillableHours: number
  /** Denominator used */
  billableHoursPerYear: number
}

/**
 * Input for GSA year calculation.
 */
export interface GSAYearInput {
  /** Cumulative month in contract (1 = first month) */
  cumulativeMonth: number
}

/**
 * GSA year result.
 */
export interface GSAYearResult {
  /** GSA year (1, 2, 3...) */
  gsaYear: number
  /** Input month */
  cumulativeMonth: number
}

/**
 * Input for escalation calculation.
 */
export interface EscalationInput {
  /** Base rate to escalate */
  baseRate: number
  /** Year number (1 = no escalation, 2+ = escalation applied) */
  year: number
  /** Annual escalation rate as decimal (0.03 = 3%) */
  escalationRate: number
}

/**
 * Escalation result.
 */
export interface EscalationResult {
  /** Escalated rate */
  escalatedRate: number
  /** Input base rate */
  baseRate: number
  /** Year used */
  year: number
  /** Escalation rate used */
  escalationRate: number
  /** Multiplier applied */
  multiplier: number
}

/**
 * Error thrown when an invalid input is provided.
 */
export class PricingValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message)
    this.name = 'PricingValidationError'
  }
}

/**
 * Error thrown when a required GSA rate is missing.
 */
export class GSARateMissingError extends Error {
  constructor(
    public readonly gsaYear: number,
    public readonly availableYears?: number[]
  ) {
    super(`GSA rate not found for year ${gsaYear}`)
    this.name = 'GSARateMissingError'
  }
}

/**
 * Decimal.js instance type for internal calculations.
 */
export type { Decimal }
export { Decimal as DecimalClass }
