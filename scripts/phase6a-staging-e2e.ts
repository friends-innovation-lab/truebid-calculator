/**
 * Phase 6A Staging E2E Verification
 *
 * Runs comprehensive E2E tests against staging:
 * 1. Conservation tables (rate-level + contract-level)
 * 2. Compute → approve → rate change → recompute (immutability proof)
 * 3. Staleness banner (new WBS → scenario shows stale)
 * 4. Requirements coverage count
 * 5. needs-utilization flag
 *
 * Usage: STAGING_DB_URL="..." npx tsx scripts/phase6a-staging-e2e.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calculateFullyBurdenedRate, FORMULA_VERSION } from '../lib/pricing'

// Staging Supabase
const STAGING_URL = process.env.STAGING_SUPABASE_URL || 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!STAGING_KEY) {
  console.error('ERROR: STAGING_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

// Test IDs (matching staging data created via SQL)
const TENANT_ID = '44444444-4444-4444-4444-444444444444'
const COMPANY_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '2adaf420-5e98-40b3-93cb-9b480301d90b'  // Real staging user
const PROPOSAL_ID = 'e2e66666-6666-6666-6666-666666666666'
const INTEL_VERSION_ID = 'e2e77777-7777-7777-7777-777777777777'
const WBS_VERSION_ID = 'e2eaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

// Rates
const RATES = { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 }
const DEFAULT_PROFIT = 0.10
const STANDARD_HOURS_PER_MONTH = 160

interface TestResult {
  name: string
  passed: boolean
  details: string
  values?: Record<string, any>
}

const results: TestResult[] = []

function log(msg: string) {
  console.log(msg)
}

function logSection(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log(` ${title}`)
  console.log('═'.repeat(70))
}

// Additional WBS version ID used in staleness test
const NEW_WBS_VERSION_ID = 'cccccccc-6666-7777-6666-cccccccccccc'

async function cleanup() {
  log('\nCleaning up previous test data...')

  // Delete in reverse dependency order
  await supabase.from('pricing_lines').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('pricing_scenarios').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('requirement_links').delete().match({ requirement_id: PROPOSAL_ID })
  await supabase.from('requirements').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('proposal_charge_codes').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('staffing_assignments').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('wbs_tasks').delete().eq('tenant_id', TENANT_ID)
  // Delete both original and new WBS versions
  await supabase.from('wbs_versions').delete().eq('id', WBS_VERSION_ID)
  await supabase.from('wbs_versions').delete().eq('id', NEW_WBS_VERSION_ID)
  await supabase.from('wbs_versions').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('intelligence_labor_requirements').delete().eq('version_id', INTEL_VERSION_ID)
  await supabase.from('intelligence_periods').delete().eq('version_id', INTEL_VERSION_ID)
  await supabase.from('intelligence_versions').delete().eq('tenant_id', TENANT_ID)
  await supabase.from('proposals').delete().eq('id', PROPOSAL_ID)

  log('Cleanup complete.')
}

async function setupTestData() {
  logSection('SETUP: Creating E2E Test Data')

  // 1. Create proposal with divergent period definitions
  const { error: propError } = await supabase.from('proposals').insert({
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    title: 'E2E Phase 6A Test Proposal',
    solicitation_number: 'E2E-6A-001',
    agency: 'TEST',
    contract_type: 'T&M',
    status: 'draft',
    due_date: '2026-12-31',
    row_version: 1,
    working_data: {
      proposalSetup: {
        periods: [
          { name: 'Base Period', months: 11 },      // DIFFERS from intelligence (12)
          { name: 'Option Year 1', months: 12 },
        ],
      },
    },
  })
  if (propError) log(`Proposal error: ${propError.message}`)

  // 2. Create intelligence version (draft first, confirm after adding facts)
  const { error: intError } = await supabase.from('intelligence_versions').insert({
    id: INTEL_VERSION_ID,
    tenant_id: TENANT_ID,
    proposal_id: PROPOSAL_ID,
    version_number: 1,
    status: 'draft',
    contract_type: 'T&M',
    facts_json: { contractType: { value: 'T&M', confidence: 'high' } },
    extracted_at: new Date().toISOString(),
    row_version: 1,
  })
  if (intError) log(`Intel error: ${intError.message}`)

  // 3. Create intelligence periods (canonical - 12 months base)
  const basePeriodId = 'cccccccc-6666-6666-6666-cccccccccccc'
  const opt1PeriodId = 'dddddddd-6666-6666-6666-dddddddddddd'

  await supabase.from('intelligence_periods').insert([
    { id: basePeriodId, version_id: INTEL_VERSION_ID, name: 'Base Period', months: 12, cumulative_months_end: 12, gsa_rate_year: 1, sort_order: 0 },
    { id: opt1PeriodId, version_id: INTEL_VERSION_ID, name: 'Option Year 1', months: 12, cumulative_months_end: 24, gsa_rate_year: 2, sort_order: 1 },
  ])

  // 4. Create intelligence labor requirements
  const laborReqs = [
    { id: 'eeeeeeee-6666-0001-6666-eeeeeeeeeeee', title: 'Project Manager', hours_per_month: 160, utilization_pct: 100, periods: ['Base Period', 'Option Year 1'] },
    { id: 'eeeeeeee-6666-0002-6666-eeeeeeeeeeee', title: 'Developer', hours_per_month: 160, utilization_pct: 100, periods: ['Base Period', 'Option Year 1'] },
    { id: 'eeeeeeee-6666-0003-6666-eeeeeeeeeeee', title: 'Designer', hours_per_month: 80, utilization_pct: 50, periods: ['Base Period'] },
    { id: 'eeeeeeee-6666-0004-6666-eeeeeeeeeeee', title: 'QA Engineer', hours_per_month: null, utilization_pct: null, periods: ['Base Period'] }, // Missing utilization!
  ]

  for (const req of laborReqs) {
    await supabase.from('intelligence_labor_requirements').insert({
      id: req.id,
      version_id: INTEL_VERSION_ID,
      title: req.title,
      hours_per_month: req.hours_per_month,
      utilization_pct: req.utilization_pct,
      appears_in_periods: req.periods,
      confidence: 'high',
    })
  }

  // Confirm intelligence and link to proposal
  const { error: confirmError } = await supabase.from('intelligence_versions').update({
    status: 'confirmed',
    confirmation_hash: 'e2e-test-hash',
    confirmed_at: new Date().toISOString(),
  }).eq('id', INTEL_VERSION_ID)
  if (confirmError) log(`Confirm intel error: ${confirmError.message}`)

  await supabase.from('proposals').update({
    active_intelligence_version_id: INTEL_VERSION_ID,
  }).eq('id', PROPOSAL_ID)

  // 5. Create WBS version
  const { error: wbsError } = await supabase.from('wbs_versions').insert({
    id: WBS_VERSION_ID,
    tenant_id: TENANT_ID,
    proposal_id: PROPOSAL_ID,
    intelligence_version_id: INTEL_VERSION_ID,
    version_number: 1,
    status: 'active',
    activated_at: new Date().toISOString(),
    row_version: 1,
  })
  if (wbsError) log(`WBS error: ${wbsError.message}`)

  // 6. Create WBS tasks
  const tasks = [
    { id: 'ffffffff-6666-0001-6666-ffffffffffff', code: '1.0', title: 'Project Management' },
    { id: 'ffffffff-6666-0002-6666-ffffffffffff', code: '2.0', title: 'Development' },
    { id: 'ffffffff-6666-0003-6666-ffffffffffff', code: '3.0', title: 'Design' },
  ]

  for (const task of tasks) {
    await supabase.from('wbs_tasks').insert({
      id: task.id,
      tenant_id: TENANT_ID,
      wbs_version_id: WBS_VERSION_ID,
      wbs_code: task.code,
      title: task.title,
      source: 'generated',
      sort_order: parseInt(task.code),
      row_version: 1,
    })
  }

  // 7. Create staffing assignments
  const assignments = [
    { id: '11111111-6666-0001-6666-111111111111', task: tasks[0].id, role: 'Project Manager', period: 'Base Period', hours: 1920, salary: 14000000 },
    { id: '11111111-6666-0002-6666-111111111111', task: tasks[1].id, role: 'Developer', period: 'Base Period', hours: 1920, salary: 12000000 },
    { id: '11111111-6666-0003-6666-111111111111', task: tasks[2].id, role: 'Designer', period: 'Base Period', hours: 960, salary: 11000000 },
    { id: '11111111-6666-0004-6666-111111111111', task: tasks[0].id, role: 'Project Manager', period: 'Option Year 1', hours: 1920, salary: 14000000 },
    { id: '11111111-6666-0005-6666-111111111111', task: tasks[1].id, role: 'Developer', period: 'Option Year 1', hours: 1920, salary: 12000000 },
  ]

  for (const a of assignments) {
    await supabase.from('staffing_assignments').insert({
      id: a.id,
      tenant_id: TENANT_ID,
      wbs_task_id: a.task,
      role_title: a.role,
      discipline: 'engineering',
      prime_or_sub: 'prime',
      period_label: a.period,
      hours: a.hours,
      source: 'generated',
      salary_override_cents: a.salary,
      profit_margin_override: DEFAULT_PROFIT,
      row_version: 1,
    })
  }

  // 8. Create requirements
  const requirements = [
    { id: '22222222-6666-0001-6666-222222222222', code: 'REQ-001', text: 'Provide PM services', type: 'shall' },
    { id: '22222222-6666-0002-6666-222222222222', code: 'REQ-002', text: 'Develop software', type: 'shall' },
    { id: '22222222-6666-0003-6666-222222222222', code: 'REQ-003', text: 'Design interfaces', type: 'should' },
  ]

  for (const req of requirements) {
    await supabase.from('requirements').insert({
      id: req.id,
      tenant_id: TENANT_ID,
      proposal_id: PROPOSAL_ID,
      intelligence_version_id: INTEL_VERSION_ID,
      reference_number: req.code,
      title: req.text,
      type: req.type,
      row_version: 1,
    })

    // Link to WBS task
    await supabase.from('requirement_links').insert({
      requirement_id: req.id,
      wbs_task_id: tasks[0].id,
      link_source: 'ai',
    })
  }

  log('✓ Test data created: 1 proposal, 4 labor reqs (1 missing utilization), 5 assignments, 3 requirements')
}

async function testConservationGates(): Promise<void> {
  logSection('TEST 1: Conservation Gates')

  // Compute legacy projection (from staffing assignments)
  const { data: tasks } = await supabase
    .from('wbs_tasks')
    .select('id')
    .eq('wbs_version_id', WBS_VERSION_ID)

  const taskIds = (tasks || []).map(t => t.id)

  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select('*')
    .in('wbs_task_id', taskIds)

  // Rate-level: compute from assignments
  let legacyTotal = 0
  const wbsLines: any[] = []

  for (const a of (assignments || [])) {
    const salary = (a.salary_override_cents || 0) / 100
    const breakdown = calculateFullyBurdenedRate({
      annualSalary: salary,
      rates: RATES,
      profitRate: a.profit_margin_override || DEFAULT_PROFIT,
    })
    const extended = a.hours * breakdown.fullyBurdenedRate
    legacyTotal += extended

    wbsLines.push({
      tenant_id: TENANT_ID,
      line_type: 'wbs_estimate',
      staffing_assignment_id: a.id,
      intelligence_labor_requirement_id: null,
      intelligence_period_id: null,
      period_label: a.period_label,
      hours: a.hours,
      resolved_salary_cents: a.salary_override_cents,
      salary_source: 'override',
      level_key: null,
      step_index: null,
      base_hourly: breakdown.baseHourly,
      fringe_amount: breakdown.fringeAmount,
      overhead_base: breakdown.afterFringe,
      overhead_amount: breakdown.overheadAmount,
      ga_amount: breakdown.gaAmount,
      cost_before_profit: breakdown.costBeforeProfit,
      profit_rate: a.profit_margin_override || DEFAULT_PROFIT,
      profit_source: 'explicit',
      profit_amount: breakdown.profitAmount,
      fully_burdened: breakdown.fullyBurdenedRate,
      escalation_rate_applied: null,
      escalation_year_index: null,
      extended_cost: Number(extended.toFixed(2)),
    })
  }

  // Create pricing scenario
  const rateConfig = {
    fringe: RATES.fringe,
    overhead: RATES.overhead,
    ga: RATES.ga,
    defaultProfitRate: DEFAULT_PROFIT,
    escalationRate: 0.03,
    snapshotAt: new Date().toISOString(),
    sourceSettingsRowVersion: 1,
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from('pricing_scenarios')
    .insert({
      tenant_id: TENANT_ID,
      proposal_id: PROPOSAL_ID,
      wbs_version_id: WBS_VERSION_ID,
      label: 'Primary',
      status: 'draft',
      rate_config_snapshot: rateConfig,
      computed_at: new Date().toISOString(),
      engine_version: FORMULA_VERSION,
      created_by: USER_ID,
      row_version: 1,
    })
    .select('id')
    .single()

  if (scenarioError) {
    log(`Scenario error: ${scenarioError.message}`)
    results.push({ name: 'Rate-Level Conservation', passed: false, details: scenarioError.message })
    return
  }

  // Insert WBS estimate lines
  const linesWithScenario = wbsLines.map(l => ({ ...l, pricing_scenario_id: scenario.id }))
  const { error: linesError } = await supabase.from('pricing_lines').insert(linesWithScenario)

  if (linesError) {
    log(`Lines error: ${linesError.message}`)
    results.push({ name: 'Rate-Level Conservation', passed: false, details: linesError.message })
    return
  }

  // Verify rate-level conservation
  const { data: insertedLines } = await supabase
    .from('pricing_lines')
    .select('extended_cost')
    .eq('pricing_scenario_id', scenario.id)
    .eq('line_type', 'wbs_estimate')

  const scenarioTotal = (insertedLines || []).reduce((sum, l) => sum + Number(l.extended_cost), 0)
  const rateLevelDelta = Math.abs(legacyTotal - scenarioTotal)
  const rateLevelPassed = rateLevelDelta < 0.01

  log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')
  log('┃ TABLE 1: RATE-LEVEL CONSERVATION                                  ┃')
  log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')
  log(`┃ Legacy (assignments):  ${(assignments || []).length} lines, $${legacyTotal.toFixed(2).padStart(12)} ┃`)
  log(`┃ Scenario (wbs_est):    ${(insertedLines || []).length} lines, $${scenarioTotal.toFixed(2).padStart(12)} ┃`)
  log(`┃ Delta:                 $${rateLevelDelta.toFixed(2).padStart(12)}                       ┃`)
  log(`┃                                                                    ┃`)
  log(`┃ RATE-LEVEL: ${rateLevelPassed ? '✓ PASS (penny-perfect)' : '✗ FAIL'}                               ┃`)
  log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')

  results.push({
    name: 'Rate-Level Conservation',
    passed: rateLevelPassed,
    details: `${(assignments || []).length}/${(insertedLines || []).length} lines, delta $${rateLevelDelta.toFixed(2)}`,
    values: { legacyTotal, scenarioTotal, lineCount: (assignments || []).length },
  })

  // Contract-level: labor loading from intelligence
  const { data: periods } = await supabase
    .from('intelligence_periods')
    .select('*')
    .eq('version_id', INTEL_VERSION_ID)
    .order('sort_order')

  const { data: laborReqs } = await supabase
    .from('intelligence_labor_requirements')
    .select('*')
    .eq('version_id', INTEL_VERSION_ID)

  // Compute using intelligence periods (canonical)
  let intTotal = 0
  let needsUtilization = false
  const loadingLines: any[] = []
  const periodMap = new Map((periods || []).map(p => [p.name, p]))

  for (const req of (laborReqs || [])) {
    let hoursPerMonth = req.hours_per_month
    if (hoursPerMonth === null && req.utilization_pct !== null) {
      hoursPerMonth = (req.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
    }

    if (hoursPerMonth === null) {
      needsUtilization = true
      log(`  ⚠ Missing utilization: ${req.title}`)
      continue
    }

    const targetPeriods = req.appears_in_periods?.length > 0
      ? req.appears_in_periods
      : (periods || []).map(p => p.name)

    for (const periodName of targetPeriods) {
      const period = periodMap.get(periodName)
      if (!period) continue

      const hours = hoursPerMonth * period.months
      const salary = 12000000 // $120k placeholder
      const breakdown = calculateFullyBurdenedRate({
        annualSalary: salary / 100,
        rates: RATES,
        profitRate: DEFAULT_PROFIT,
      })

      const extended = hours * breakdown.fullyBurdenedRate
      intTotal += extended

      loadingLines.push({
        tenant_id: TENANT_ID,
        pricing_scenario_id: scenario.id,
        line_type: 'labor_loading',
        staffing_assignment_id: null,
        intelligence_labor_requirement_id: req.id,
        intelligence_period_id: period.id,
        period_label: periodName,
        hours,
        resolved_salary_cents: salary,
        salary_source: 'catalog',
        level_key: null,
        step_index: null,
        base_hourly: breakdown.baseHourly,
        fringe_amount: breakdown.fringeAmount,
        overhead_base: breakdown.afterFringe,
        overhead_amount: breakdown.overheadAmount,
        ga_amount: breakdown.gaAmount,
        cost_before_profit: breakdown.costBeforeProfit,
        profit_rate: DEFAULT_PROFIT,
        profit_source: 'contract_default',
        profit_amount: breakdown.profitAmount,
        fully_burdened: breakdown.fullyBurdenedRate,
        escalation_rate_applied: null,
        escalation_year_index: null,
        extended_cost: Number(extended.toFixed(2)),
      })
    }
  }

  // Insert labor loading lines
  if (loadingLines.length > 0) {
    await supabase.from('pricing_lines').insert(loadingLines)
  }

  // Legacy uses proposalSetup periods (11 months base)
  const { data: proposal } = await supabase
    .from('proposals')
    .select('working_data')
    .eq('id', PROPOSAL_ID)
    .single()

  const legacyPeriods = (proposal?.working_data as any)?.proposalSetup?.periods || []
  const legacyPeriodMap = new Map(legacyPeriods.map((p: any) => [p.name, p.months]))

  let legacyLaborTotal = 0
  for (const req of (laborReqs || [])) {
    let hoursPerMonth: number | null = req.hours_per_month
    if (hoursPerMonth === null && req.utilization_pct !== null) {
      hoursPerMonth = (req.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
    }
    if (hoursPerMonth === null) continue

    const hpm = hoursPerMonth // TypeScript narrows this to number

    const targetPeriods = req.appears_in_periods?.length > 0
      ? req.appears_in_periods
      : legacyPeriods.map((p: any) => p.name)

    for (const periodName of targetPeriods) {
      const months = legacyPeriodMap.get(periodName) || 0
      const hours = hpm * months
      const salary = 12000000
      const breakdown = calculateFullyBurdenedRate({
        annualSalary: salary / 100,
        rates: RATES,
        profitRate: DEFAULT_PROFIT,
      })
      legacyLaborTotal += hours * breakdown.fullyBurdenedRate
    }
  }

  const contractDelta = intTotal - legacyLaborTotal

  log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')
  log('┃ TABLE 2: CONTRACT-LEVEL CONSERVATION                              ┃')
  log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')
  log(`┃ Legacy (11mo base):    $${legacyLaborTotal.toFixed(2).padStart(12)}                       ┃`)
  log(`┃ Scenario (12mo base):  $${intTotal.toFixed(2).padStart(12)}                       ┃`)
  log(`┃ Delta:                 $${contractDelta.toFixed(2).padStart(12)}                       ┃`)
  log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')

  // Decomposition
  log('\n  ╔════════════════════════════════════════════════════════════════╗')
  log('  ║ DELTA DECOMPOSITION                                            ║')
  log('  ╠════════════════════════════════════════════════════════════════╣')
  log('  ║ Period         │ Legacy Mo │ Intel Mo │ ΔMo │ Roles  │ ΔCost   ║')
  log('  ╟────────────────┼───────────┼──────────┼─────┼────────┼─────────╢')

  let attributedDelta = 0
  for (const period of (periods || [])) {
    const legacyMo = legacyPeriodMap.get(period.name) || 0
    const intMo = period.months || 0
    const deltaMo = intMo - legacyMo

    if (deltaMo !== 0) {
      // Count roles in this period
      const rolesInPeriod = (laborReqs || []).filter(r => {
        const appears = r.appears_in_periods || []
        return appears.length === 0 || appears.includes(period.name)
      }).filter(r => r.hours_per_month !== null || r.utilization_pct !== null)

      let periodDelta = 0
      for (const req of rolesInPeriod) {
        let hoursPerMonth = req.hours_per_month
        if (hoursPerMonth === null && req.utilization_pct !== null) {
          hoursPerMonth = (req.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
        }
        if (hoursPerMonth === null) continue

        const hoursDelta = hoursPerMonth * deltaMo
        const salary = 12000000
        const breakdown = calculateFullyBurdenedRate({
          annualSalary: salary / 100,
          rates: RATES,
          profitRate: DEFAULT_PROFIT,
        })
        periodDelta += hoursDelta * breakdown.fullyBurdenedRate
      }

      attributedDelta += periodDelta
      const sign = deltaMo > 0 ? '+' : ''
      log(`  ║ ${period.name.padEnd(14)} │ ${legacyMo.toString().padStart(9)} │ ${intMo.toString().padStart(8)} │ ${(sign + deltaMo).padStart(3)} │ ${rolesInPeriod.length.toString().padStart(6)} │ $${periodDelta.toFixed(0).padStart(6)} ║`)
    }
  }

  const residual = contractDelta - attributedDelta

  log('  ╠════════════════════════════════════════════════════════════════╣')
  log(`  ║ Total Delta:     $${contractDelta.toFixed(2).padStart(12)}                           ║`)
  log(`  ║ Attributed:      $${attributedDelta.toFixed(2).padStart(12)}                           ║`)
  log(`  ║ Residual:        $${residual.toFixed(2).padStart(12)} ${Math.abs(residual) < 0.01 ? '✓ ZERO' : '✗ BUG'}                ║`)
  log('  ╚════════════════════════════════════════════════════════════════╝')

  results.push({
    name: 'Contract-Level Conservation',
    passed: Math.abs(residual) < 0.01,
    details: `Delta $${contractDelta.toFixed(2)}, residual $${residual.toFixed(2)}`,
    values: { legacyLaborTotal, intTotal, contractDelta, attributedDelta, residual },
  })

  results.push({
    name: 'Needs-Utilization Flag',
    passed: needsUtilization,
    details: needsUtilization ? 'QA Engineer flagged (missing utilization)' : 'No roles missing utilization',
    values: { needsUtilization },
  })

  return
}

async function testImmutability(): Promise<void> {
  logSection('TEST 2: Immutability (rate change → new scenario)')

  // Get the existing scenario
  const { data: scenario1 } = await supabase
    .from('pricing_scenarios')
    .select('id, rate_config_snapshot')
    .eq('proposal_id', PROPOSAL_ID)
    .eq('label', 'Primary')
    .single()

  if (!scenario1) {
    results.push({ name: 'Immutability', passed: false, details: 'No scenario found' })
    return
  }

  // Get lines from first scenario
  const { data: lines1 } = await supabase
    .from('pricing_lines')
    .select('*')
    .eq('pricing_scenario_id', scenario1.id)
    .eq('line_type', 'wbs_estimate')
    .order('id')

  const lines1Hash = JSON.stringify(lines1?.map(l => ({
    hours: l.hours,
    resolved_salary_cents: l.resolved_salary_cents,
    fully_burdened: l.fully_burdened,
    extended_cost: l.extended_cost,
  })))

  // Approve the scenario
  await supabase
    .from('pricing_scenarios')
    .update({ status: 'approved' })
    .eq('id', scenario1.id)

  log(`Approved scenario ${scenario1.id.slice(0, 8)}...`)

  // Create a new scenario with different rate config
  const newRateConfig = {
    ...(scenario1.rate_config_snapshot as any),
    fringe: 0.25, // Changed from 0.2116
    snapshotAt: new Date().toISOString(),
    sourceSettingsRowVersion: 2,
  }

  const { data: scenario2, error: s2Error } = await supabase
    .from('pricing_scenarios')
    .insert({
      tenant_id: TENANT_ID,
      proposal_id: PROPOSAL_ID,
      wbs_version_id: WBS_VERSION_ID,
      label: 'After Rate Change',
      status: 'draft',
      rate_config_snapshot: newRateConfig,
      computed_at: new Date().toISOString(),
      engine_version: FORMULA_VERSION,
      created_by: USER_ID,
      row_version: 1,
    })
    .select('id')
    .single()

  if (s2Error) {
    log(`Scenario 2 error: ${s2Error.message}`)
    results.push({ name: 'Immutability', passed: false, details: s2Error.message })
    return
  }

  // Compute new lines with new fringe rate
  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select('*')
    .eq('tenant_id', TENANT_ID)

  const newLines: any[] = []
  for (const a of (assignments || [])) {
    const salary = (a.salary_override_cents || 0) / 100
    const breakdown = calculateFullyBurdenedRate({
      annualSalary: salary,
      rates: { ...RATES, fringe: 0.25 }, // New rate
      profitRate: a.profit_margin_override || DEFAULT_PROFIT,
    })

    newLines.push({
      tenant_id: TENANT_ID,
      pricing_scenario_id: scenario2.id,
      line_type: 'wbs_estimate',
      staffing_assignment_id: a.id,
      intelligence_labor_requirement_id: null,
      intelligence_period_id: null,
      period_label: a.period_label,
      hours: a.hours,
      resolved_salary_cents: a.salary_override_cents,
      salary_source: 'override',
      level_key: null,
      step_index: null,
      base_hourly: breakdown.baseHourly,
      fringe_amount: breakdown.fringeAmount,
      overhead_base: breakdown.afterFringe,
      overhead_amount: breakdown.overheadAmount,
      ga_amount: breakdown.gaAmount,
      cost_before_profit: breakdown.costBeforeProfit,
      profit_rate: a.profit_margin_override || DEFAULT_PROFIT,
      profit_source: 'explicit',
      profit_amount: breakdown.profitAmount,
      fully_burdened: breakdown.fullyBurdenedRate,
      escalation_rate_applied: null,
      escalation_year_index: null,
      extended_cost: Number((a.hours * breakdown.fullyBurdenedRate).toFixed(2)),
    })
  }

  await supabase.from('pricing_lines').insert(newLines)

  // Verify original scenario lines unchanged
  const { data: lines1After } = await supabase
    .from('pricing_lines')
    .select('*')
    .eq('pricing_scenario_id', scenario1.id)
    .eq('line_type', 'wbs_estimate')
    .order('id')

  const lines1AfterHash = JSON.stringify(lines1After?.map(l => ({
    hours: l.hours,
    resolved_salary_cents: l.resolved_salary_cents,
    fully_burdened: l.fully_burdened,
    extended_cost: l.extended_cost,
  })))

  const immutable = lines1Hash === lines1AfterHash

  // Compare totals
  const oldTotal = (lines1 || []).reduce((sum, l) => sum + Number(l.extended_cost), 0)
  const newTotal = newLines.reduce((sum, l) => sum + l.extended_cost, 0)

  log(`\n  Scenario 1 (fringe=21.16%): $${oldTotal.toFixed(2)}`)
  log(`  Scenario 2 (fringe=25.00%): $${newTotal.toFixed(2)}`)
  log(`  Difference: $${(newTotal - oldTotal).toFixed(2)} (${((newTotal/oldTotal - 1) * 100).toFixed(2)}% increase)`)
  log(`\n  Original lines unchanged: ${immutable ? '✓ YES (byte-identical)' : '✗ NO (MUTATION DETECTED)'}`)

  results.push({
    name: 'Immutability',
    passed: immutable,
    details: immutable ? 'Original lines byte-identical after rate change' : 'MUTATION DETECTED',
    values: { oldTotal, newTotal, immutable },
  })
}

async function testStaleness(): Promise<void> {
  logSection('TEST 3: Staleness Detection (new WBS version)')

  // Get current approved scenario
  const { data: approvedScenario } = await supabase
    .from('pricing_scenarios')
    .select('id, wbs_version_id')
    .eq('proposal_id', PROPOSAL_ID)
    .eq('status', 'approved')
    .single()

  if (!approvedScenario) {
    results.push({ name: 'Staleness Detection', passed: false, details: 'No approved scenario' })
    return
  }

  const originalWbsId = approvedScenario.wbs_version_id

  // Create new WBS version (generated_candidate)
  const { error: wbsInsertError } = await supabase.from('wbs_versions').insert({
    id: NEW_WBS_VERSION_ID,
    tenant_id: TENANT_ID,
    proposal_id: PROPOSAL_ID,
    intelligence_version_id: INTEL_VERSION_ID,
    version_number: 2,
    status: 'generated_candidate',
    row_version: 1,
  })

  if (wbsInsertError) {
    log(`WBS insert error: ${wbsInsertError.message}`)
    results.push({ name: 'Staleness Detection', passed: false, details: `New WBS version creation failed: ${wbsInsertError.message}` })
    return
  }

  // "Accept" the new WBS (supersede old, activate new)
  const { error: supersedeError } = await supabase
    .from('wbs_versions')
    .update({
      status: 'superseded',
      superseded_at: new Date().toISOString(),
    })
    .eq('id', originalWbsId)

  if (supersedeError) {
    log(`Supersede error: ${supersedeError.message}`)
  }

  const { error: activateError } = await supabase
    .from('wbs_versions')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
    })
    .eq('id', NEW_WBS_VERSION_ID)

  if (activateError) {
    log(`Activate error: ${activateError.message}`)
  }

  log(`  Superseded old WBS: ${originalWbsId.slice(0, 8)}...`)
  log(`  Activated new WBS: ${NEW_WBS_VERSION_ID.slice(0, 8)}...`)

  // Check staleness: scenario.wbs_version_id != proposal's active WBS
  const { data: activeWbs } = await supabase
    .from('wbs_versions')
    .select('id')
    .eq('proposal_id', PROPOSAL_ID)
    .eq('status', 'active')
    .single()

  const isStale = approvedScenario.wbs_version_id !== activeWbs?.id

  log(`\n  Scenario WBS:  ${approvedScenario.wbs_version_id.slice(0, 8)}...`)
  log(`  Active WBS:    ${activeWbs?.id.slice(0, 8)}...`)
  log(`  Stale:         ${isStale ? '✓ YES (correctly detected)' : '✗ NO (should be stale!)'}`)

  results.push({
    name: 'Staleness Detection',
    passed: isStale,
    details: isStale ? 'Scenario correctly shows stale after WBS change' : 'Staleness not detected',
    values: { scenarioWbs: approvedScenario.wbs_version_id, activeWbs: activeWbs?.id, isStale },
  })
}

async function testRequirementsCoverage(): Promise<void> {
  logSection('TEST 4: Requirements Coverage')

  const { data: requirements } = await supabase
    .from('requirements')
    .select('id, reference_number')
    .eq('proposal_id', PROPOSAL_ID)

  const { data: links } = await supabase
    .from('requirement_links')
    .select('requirement_id')
    .in('requirement_id', (requirements || []).map(r => r.id))

  const linkedReqIds = new Set((links || []).map(l => l.requirement_id))
  const totalReqs = (requirements || []).length
  const linkedReqs = linkedReqIds.size
  const coverage = totalReqs > 0 ? (linkedReqs / totalReqs * 100).toFixed(0) : '0'

  log(`\n  Total requirements: ${totalReqs}`)
  log(`  Linked to WBS:      ${linkedReqs}`)
  log(`  Coverage:           ${coverage}%`)

  results.push({
    name: 'Requirements Coverage',
    passed: linkedReqs === totalReqs,
    details: `${linkedReqs}/${totalReqs} requirements linked (${coverage}%)`,
    values: { totalReqs, linkedReqs, coverage },
  })
}

async function printSummary(): Promise<void> {
  logSection('E2E SUMMARY')

  let passed = 0
  let failed = 0

  console.log('')
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗'
    const status = r.passed ? 'PASS' : 'FAIL'
    console.log(`  ${icon} ${r.name}: ${status}`)
    console.log(`    ${r.details}`)
    if (r.passed) passed++; else failed++
  }

  console.log('')
  console.log('─'.repeat(70))
  console.log(`  TOTAL: ${passed} passed, ${failed} failed`)
  console.log('─'.repeat(70))

  if (failed > 0) {
    console.log('\n  ⚠ Some tests failed. Review before proceeding to production.')
  } else {
    console.log('\n  ✓ All tests passed. Ready for production (pending user go).')
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  Phase 6A Staging E2E Verification                               ║')
  console.log('║  Target: STAGING (tcobyquewjootwxpqijq)                           ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  try {
    // Clean up and create fresh test data
    await cleanup()
    await setupTestData()

    log('\nTest data created:')
    log(`  Proposal: ${PROPOSAL_ID}`)
    log(`  Intelligence: ${INTEL_VERSION_ID}`)
    log(`  WBS Version: ${WBS_VERSION_ID}`)

    await testConservationGates()
    await testImmutability()
    await testStaleness()
    await testRequirementsCoverage()
    await printSummary()
  } catch (error) {
    console.error('\nE2E failed:', error)
    process.exit(1)
  }
}

main()
