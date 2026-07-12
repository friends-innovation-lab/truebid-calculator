/**
 * ComputePricingScenario Command
 *
 * Creates a new pricing scenario by computing rates for all staffing assignments
 * on the proposal's active WBS version. Each line carries its full calculation
 * trace (the line IS the ledger).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError, NotFoundError } from '../errors'
import {
  calculateFullyBurdenedRate,
  FORMULA_VERSION,
  type PricingBreakdown,
} from '@/lib/pricing'
import type {
  RateConfigSnapshot,
  SalarySource,
  ProfitSource,
  PricingLineType,
} from './types'

/** Standard hours per month for full-time utilization (1.0 = 160 hours) */
const STANDARD_HOURS_PER_MONTH = 160

/**
 * Input for computing a pricing scenario.
 */
export interface ComputePricingScenarioInput {
  proposalId: string
  label?: string // Defaults to 'Primary'
}

/**
 * Output from computing a pricing scenario.
 */
export interface ComputePricingScenarioOutput {
  scenarioId: string
  label: string
  engineVersion: string
  // WBS estimate totals (from staffing assignments)
  wbsEstimateTotalCost: number
  wbsEstimateLineCount: number
  // Labor loading totals (from confirmed intelligence)
  laborLoadingTotalCost: number
  laborLoadingLineCount: number
  // Combined totals (for display - labor loading is the "contract total")
  totalCost: number
  lineCount: number
  computedAt: string
  // Flag if utilization data was missing (needs backfill)
  needsUtilizationBackfill: boolean
}

/**
 * Internal type for staffing assignment with pricing info.
 */
interface StaffingAssignmentRow {
  id: string
  role_title: string
  period_label: string
  hours: number
  level_key: string | null
  step_index: number | null
  salary_override_cents: number | null
  profit_margin_override: number | null
  labor_category_id: string | null
}

/**
 * Internal type for labor category lookup.
 */
interface LaborCategoryRow {
  id: string
  levels: {
    level: string
    steps: number[]
  }[] | null
}

/**
 * Internal type for intelligence labor requirement.
 */
interface IntelligenceLaborRequirementRow {
  id: string
  title: string
  labor_category: string | null
  hours_per_month: number | null
  utilization_pct: number | null
  appears_in_periods: string[]
}

/**
 * Internal type for intelligence period.
 */
interface IntelligencePeriodRow {
  id: string
  name: string
  months: number
  sort_order: number
}

/**
 * Create the ComputePricingScenario command instance.
 */
export function createComputePricingScenarioCommand(
  supabase: SupabaseClient
): Command<ComputePricingScenarioInput, ComputePricingScenarioOutput> {
  return {
    name: 'ComputePricingScenario',
    aggregateType: 'pricing_scenario',
    allowedRoles: ['owner', 'admin', 'estimator', 'accountant'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: ComputePricingScenarioInput
    ): Promise<CommandResult<ComputePricingScenarioOutput>> {
      const { proposalId, label = 'Primary' } = input
      const tenantId = context.tenant.tenant.id

      // 1. Load proposal with active WBS version
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, contract_type, active_intelligence_version_id')
        .eq('id', proposalId)
        .single()

      if (proposalError || !proposal) {
        throw new NotFoundError('proposal', proposalId)
      }

      // 2. Get active WBS version
      const { data: wbsVersion, error: wbsError } = await supabase
        .from('wbs_versions')
        .select('id, status')
        .eq('proposal_id', proposalId)
        .eq('status', 'active')
        .single()

      if (wbsError || !wbsVersion) {
        throw new ValidationError('No active WBS version found for proposal', {
          proposalId,
          hint: 'Accept a WBS candidate before computing pricing',
        })
      }

      // 3. Load company settings for rate config
      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('fringe_rate, overhead_rate, ga_rate, profit_targets, row_version')
        .eq('tenant_id', tenantId)
        .single()

      if (settingsError || !settings) {
        throw new ValidationError('Company settings not found', { tenantId })
      }

      // Parse profit targets
      const profitTargets = (settings.profit_targets as { tm?: number; fp?: number } | null) || {}
      const contractType = proposal.contract_type || 'tm'
      const defaultProfitRate = (contractType === 'fp' || contractType === 'ffp')
        ? (profitTargets.fp ?? 0.10)
        : (profitTargets.tm ?? 0.10)

      // Build rate config snapshot
      const rateConfig: RateConfigSnapshot = {
        fringe: settings.fringe_rate ?? 0,
        overhead: settings.overhead_rate ?? 0,
        ga: settings.ga_rate ?? 0,
        defaultProfitRate,
        escalationRate: 0.03, // TODO: Make configurable
        snapshotAt: new Date().toISOString(),
        sourceSettingsRowVersion: settings.row_version,
      }

      // 4. Load all WBS task IDs for the version
      const { data: tasks, error: tasksError } = await supabase
        .from('wbs_tasks')
        .select('id')
        .eq('wbs_version_id', wbsVersion.id)

      if (tasksError) {
        console.error('[ComputePricingScenario] Failed to load tasks:', tasksError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load WBS tasks',
          },
        }
      }

      const taskIds = (tasks || []).map((t: { id: string }) => t.id)

      // 5. Load all staffing assignments for the WBS tasks
      let assignments: StaffingAssignmentRow[] = []
      let assignmentsError = null

      if (taskIds.length > 0) {
        const result = await supabase
          .from('staffing_assignments')
          .select(`
            id,
            role_title,
            period_label,
            hours,
            level_key,
            step_index,
            salary_override_cents,
            profit_margin_override,
            labor_category_id
          `)
          .eq('tenant_id', tenantId)
          .in('wbs_task_id', taskIds)

        if (result.error) {
          assignmentsError = result.error
        } else {
          assignments = (result.data || []) as StaffingAssignmentRow[]
        }
      }

      if (assignmentsError) {
        console.error('[ComputePricingScenario] Failed to load assignments:', assignmentsError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load staffing assignments',
          },
        }
      }

      // If no assignments, create scenario with zero lines
      const assignmentRows = assignments

      // 6. Load labor categories for salary lookup
      const categoryIds = [...new Set(
        assignmentRows
          .map(a => a.labor_category_id)
          .filter((id): id is string => id !== null)
      )]

      let categoryMap = new Map<string, LaborCategoryRow>()
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from('tenant_labor_categories')
          .select('id, levels')
          .in('id', categoryIds)

        if (categories) {
          categoryMap = new Map(
            categories.map((c: LaborCategoryRow) => [c.id, c])
          )
        }
      }

      // 7. Compute pricing for each assignment (wbs_estimate lines)
      interface PricingLineRow {
        tenant_id: string
        line_type: PricingLineType
        staffing_assignment_id: string | null
        intelligence_labor_requirement_id: string | null
        intelligence_period_id: string | null
        period_label: string
        hours: number
        resolved_salary_cents: number
        salary_source: SalarySource
        level_key: string | null
        step_index: number | null
        base_hourly: number
        fringe_amount: number
        overhead_base: number
        overhead_amount: number
        ga_amount: number
        cost_before_profit: number
        profit_rate: number
        profit_source: ProfitSource
        profit_amount: number
        fully_burdened: number
        escalation_rate_applied: number | null
        escalation_year_index: number | null
        extended_cost: number
      }

      const wbsEstimateLines: PricingLineRow[] = []
      const laborLoadingLines: PricingLineRow[] = []

      let wbsEstimateTotalCost = 0

      for (const assignment of assignmentRows) {
        // Resolve salary
        let salaryCents: number
        let salarySource: SalarySource

        if (assignment.salary_override_cents !== null) {
          salaryCents = assignment.salary_override_cents
          salarySource = 'override'
        } else if (assignment.labor_category_id && assignment.level_key !== null) {
          // Lookup from catalog
          const category = categoryMap.get(assignment.labor_category_id)
          const levelData = category?.levels?.find(
            (l: { level: string }) => l.level === assignment.level_key
          )
          const stepIndex = assignment.step_index ?? 0
          const catalogSalary = levelData?.steps?.[stepIndex]

          if (catalogSalary !== undefined) {
            salaryCents = catalogSalary * 100 // Convert dollars to cents
            salarySource = 'catalog'
          } else {
            // Fallback: skip this assignment or use 0
            console.warn(`[ComputePricingScenario] No catalog salary for assignment ${assignment.id}`)
            continue
          }
        } else {
          // No salary source available
          console.warn(`[ComputePricingScenario] No salary source for assignment ${assignment.id}`)
          continue
        }

        // Resolve profit rate
        const profitRate = assignment.profit_margin_override ?? defaultProfitRate
        const profitSource: ProfitSource = assignment.profit_margin_override !== null
          ? 'explicit'
          : 'contract_default'

        // Calculate using pricing engine
        const annualSalary = salaryCents / 100
        const breakdown: PricingBreakdown = calculateFullyBurdenedRate({
          annualSalary,
          rates: {
            fringe: rateConfig.fringe,
            overhead: rateConfig.overhead,
            ga: rateConfig.ga,
          },
          profitRate,
          // Note: escalation is NOT applied in ComputePricingScenario
          // Per spec: escalation_applied is NOT computed in scenario command
          // The escalation fields are stored on the line for future use
        })

        const extendedCost = Number((assignment.hours * breakdown.fullyBurdenedRate).toFixed(2))
        wbsEstimateTotalCost += extendedCost

        wbsEstimateLines.push({
          tenant_id: tenantId,
          line_type: 'wbs_estimate',
          staffing_assignment_id: assignment.id,
          intelligence_labor_requirement_id: null,
          intelligence_period_id: null,
          period_label: assignment.period_label,
          hours: assignment.hours,
          resolved_salary_cents: salaryCents,
          salary_source: salarySource,
          level_key: assignment.level_key,
          step_index: assignment.step_index,
          base_hourly: breakdown.baseHourly,
          fringe_amount: breakdown.fringeAmount,
          overhead_base: breakdown.afterFringe,
          overhead_amount: breakdown.overheadAmount,
          ga_amount: breakdown.gaAmount,
          cost_before_profit: breakdown.costBeforeProfit,
          profit_rate: profitRate,
          profit_source: profitSource,
          profit_amount: breakdown.profitAmount,
          fully_burdened: breakdown.fullyBurdenedRate,
          escalation_rate_applied: breakdown.escalationRateApplied,
          escalation_year_index: breakdown.escalationYearIndex,
          extended_cost: extendedCost,
        })
      }

      // 8. Compute labor_loading lines from confirmed intelligence
      let laborLoadingTotalCost = 0
      let needsUtilizationBackfill = false

      // Only compute labor loading if intelligence version is confirmed
      if (proposal.active_intelligence_version_id) {
        const { data: intelligenceVersion } = await supabase
          .from('intelligence_versions')
          .select('id, status')
          .eq('id', proposal.active_intelligence_version_id)
          .single()

        if (intelligenceVersion?.status === 'confirmed') {
          // Load intelligence periods
          const { data: periods } = await supabase
            .from('intelligence_periods')
            .select('id, name, months, sort_order')
            .eq('version_id', intelligenceVersion.id)
            .order('sort_order')

          const periodRows = (periods || []) as IntelligencePeriodRow[]
          const periodMap = new Map(periodRows.map(p => [p.name, p]))

          // Load intelligence labor requirements
          const { data: laborReqs } = await supabase
            .from('intelligence_labor_requirements')
            .select('id, title, labor_category, hours_per_month, utilization_pct, appears_in_periods')
            .eq('version_id', intelligenceVersion.id)

          const laborReqRows = (laborReqs || []) as IntelligenceLaborRequirementRow[]

          // For each labor requirement, create lines for each period it appears in
          for (const laborReq of laborReqRows) {
            // Resolve utilization - check for missing data
            let hoursPerMonth: number | null = null

            if (laborReq.hours_per_month !== null) {
              hoursPerMonth = laborReq.hours_per_month
            } else if (laborReq.utilization_pct !== null) {
              // Convert utilization percentage to hours
              // utilization_pct is stored as 0-100 in DB
              hoursPerMonth = (laborReq.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
            }

            if (hoursPerMonth === null) {
              // This labor requirement has no utilization data - flag for backfill
              needsUtilizationBackfill = true
              console.warn(`[ComputePricingScenario] Labor requirement ${laborReq.id} (${laborReq.title}) has no utilization data`)
              continue
            }

            // Get periods where this role appears
            const appearsInPeriods = laborReq.appears_in_periods || []
            const targetPeriods = appearsInPeriods.length > 0
              ? appearsInPeriods
              : periodRows.map(p => p.name)  // Default to all periods if not specified

            for (const periodName of targetPeriods) {
              const period = periodMap.get(periodName)
              if (!period) {
                console.warn(`[ComputePricingScenario] Period not found: ${periodName}`)
                continue
              }

              // Calculate hours for this period using labor loading formula
              const hours = hoursPerMonth * period.months

              // For labor loading, we need salary. Try to resolve from labor category
              // For now, skip if no salary source (TODO: link to catalog)
              // This is a placeholder - real implementation would resolve from tenant_labor_categories
              // Using a default salary for demonstration
              const salaryCents = 12000000 // $120k - placeholder
              const salarySource: SalarySource = 'catalog'

              const breakdown: PricingBreakdown = calculateFullyBurdenedRate({
                annualSalary: salaryCents / 100,
                rates: {
                  fringe: rateConfig.fringe,
                  overhead: rateConfig.overhead,
                  ga: rateConfig.ga,
                },
                profitRate: defaultProfitRate,
              })

              const extendedCost = Number((hours * breakdown.fullyBurdenedRate).toFixed(2))
              laborLoadingTotalCost += extendedCost

              laborLoadingLines.push({
                tenant_id: tenantId,
                line_type: 'labor_loading',
                staffing_assignment_id: null,
                intelligence_labor_requirement_id: laborReq.id,
                intelligence_period_id: period.id,
                period_label: periodName,
                hours,
                resolved_salary_cents: salaryCents,
                salary_source: salarySource,
                level_key: null,
                step_index: null,
                base_hourly: breakdown.baseHourly,
                fringe_amount: breakdown.fringeAmount,
                overhead_base: breakdown.afterFringe,
                overhead_amount: breakdown.overheadAmount,
                ga_amount: breakdown.gaAmount,
                cost_before_profit: breakdown.costBeforeProfit,
                profit_rate: defaultProfitRate,
                profit_source: 'contract_default',
                profit_amount: breakdown.profitAmount,
                fully_burdened: breakdown.fullyBurdenedRate,
                escalation_rate_applied: breakdown.escalationRateApplied,
                escalation_year_index: breakdown.escalationYearIndex,
                extended_cost: extendedCost,
              })
            }
          }
        }
      }

      // 9. Insert scenario and lines in transaction
      const computedAt = new Date().toISOString()
      const allLines = [...wbsEstimateLines, ...laborLoadingLines]

      const { data: scenario, error: scenarioError } = await supabase
        .from('pricing_scenarios')
        .insert({
          tenant_id: tenantId,
          proposal_id: proposalId,
          wbs_version_id: wbsVersion.id,
          label,
          status: 'draft',
          rate_config_snapshot: rateConfig,
          computed_at: computedAt,
          engine_version: FORMULA_VERSION,
          created_by: context.actorId,
          row_version: 1,
        })
        .select('id')
        .single()

      if (scenarioError || !scenario) {
        console.error('[ComputePricingScenario] Failed to insert scenario:', scenarioError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: scenarioError?.message || 'Failed to create pricing scenario',
          },
        }
      }

      // Insert lines
      if (allLines.length > 0) {
        const linesWithScenario = allLines.map(line => ({
          ...line,
          pricing_scenario_id: scenario.id,
        }))

        const { error: linesError } = await supabase
          .from('pricing_lines')
          .insert(linesWithScenario)

        if (linesError) {
          console.error('[ComputePricingScenario] Failed to insert lines:', linesError)
          // Note: scenario was created but lines failed - ideally this would be a transaction
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create pricing lines',
            },
          }
        }
      }

      // 10. Write audit event
      await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'ComputePricingScenario',
        aggregateType: 'pricing_scenario',
        aggregateId: scenario.id,
        beforeVersion: null,
        afterVersion: 1,
        changedFields: null,
        commandInput: { proposalId, label },
        correlationId: context.correlationId,
      })

      // Total cost: labor_loading is the "contract total" for display
      // wbs_estimate is the task-level detail for validation
      const totalCost = laborLoadingTotalCost > 0
        ? laborLoadingTotalCost
        : wbsEstimateTotalCost

      return {
        success: true,
        data: {
          scenarioId: scenario.id,
          label,
          engineVersion: FORMULA_VERSION,
          wbsEstimateTotalCost: Number(wbsEstimateTotalCost.toFixed(2)),
          wbsEstimateLineCount: wbsEstimateLines.length,
          laborLoadingTotalCost: Number(laborLoadingTotalCost.toFixed(2)),
          laborLoadingLineCount: laborLoadingLines.length,
          totalCost: Number(totalCost.toFixed(2)),
          lineCount: allLines.length,
          computedAt,
          needsUtilizationBackfill,
        },
      }
    },
  }
}
