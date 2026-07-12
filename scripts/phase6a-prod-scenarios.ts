/**
 * Phase 6A Production Scenario Computation
 *
 * Computes first Primary pricing scenarios for all proposals.
 */

import { createClient } from '@supabase/supabase-js'
import { calculateFullyBurdenedRate, FORMULA_VERSION } from '../lib/pricing'

const PROD_URL = process.env.PROD_SUPABASE_URL || 'https://qtotsijebcpddipmzstb.supabase.co'
const PROD_KEY = process.env.PROD_SERVICE_ROLE_KEY || ''

if (!PROD_KEY) {
  console.error('ERROR: PROD_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(PROD_URL, PROD_KEY)

interface RateConfig {
  fringe: number
  overhead: number
  ga: number
  defaultProfitRate: number
  escalationRate: number
  snapshotAt: string
  sourceSettingsRowVersion: number
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  Phase 6A Production Scenario Computation                        ║')
  console.log('║  Target: PRODUCTION (qtotsijebcpddipmzstb)                        ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  // Get tenant and rates
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, company_id')
    .eq('name', 'Friends From The City')
    .single()

  if (!tenant) {
    console.error('Tenant not found')
    process.exit(1)
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', tenant.company_id)
    .single()

  if (!settings) {
    console.error('Company settings not found')
    process.exit(1)
  }

  const rates = {
    fringe: Number(settings.fringe_rate),
    overhead: Number(settings.overhead_rate),
    ga: Number(settings.ga_rate),
  }
  const defaultProfit = Number(settings.profit_rate)
  const escalationRate = Number(settings.escalation_rate)

  console.log(`\nTenant: ${tenant.name}`)
  console.log(`Rates: fringe=${rates.fringe}, overhead=${rates.overhead}, G&A=${rates.ga}`)
  console.log(`Profit: ${defaultProfit}, Escalation: ${escalationRate}`)

  // Get all proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, company_id')
    .eq('company_id', tenant.company_id)

  for (const proposal of (proposals || [])) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`PROPOSAL: ${proposal.title}`)
    console.log('═'.repeat(70))

    // Check for active WBS
    const { data: wbs } = await supabase
      .from('wbs_versions')
      .select('id, version_number')
      .eq('proposal_id', proposal.id)
      .eq('status', 'active')
      .single()

    if (!wbs) {
      console.log('\n⚠ NO ACTIVE WBS - VACUOUS (skipped, no scenario created)')
      console.log('  Cannot create pricing scenario without WBS version.')
      continue
    }

    console.log(`\nWBS Version: ${wbs.id} (v${wbs.version_number})`)

    // Get staffing assignments
    const { data: assignments } = await supabase
      .from('staffing_assignments')
      .select(`
        id,
        role_title,
        period_label,
        hours,
        salary_override_cents,
        profit_margin_override,
        wbs_task_id
      `)
      .eq('tenant_id', tenant.id)
      .in('wbs_task_id', (
        await supabase.from('wbs_tasks').select('id').eq('wbs_version_id', wbs.id)
      ).data?.map(t => t.id) || [])

    console.log(`\nAssignments: ${assignments?.length || 0}`)

    // Compute lines
    const lines: any[] = []
    let totalCost = 0
    const skippedNoSalary: string[] = []

    for (const a of (assignments || [])) {
      // Skip assignments without salary - these need catalog resolution
      if (!a.salary_override_cents) {
        skippedNoSalary.push(`${a.role_title} (${a.period_label})`)
        continue
      }

      const salary = a.salary_override_cents / 100
      const profitRate = a.profit_margin_override ?? defaultProfit

      const breakdown = calculateFullyBurdenedRate({
        annualSalary: salary,
        rates,
        profitRate,
      })

      const extended = a.hours * breakdown.fullyBurdenedRate
      totalCost += extended

      lines.push({
        tenant_id: tenant.id,
        line_type: 'wbs_estimate',
        staffing_assignment_id: a.id,
        intelligence_labor_requirement_id: null,
        intelligence_period_id: null,
        period_label: a.period_label,
        hours: a.hours,
        resolved_salary_cents: a.salary_override_cents,
        salary_source: a.salary_override_cents ? 'override' : 'catalog',
        level_key: null,
        step_index: null,
        base_hourly: breakdown.baseHourly,
        fringe_amount: breakdown.fringeAmount,
        overhead_base: breakdown.afterFringe,
        overhead_amount: breakdown.overheadAmount,
        ga_amount: breakdown.gaAmount,
        cost_before_profit: breakdown.costBeforeProfit,
        profit_rate: profitRate,
        profit_source: a.profit_margin_override ? 'explicit' : 'contract_default',
        profit_amount: breakdown.profitAmount,
        fully_burdened: breakdown.fullyBurdenedRate,
        escalation_rate_applied: null,
        escalation_year_index: null,
        extended_cost: Number(extended.toFixed(2)),
      })
    }

    // Check if scenario already exists
    const { data: existing } = await supabase
      .from('pricing_scenarios')
      .select('id')
      .eq('proposal_id', proposal.id)
      .eq('label', 'Primary')

    if (existing && existing.length > 0) {
      console.log(`  Scenario already exists: ${existing[0].id}`)
      console.log(`  Would have computed: ${lines.length} lines, $${totalCost.toFixed(2)}`)
      continue
    }

    // Create scenario
    const rateConfig: RateConfig = {
      fringe: rates.fringe,
      overhead: rates.overhead,
      ga: rates.ga,
      defaultProfitRate: defaultProfit,
      escalationRate,
      snapshotAt: new Date().toISOString(),
      sourceSettingsRowVersion: 1,
    }

    const { data: scenario, error: scenarioError } = await supabase
      .from('pricing_scenarios')
      .insert({
        tenant_id: tenant.id,
        proposal_id: proposal.id,
        wbs_version_id: wbs.id,
        label: 'Primary',
        status: 'draft',
        rate_config_snapshot: rateConfig,
        computed_at: new Date().toISOString(),
        engine_version: FORMULA_VERSION,
        row_version: 1,
      })
      .select('id')
      .single()

    if (scenarioError) {
      console.error(`  Scenario error: ${scenarioError.message}`)
      continue
    }

    // Insert lines
    const linesWithScenario = lines.map(l => ({
      ...l,
      pricing_scenario_id: scenario.id,
    }))

    const { error: linesError } = await supabase.from('pricing_lines').insert(linesWithScenario)

    if (linesError) {
      console.error(`  Lines error: ${linesError.message}`)
      continue
    }

    console.log(`\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`)
    console.log(`┃ SCENARIO COMPUTED                                                  ┃`)
    console.log(`┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫`)
    console.log(`┃ Scenario ID: ${scenario.id}  ┃`)
    console.log(`┃ Lines:       ${lines.length.toString().padStart(4)} (rate-level)                               ┃`)
    console.log(`┃ Skipped:     ${skippedNoSalary.length.toString().padStart(4)} (no salary)                                ┃`)
    console.log(`┃ Total Cost:  $${totalCost.toFixed(2).padStart(12)}                                ┃`)
    console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`)

    if (skippedNoSalary.length > 0) {
      console.log(`\n⚠ Assignments without salary (need catalog resolution):`)
      const unique = [...new Set(skippedNoSalary)]
      unique.slice(0, 5).forEach(s => console.log(`  - ${s}`))
      if (unique.length > 5) console.log(`  ... and ${unique.length - 5} more`)
    }
  }

  // Check needs_utilization flags
  console.log('\n' + '═'.repeat(70))
  console.log('NEEDS UTILIZATION FLAGS')
  console.log('═'.repeat(70))

  const { data: missingUtil } = await supabase
    .from('intelligence_labor_requirements')
    .select(`
      title,
      hours_per_month,
      utilization_pct,
      version_id,
      intelligence_versions!inner(proposal_id, proposals!inner(title))
    `)
    .is('hours_per_month', null)
    .is('utilization_pct', null)

  if (missingUtil && missingUtil.length > 0) {
    console.log('\nRoles missing utilization:')
    for (const r of missingUtil) {
      const proposalTitle = (r.intelligence_versions as any)?.proposals?.title || 'Unknown'
      console.log(`  ⚠ ${r.title} (${proposalTitle})`)
    }
  } else {
    console.log('\nNo roles missing utilization.')
  }

  console.log('\n✓ Scenario computation complete.')
}

main().catch(console.error)
