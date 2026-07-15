/**
 * BOE Artifact Content Schema
 *
 * Defines the structure of the JSONB content stored in boe_artifacts.
 * This is the structured document format for BOE generation.
 */

import { z } from 'zod'

/**
 * Period definition within artifact
 */
export const ArtifactPeriodSchema = z.object({
  periodId: z.string().uuid(),
  name: z.string(), // "Base Period", "Option Year 1"
  months: z.number(), // 12.00, 7.00
  cumulativeMonthsEnd: z.number(), // 12, 24, 36
  gsaRateYear: z.number().int(), // 1, 2, 3, 4
})

/**
 * Role/rate table entry
 */
export const ArtifactRoleSchema = z.object({
  roleTitle: z.string(),
  laborCategoryKey: z.string().nullable(),
  levelKey: z.string().nullable(),
  stepIndex: z.number().int().nullable(),
  annualSalaryCents: z.number().int(),
  salarySource: z.enum(['catalog', 'override']),
  fullyBurdenedRate: z.number(), // 2 decimals
})

/**
 * Calculation trace from pricing line
 */
export const CalcTraceSchema = z.object({
  resolvedSalaryCents: z.number().int(),
  salarySource: z.enum(['catalog', 'override']),
  levelKey: z.string().nullable(),
  stepIndex: z.number().int().nullable(),

  baseHourly: z.number(), // 6 decimals in DB
  fringeAmount: z.number(),
  overheadBase: z.number(), // afterFringe
  overheadAmount: z.number(),
  gaAmount: z.number(),
  costBeforeProfit: z.number(),

  profitRate: z.number(), // 4 decimals
  profitSource: z.enum(['explicit', 'contract_default']),
  profitAmount: z.number(),

  fullyBurdenedRate: z.number(), // 2 decimals

  // Escalation (if applicable)
  escalationRateApplied: z.number().nullable(),
  escalationYearIndex: z.number().int().nullable(),
})

/**
 * Estimate line with full calculation trace and fee decomposition
 *
 * Fee decomposition: each line shows cost and fee separately (DCAA-style)
 * cost + fee === extendedTotal (penny-conserved)
 */
export const ArtifactEstimateLineSchema = z.object({
  lineId: z.string(), // UUID for citation reference
  lineType: z.enum(['wbs_estimate', 'labor_loading']),

  // Source identification
  wbsCode: z.string().nullable(), // "1.1.2" for wbs_estimate
  taskTitle: z.string().nullable(), // Task title for wbs_estimate
  roleTitle: z.string(),
  periodLabel: z.string(),

  // Hours basis
  hours: z.number(),
  hoursRationale: z.string().nullable(), // "128 hrs/mo × 80% util × 7 mo = 716.8 hrs"

  // Full calculation trace (carried forward from pricing_lines)
  calcTrace: CalcTraceSchema,

  // Fee decomposition (DCAA-style presentation)
  // cost + fee === extendedTotal
  costComponent: z.number(), // hours × costBeforeProfit (rounded to 2 decimals)
  feeComponent: z.number(), // extendedTotal - costComponent (penny-conserved)
  extendedTotal: z.number(), // hours × fullyBurdenedRate

  // Citation requirement tracking
  // wbs_estimate: must have ≥1 entry
  // labor_loading: optional (evidence is the confirmed intelligence utilization itself)
  requirementLinkIds: z.array(z.string().uuid()),
})

/**
 * Section within the artifact
 */
export const ArtifactSectionSchema = z.object({
  sectionId: z.string(),
  sectionType: z.enum([
    'period_structure', // Contract period definitions
    'role_rate_table', // Role/rate catalog
    'wbs_estimates', // Per-task estimates with hours basis
    'labor_loading_summary', // Contract-level utilization
    'cost_fee_breakout', // Cost/fee decomposition summary
    'totals', // Grand totals
  ]),
  title: z.string(),

  // Section-specific content (polymorphic based on sectionType)
  periods: z.array(ArtifactPeriodSchema).optional(),
  roles: z.array(ArtifactRoleSchema).optional(),
  lines: z.array(ArtifactEstimateLineSchema).optional(),

  // Summary values for totals sections
  summary: z
    .object({
      totalHours: z.number().optional(),
      totalCost: z.number().optional(),
      totalFee: z.number().optional(),
      grandTotal: z.number().optional(),
    })
    .optional(),
})

/**
 * Rate configuration snapshot at generation time
 */
export const ArtifactRateConfigSchema = z.object({
  fringe: z.number(),
  overhead: z.number(),
  ga: z.number(),
  defaultProfitRate: z.number(),
  escalationRate: z.number(),
  snapshotAt: z.string(), // ISO timestamp
  sourceSettingsRowVersion: z.number().int().nullable(), // null if table lacks row_version
})

/**
 * Totals aggregate
 */
export const ArtifactTotalsSchema = z.object({
  wbsEstimateHours: z.number(),
  wbsEstimateCost: z.number(),
  wbsEstimateFee: z.number(),
  wbsEstimateTotal: z.number(),

  laborLoadingHours: z.number(),
  laborLoadingCost: z.number(),
  laborLoadingFee: z.number(),
  laborLoadingTotal: z.number(),

  grandTotalHours: z.number(),
  grandTotalCost: z.number(),
  grandTotalFee: z.number(),
  grandTotal: z.number(),
})

/**
 * Conservation assertion (for audit)
 */
export const ArtifactConservationSchema = z.object({
  wbsEstimateCostPlusFee: z.number(),
  wbsEstimateTotal: z.number(),
  wbsEstimateConserved: z.boolean(), // Must be true

  laborLoadingCostPlusFee: z.number(),
  laborLoadingTotal: z.number(),
  laborLoadingConserved: z.boolean(), // Must be true

  allConserved: z.boolean(), // Must be true
})

/**
 * Complete artifact content schema
 */
export const BOEArtifactContentSchema = z.object({
  // Version for future migrations
  schemaVersion: z.literal('1.0.0'),

  // Proposal metadata
  proposal: z.object({
    id: z.string().uuid(),
    title: z.string(),
    solicitationNumber: z.string().nullable(),
    agency: z.string().nullable(),
    contractType: z.string().nullable(),
  }),

  // Rate config at generation time
  rateConfig: ArtifactRateConfigSchema,

  // Document sections in order
  sections: z.array(ArtifactSectionSchema),

  // Aggregate totals (must match sum of line totals)
  totals: ArtifactTotalsSchema,

  // Conservation assertion (for audit)
  conservation: ArtifactConservationSchema,
})

// Type exports
export type BOEArtifactContent = z.infer<typeof BOEArtifactContentSchema>
export type ArtifactEstimateLine = z.infer<typeof ArtifactEstimateLineSchema>
export type ArtifactSection = z.infer<typeof ArtifactSectionSchema>
export type ArtifactPeriod = z.infer<typeof ArtifactPeriodSchema>
export type ArtifactRole = z.infer<typeof ArtifactRoleSchema>
export type ArtifactRateConfig = z.infer<typeof ArtifactRateConfigSchema>
export type ArtifactTotals = z.infer<typeof ArtifactTotalsSchema>
export type ArtifactConservation = z.infer<typeof ArtifactConservationSchema>
export type CalcTrace = z.infer<typeof CalcTraceSchema>
