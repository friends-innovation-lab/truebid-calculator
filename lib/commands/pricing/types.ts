/**
 * Pricing Command Types
 *
 * Type definitions for pricing scenario commands.
 */

/**
 * Rate config snapshot stored with each scenario.
 * Captures the rates in effect at computation time.
 */
export interface RateConfigSnapshot {
  /** Fringe rate as decimal (0.2116 = 21.16%) */
  fringe: number
  /** Overhead rate as decimal */
  overhead: number
  /** G&A rate as decimal */
  ga: number
  /** Default profit rate from company settings */
  defaultProfitRate: number
  /** Annual escalation rate as decimal (0.03 = 3%) */
  escalationRate: number
  /** Timestamp when snapshot was taken */
  snapshotAt: string
  /** Row version of company_settings at snapshot time */
  sourceSettingsRowVersion: number
}

/**
 * Pricing scenario status.
 */
export type PricingScenarioStatus = 'draft' | 'approved' | 'superseded'

/**
 * Source of resolved salary for a pricing line.
 */
export type SalarySource = 'catalog' | 'override'

/**
 * Source of profit rate for a pricing line.
 */
export type ProfitSource = 'explicit' | 'contract_default'

/**
 * Line type for pricing lines.
 * - wbs_estimate: from staffing assignments (WBS task-level hours)
 * - labor_loading: from confirmed intelligence utilization (contract-level totals)
 */
export type PricingLineType = 'wbs_estimate' | 'labor_loading'

/**
 * A pricing scenario summary.
 */
export interface PricingScenarioSummary {
  id: string
  proposalId: string
  wbsVersionId: string
  label: string
  status: PricingScenarioStatus
  engineVersion: string
  computedAt: string
  totalCost: number
  lineCount: number
  isStale: boolean
}

/**
 * A pricing line with full calculation trace.
 */
export interface PricingLine {
  id: string
  lineType: PricingLineType
  // Source references (one set based on lineType)
  staffingAssignmentId: string | null  // for wbs_estimate
  intelligenceLaborRequirementId: string | null  // for labor_loading
  intelligencePeriodId: string | null  // for labor_loading
  periodLabel: string
  hours: number

  // Salary resolution
  resolvedSalaryCents: number
  salarySource: SalarySource
  levelKey: string | null
  stepIndex: number | null

  // Full trace (the line IS the ledger)
  baseHourly: number
  fringeAmount: number
  overheadBase: number
  overheadAmount: number
  gaAmount: number
  costBeforeProfit: number
  profitRate: number
  profitSource: ProfitSource
  profitAmount: number
  fullyBurdened: number

  // Escalation
  escalationRateApplied: number | null
  escalationYearIndex: number | null

  // Extended cost
  extendedCost: number
}

/**
 * Rollup totals for a pricing scenario.
 */
export interface ScenarioTotals {
  totalHours: number
  totalExtendedCost: number
  averageRate: number
  lineCount: number
  periodTotals: Array<{
    periodLabel: string
    hours: number
    extendedCost: number
  }>
}
