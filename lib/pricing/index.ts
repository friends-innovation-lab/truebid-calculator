/**
 * TrueBid Pricing Engine
 *
 * THE centralized pricing module for all rate calculations.
 *
 * @example
 * import {
 *   calculateFullyBurdenedRate,
 *   calculateBillRate,
 *   normalizeRateToDecimal,
 * } from '@/lib/pricing'
 *
 * const breakdown = calculateFullyBurdenedRate({
 *   annualSalary: 120000,
 *   rates: { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 },
 *   profitRate: 0.10,
 * })
 *
 * console.log(breakdown.fullyBurdenedRate) // $107.52
 */

// Re-export types
export {
  type IndirectRates,
  type PricingInput,
  type PricingBreakdown,
  type FTEInput,
  type FTEResult,
  type GSAYearInput,
  type GSAYearResult,
  type EscalationInput,
  type EscalationResult,
  PricingValidationError,
  GSARateMissingError,
} from './types'

// Re-export engine functions
export {
  FORMULA_VERSION,
  DEFAULT_STANDARD_HOURS,
  DEFAULT_BILLABLE_HOURS_PER_YEAR,
  normalizeRateToDecimal,
  calculateFullyBurdenedRate,
  calculateBillRate,
  calculateCostRate,
  calculateFTE,
  calculateGSAYear,
  calculateEscalatedRate,
  calculateMinimumViableRate,
  calculateMarginFromRates,
} from './engine'

// Re-export profit resolver
export {
  type ContractType,
  type ProfitResolverInput,
  type ProfitResolverResult,
  DEFAULT_PROFIT_TARGETS,
  resolveProfitRate,
  resolveProfitRateWithFallback,
} from './profit-resolver'
