/**
 * TrueBid Pricing Engine
 *
 * THE centralized pricing engine for all rate calculations.
 * All other pricing logic MUST call through this module.
 *
 * Key formulas:
 *   base_hourly        = annual_salary / 2080
 *   fringe_amount      = base_hourly * fringe_rate
 *   overhead_base      = base_hourly + fringe_amount
 *   overhead_amount    = overhead_base * overhead_rate   <-- CORRECT (not salary * rate)
 *   ga_base            = overhead_base + overhead_amount
 *   ga_amount          = ga_base * ga_rate
 *   cost_before_profit = ga_base + ga_amount
 *   profit_amount      = cost_before_profit * profit_rate
 *   fully_burdened     = cost_before_profit + profit_amount
 *
 *   fte                = planned_billable_hours / 1920
 *   gsa_year           = floor((cumulative_month - 1) / 12) + 1
 *
 * @module lib/pricing/engine
 */

import Decimal from 'decimal.js'
import {
  type PricingInput,
  type PricingBreakdown,
  type FTEInput,
  type FTEResult,
  type GSAYearInput,
  type GSAYearResult,
  type EscalationInput,
  type EscalationResult,
  PricingValidationError,
} from './types'

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/** Current formula version for audit trail */
export const FORMULA_VERSION = 'v1.0.0'

/** Default standard hours for rate calculation */
export const DEFAULT_STANDARD_HOURS = 2080

/** Default billable hours per year for FTE calculation */
export const DEFAULT_BILLABLE_HOURS_PER_YEAR = 1920

/**
 * Normalize a rate value to decimal form.
 * Use at boundaries where input may be a percentage (21.16) or decimal (0.2116).
 *
 * @param value - The rate value
 * @param treatAsPercentageIfAbove - If value > this threshold, divide by 100 (default: 1)
 * @returns Rate as a decimal (0.0 to ~1.0)
 *
 * @example
 * normalizeRateToDecimal(21.16) // => 0.2116 (treated as percentage)
 * normalizeRateToDecimal(0.2116) // => 0.2116 (already decimal)
 * normalizeRateToDecimal(8) // => 0.08 (treated as percentage)
 * normalizeRateToDecimal(0.08) // => 0.08 (already decimal)
 */
export function normalizeRateToDecimal(
  value: number,
  treatAsPercentageIfAbove: number = 1
): number {
  if (value > treatAsPercentageIfAbove) {
    return value / 100
  }
  return value
}

/**
 * Calculate a fully burdened rate from salary and rates.
 *
 * This is THE source of truth for rate calculations.
 *
 * @param input - Pricing input with salary, rates, and profit
 * @returns Complete breakdown of the calculation
 * @throws PricingValidationError if inputs are invalid
 */
export function calculateFullyBurdenedRate(input: PricingInput): PricingBreakdown {
  const { annualSalary, rates, profitRate, standardHours = DEFAULT_STANDARD_HOURS } = input

  // Validate inputs
  if (annualSalary < 0) {
    throw new PricingValidationError(
      'Annual salary cannot be negative',
      'annualSalary',
      annualSalary
    )
  }
  if (standardHours <= 0) {
    throw new PricingValidationError(
      'Standard hours must be positive',
      'standardHours',
      standardHours
    )
  }
  if (rates.fringe < 0 || rates.overhead < 0 || rates.ga < 0) {
    throw new PricingValidationError(
      'Indirect rates cannot be negative',
      'rates',
      rates
    )
  }
  if (profitRate < 0) {
    throw new PricingValidationError(
      'Profit rate cannot be negative',
      'profitRate',
      profitRate
    )
  }
  if (profitRate >= 1) {
    throw new PricingValidationError(
      'Profit rate must be less than 100% (1.0). Use decimal form (e.g., 0.10 for 10%)',
      'profitRate',
      profitRate
    )
  }

  // Use Decimal.js for precision
  const salary = new Decimal(annualSalary)
  const hours = new Decimal(standardHours)
  const fringeRate = new Decimal(rates.fringe)
  const overheadRate = new Decimal(rates.overhead)
  const gaRate = new Decimal(rates.ga)
  const profit = new Decimal(profitRate)

  // Calculate step by step
  // base_hourly = annual_salary / standard_hours
  const baseHourly = salary.dividedBy(hours)

  // fringe_amount = base_hourly * fringe_rate
  const fringeAmount = baseHourly.times(fringeRate)

  // after_fringe = base_hourly + fringe_amount
  const afterFringe = baseHourly.plus(fringeAmount)

  // overhead_amount = after_fringe * overhead_rate
  // NOTE: This is the CORRECT formula. The bug was: salary * overhead_rate
  const overheadAmount = afterFringe.times(overheadRate)

  // after_overhead = after_fringe + overhead_amount
  const afterOverhead = afterFringe.plus(overheadAmount)

  // ga_amount = after_overhead * ga_rate
  const gaAmount = afterOverhead.times(gaRate)

  // cost_before_profit = after_overhead + ga_amount
  const costBeforeProfit = afterOverhead.plus(gaAmount)

  // profit_amount = cost_before_profit * profit_rate
  const profitAmount = costBeforeProfit.times(profit)

  // fully_burdened = cost_before_profit + profit_amount
  const fullyBurdenedRate = costBeforeProfit.plus(profitAmount)

  // Convert back to numbers
  // Keep 6 decimals for intermediate values (audit/verification precision)
  // Final rate rounded to 2 decimals for display
  return {
    annualSalary,
    standardHours,
    baseHourly: baseHourly.toDecimalPlaces(6).toNumber(),
    fringeAmount: fringeAmount.toDecimalPlaces(6).toNumber(),
    afterFringe: afterFringe.toDecimalPlaces(6).toNumber(),
    overheadAmount: overheadAmount.toDecimalPlaces(6).toNumber(),
    afterOverhead: afterOverhead.toDecimalPlaces(6).toNumber(),
    gaAmount: gaAmount.toDecimalPlaces(6).toNumber(),
    costBeforeProfit: costBeforeProfit.toDecimalPlaces(6).toNumber(),
    profitAmount: profitAmount.toDecimalPlaces(6).toNumber(),
    fullyBurdenedRate: fullyBurdenedRate.toDecimalPlaces(2).toNumber(),
    rates,
    profitRate,
    formulaVersion: FORMULA_VERSION,
  }
}

/**
 * Calculate fully burdened rate and return just the final rate.
 * Convenience function for callers that don't need the full breakdown.
 */
export function calculateBillRate(input: PricingInput): number {
  return calculateFullyBurdenedRate(input).fullyBurdenedRate
}

/**
 * Calculate cost before profit (no profit margin applied).
 */
export function calculateCostRate(input: Omit<PricingInput, 'profitRate'>): number {
  const breakdown = calculateFullyBurdenedRate({ ...input, profitRate: 0 })
  return breakdown.costBeforeProfit
}

/**
 * Calculate FTE from planned hours.
 *
 * @param input - FTE calculation input
 * @returns FTE result
 */
export function calculateFTE(input: FTEInput): FTEResult {
  const {
    plannedBillableHours,
    billableHoursPerYear = DEFAULT_BILLABLE_HOURS_PER_YEAR,
  } = input

  if (billableHoursPerYear <= 0) {
    throw new PricingValidationError(
      'Billable hours per year must be positive',
      'billableHoursPerYear',
      billableHoursPerYear
    )
  }

  const hours = new Decimal(plannedBillableHours)
  const yearly = new Decimal(billableHoursPerYear)
  const fte = hours.dividedBy(yearly).toDecimalPlaces(2).toNumber()

  return {
    fte,
    plannedBillableHours,
    billableHoursPerYear,
  }
}

/**
 * Calculate GSA year from cumulative month.
 *
 * GSA pricing schedules typically have different rates for each contract year.
 * Year 1 = months 1-12, Year 2 = months 13-24, etc.
 *
 * @param input - GSA year input
 * @returns GSA year result
 */
export function calculateGSAYear(input: GSAYearInput): GSAYearResult {
  const { cumulativeMonth } = input

  if (cumulativeMonth < 1) {
    throw new PricingValidationError(
      'Cumulative month must be at least 1',
      'cumulativeMonth',
      cumulativeMonth
    )
  }

  // gsa_year = floor((cumulative_month - 1) / 12) + 1
  const gsaYear = Math.floor((cumulativeMonth - 1) / 12) + 1

  return {
    gsaYear,
    cumulativeMonth,
  }
}

/**
 * Calculate escalated rate for a given year.
 *
 * Year 1 has no escalation (returns base rate).
 * Year 2+ applies compound escalation.
 *
 * @param input - Escalation input
 * @returns Escalation result
 */
export function calculateEscalatedRate(input: EscalationInput): EscalationResult {
  const { baseRate, year, escalationRate } = input

  if (baseRate < 0) {
    throw new PricingValidationError(
      'Base rate cannot be negative',
      'baseRate',
      baseRate
    )
  }
  if (year < 1) {
    throw new PricingValidationError(
      'Year must be at least 1',
      'year',
      year
    )
  }

  // Year 1 = no escalation
  if (year <= 1) {
    return {
      escalatedRate: baseRate,
      baseRate,
      year,
      escalationRate,
      multiplier: 1,
    }
  }

  // Year 2+ = compound escalation
  const base = new Decimal(baseRate)
  const rate = new Decimal(escalationRate)
  const yearsToEscalate = year - 1

  // multiplier = (1 + escalation_rate) ^ (year - 1)
  const multiplier = rate.plus(1).pow(yearsToEscalate)
  const escalatedRate = base.times(multiplier).toDecimalPlaces(2).toNumber()

  return {
    escalatedRate,
    baseRate,
    year,
    escalationRate,
    multiplier: multiplier.toDecimalPlaces(6).toNumber(),
  }
}

/**
 * Calculate minimum viable rate to achieve a target margin.
 *
 * Given a cost rate, what bill rate is needed to achieve X% profit margin?
 *
 * @param costRate - The cost per hour (before profit)
 * @param targetMargin - Target profit margin as decimal (0.10 = 10%)
 * @returns The minimum bill rate needed
 * @throws PricingValidationError if margin >= 100%
 */
export function calculateMinimumViableRate(
  costRate: number,
  targetMargin: number
): number {
  if (targetMargin >= 1) {
    throw new PricingValidationError(
      'Target margin must be less than 100% (1.0)',
      'targetMargin',
      targetMargin
    )
  }

  const cost = new Decimal(costRate)
  const margin = new Decimal(targetMargin)

  // minimum_rate = cost / (1 - target_margin)
  const denominator = new Decimal(1).minus(margin)
  const minRate = cost.dividedBy(denominator).toDecimalPlaces(2).toNumber()

  return minRate
}

/**
 * Reverse calculation: given a bill rate, what profit margin does it represent?
 *
 * @param billRate - The bill rate
 * @param costRate - The cost rate (before profit)
 * @returns Profit margin as decimal
 */
export function calculateMarginFromRates(billRate: number, costRate: number): number {
  if (billRate <= 0) return 0
  if (costRate <= 0) return 1 // 100% margin if no cost

  const bill = new Decimal(billRate)
  const cost = new Decimal(costRate)

  // margin = (bill - cost) / bill
  const margin = bill.minus(cost).dividedBy(bill).toDecimalPlaces(4).toNumber()

  return margin
}
