/**
 * Pricing Lines API
 *
 * GET - Get all pricing lines for a scenario with full traces
 *
 * Single-source principle: totals computed from the fetched rows,
 * not a separate SUM() query.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTenantContext } from '@/lib/tenancy'
import type {
  PricingLineType,
  SalarySource,
  ProfitSource,
  RateConfigSnapshot,
} from '@/lib/commands'

interface PricingLineRow {
  id: string
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

interface IntelligenceLaborRequirementRow {
  id: string
  hours_per_month: number | null
  utilization_pct: number | null
}

interface IntelligencePeriodRow {
  id: string
  name: string
  months: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, scenarioId } = await params

  try {
    const tenantContext = await resolveTenantContext(supabase)
    const tenantId = tenantContext.tenant.id

    // Verify scenario belongs to proposal
    const { data: scenario, error: scenarioError } = await supabase
      .from('pricing_scenarios')
      .select('id, rate_config_snapshot')
      .eq('id', scenarioId)
      .eq('proposal_id', proposalId)
      .eq('tenant_id', tenantId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json(
        { error: 'Pricing scenario not found' },
        { status: 404 }
      )
    }

    // Fetch all lines for scenario
    const { data: lines, error: linesError } = await supabase
      .from('pricing_lines')
      .select('*')
      .eq('pricing_scenario_id', scenarioId)
      .order('period_label')

    if (linesError) {
      console.error('[GET /pricing/[scenarioId]/lines] Failed to load lines:', linesError)
      return NextResponse.json(
        { error: 'Failed to load pricing lines' },
        { status: 500 }
      )
    }

    const lineRows = (lines || []) as PricingLineRow[]

    // Get labor requirement and period data for utilization provenance
    const laborReqIds = [
      ...new Set(
        lineRows
          .filter((l) => l.intelligence_labor_requirement_id)
          .map((l) => l.intelligence_labor_requirement_id as string)
      ),
    ]

    const periodIds = [
      ...new Set(
        lineRows
          .filter((l) => l.intelligence_period_id)
          .map((l) => l.intelligence_period_id as string)
      ),
    ]

    let laborReqMap = new Map<string, IntelligenceLaborRequirementRow>()
    let periodMap = new Map<string, IntelligencePeriodRow>()

    if (laborReqIds.length > 0) {
      const { data: laborReqs } = await supabase
        .from('intelligence_labor_requirements')
        .select('id, hours_per_month, utilization_pct')
        .in('id', laborReqIds)

      laborReqMap = new Map(
        (laborReqs || []).map((r: IntelligenceLaborRequirementRow) => [r.id, r])
      )
    }

    if (periodIds.length > 0) {
      const { data: periods } = await supabase
        .from('intelligence_periods')
        .select('id, name, months')
        .in('id', periodIds)

      periodMap = new Map(
        (periods || []).map((p: IntelligencePeriodRow) => [p.id, p])
      )
    }

    // Transform lines with utilization provenance for labor_loading lines
    const transformedLines = lineRows.map((line) => {
      let utilizationProvenance = null

      if (line.line_type === 'labor_loading' && line.intelligence_labor_requirement_id && line.intelligence_period_id) {
        const laborReq = laborReqMap.get(line.intelligence_labor_requirement_id)
        const period = periodMap.get(line.intelligence_period_id)

        if (laborReq && period) {
          // Calculate utilization from either direct utilization_pct or hours_per_month
          let utilizationPct = laborReq.utilization_pct
          if (utilizationPct === null && laborReq.hours_per_month !== null) {
            // Convert hours_per_month to utilization (160 hours = 100%)
            utilizationPct = (laborReq.hours_per_month / 160) * 100
          }

          if (utilizationPct !== null) {
            utilizationProvenance = {
              utilizationPct: utilizationPct / 100, // Convert to decimal
              periodMonths: period.months,
              sourceText: `derives from confirmed utilization ${utilizationPct.toFixed(0)}% × ${period.months} months`,
            }
          }
        }
      }

      return {
        id: line.id,
        lineType: line.line_type,
        staffingAssignmentId: line.staffing_assignment_id,
        intelligenceLaborRequirementId: line.intelligence_labor_requirement_id,
        intelligencePeriodId: line.intelligence_period_id,
        periodLabel: line.period_label,
        hours: line.hours,
        resolvedSalaryCents: line.resolved_salary_cents,
        salarySource: line.salary_source,
        levelKey: line.level_key,
        stepIndex: line.step_index,
        baseHourly: line.base_hourly,
        fringeAmount: line.fringe_amount,
        overheadBase: line.overhead_base,
        overheadAmount: line.overhead_amount,
        gaAmount: line.ga_amount,
        costBeforeProfit: line.cost_before_profit,
        profitRate: line.profit_rate,
        profitSource: line.profit_source,
        profitAmount: line.profit_amount,
        fullyBurdened: line.fully_burdened,
        escalationRateApplied: line.escalation_rate_applied,
        escalationYearIndex: line.escalation_year_index,
        extendedCost: line.extended_cost,
        utilizationProvenance,
      }
    })

    // Compute totals from the fetched rows (single-source principle)
    const totalHours = lineRows.reduce((sum, l) => sum + l.hours, 0)
    const totalExtendedCost = lineRows.reduce((sum, l) => sum + l.extended_cost, 0)
    // Convert to cents for conservation check, then back to dollars
    const totalExtendedCostCents = Math.round(totalExtendedCost * 100)
    const totalExtendedCostDollars = totalExtendedCostCents / 100

    // Compute per-period totals
    const periodTotalsMap = new Map<string, { hours: number; extendedCost: number }>()
    for (const line of lineRows) {
      const existing = periodTotalsMap.get(line.period_label) || { hours: 0, extendedCost: 0 }
      existing.hours += line.hours
      existing.extendedCost += line.extended_cost
      periodTotalsMap.set(line.period_label, existing)
    }

    const periodTotals = Array.from(periodTotalsMap.entries()).map(([periodLabel, totals]) => ({
      periodLabel,
      hours: totals.hours,
      extendedCost: Number(totals.extendedCost.toFixed(2)),
    }))

    // Check for engine flags (needs utilization backfill)
    // A line needs backfill if it's labor_loading but has no hours (which shouldn't happen
    // if compute succeeded, but we check anyway for robustness)
    const needsUtilizationBackfill = lineRows.some(
      (l) => l.line_type === 'labor_loading' && l.hours === 0
    )

    return NextResponse.json({
      lines: transformedLines,
      totals: {
        total: totalExtendedCostDollars,
        totalCents: totalExtendedCostCents, // For conservation check
        totalHours,
        lineCount: lineRows.length,
        periodTotals,
      },
      rateConfig: scenario.rate_config_snapshot as RateConfigSnapshot,
      engineFlags: {
        needsUtilizationBackfill,
      },
    })
  } catch (error) {
    console.error('[GET /pricing/[scenarioId]/lines] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
