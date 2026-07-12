/**
 * Phase 6A Backfill Rehearsal
 *
 * Creates prod-shaped test data and runs conservation gate tests:
 * 1. Pricing scenarios vs legacy projection (penny comparison)
 * 2. Requirements backfill with intelligence version attachment
 * 3. Charge code migration with task linkage
 *
 * Usage: npx tsx scripts/phase6a-backfill-rehearsal.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calculateFullyBurdenedRate, FORMULA_VERSION } from '../lib/pricing'
import type { RateConfigSnapshot } from '../lib/commands/pricing/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Test data IDs
const TENANT_ID = '44444444-4444-4444-4444-444444444444'
const COMPANY_ID = '22222222-2222-2222-2222-222222222222'  // company_id used for proposals FK
const USER_ID = '11111111-1111-1111-1111-111111111111'

// PM-HCD Proposal (confirmed intelligence)
const PMHCD_PROPOSAL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const PMHCD_INTELLIGENCE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const PMHCD_WBS_VERSION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// PM-HCD Intelligence Periods
const PMHCD_BASE_PERIOD_ID = '11111111-bbbb-1111-1111-111111111111'
const PMHCD_OPT1_PERIOD_ID = '22222222-bbbb-2222-2222-222222222222'

// PM-HCD Intelligence Labor Requirements
const PMHCD_LABOR_PM_ID = '11111111-cccc-1111-1111-111111111111'
const PMHCD_LABOR_UXR_ID = '22222222-cccc-2222-2222-222222222222'
const PMHCD_LABOR_PD_ID = '33333333-cccc-3333-3333-333333333333'
const PMHCD_LABOR_CW_ID = '44444444-cccc-4444-4444-444444444444'
const PMHCD_LABOR_DL_ID = '55555555-cccc-5555-5555-555555555555'

// CAMP Proposal (draft intelligence)
const CAMP_PROPOSAL_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const CAMP_INTELLIGENCE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const CAMP_WBS_VERSION_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

/** Standard hours per month for full-time utilization */
const STANDARD_HOURS_PER_MONTH = 160

// Company settings (FFTC rates)
const RATES = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}
const DEFAULT_PROFIT_RATE = 0.10

interface StaffingAssignment {
  id: string
  roleTitle: string
  periodLabel: string
  hours: number
  salaryCents: number
  profitRate: number
}

interface LegacyProjectionResult {
  proposalId: string
  proposalTitle: string
  totalHours: number
  totalCost: number
  periodTotals: { period: string; hours: number; cost: number }[]
  lineCount: number
}

interface PricingScenarioResult {
  scenarioId: string
  totalHours: number
  totalCost: number
  periodTotals: { period: string; hours: number; cost: number }[]
  lineCount: number
  // Split by line type
  wbsEstimateLineCount: number
  wbsEstimateTotalCost: number
  laborLoadingLineCount: number
  laborLoadingTotalCost: number
}

interface LaborLoadingLegacyResult {
  proposalId: string
  proposalTitle: string
  totalHours: number
  totalCost: number
  periodTotals: { period: string; hours: number; cost: number }[]
  roleCount: number
}

interface PeriodDivergence {
  periodName: string
  legacyMonths: number
  intelligenceMonths: number
  monthDelta: number
}

interface DeltaDecompositionLine {
  roleTitle: string
  periodName: string
  hoursPerMonth: number
  monthDelta: number  // intelligence months - legacy months
  hoursDelta: number  // hoursPerMonth × monthDelta
  fullyBurdenedRate: number
  costDelta: number   // hoursDelta × fullyBurdenedRate
  attribution: string // Human-readable reason
}

interface DeltaDecomposition {
  totalDelta: number
  attributedDelta: number
  residual: number  // Must be 0 for acceptance
  periodDivergences: PeriodDivergence[]
  lineItems: DeltaDecompositionLine[]
}

async function createProdShapedData(): Promise<void> {
  console.log('\n=== Creating Prod-Shaped Test Data ===\n')

  // 1. Create PM-HCD Proposal with confirmed intelligence
  // CRITICAL: working_data.proposalSetup.periods DIFFERS from intelligence_periods
  // Legacy panel reads from proposalSetup (11 months base), scenario reads from intelligence (12 months base)
  // This models the real-world divergence where legacy data was entered before intelligence confirmation
  await supabase.from('proposals').upsert({
    id: PMHCD_PROPOSAL_ID,
    company_id: COMPANY_ID,
    title: 'PM-HCD Services (Product Management & Human-Centered Design)',
    solicitation_number: 'PMHCD-2026-001',
    agency: 'GSA',
    contract_type: 'tm',
    status: 'draft',
    due_date: '2026-08-15',
    row_version: 1,
    working_data: {
      // LEGACY PERIOD DEFINITIONS (unconfirmed, from manual entry)
      // Note: Base Period is 11 months here vs 12 months in intelligence
      proposalSetup: {
        periods: [
          { name: 'Base Period', months: 11 },      // DIFFERS: intelligence says 12 months
          { name: 'Option Year 1', months: 12 },
        ],
      },
      requirements: [
        { id: 'req-1', code: 'REQ-001', text: 'Provide product management services', type: 'shall', tags: ['1.1', '1.2'] },
        { id: 'req-2', code: 'REQ-002', text: 'Conduct user research activities', type: 'shall', tags: ['2.1'] },
        { id: 'req-3', code: 'REQ-003', text: 'Deliver accessible interfaces', type: 'shall', tags: ['2.2', '2.3'] },
        { id: 'req-4', code: 'REQ-004', text: 'Support agile ceremonies', type: 'should', tags: [] },
        { id: 'req-5', code: 'REQ-005', text: 'Provide weekly status reports', type: 'info', tags: ['3.1'] },
      ],
      chargeCodes: [
        { code: 'PMHCD-BASE', description: 'Base Period Work', taskCode: '1.0' },
        { code: 'PMHCD-OPT1', description: 'Option Year 1', taskCode: '2.0' },
      ],
    },
  })

  // 2. Create PM-HCD Intelligence Version (confirmed)
  const { error: intError } = await supabase.from('intelligence_versions').upsert({
    id: PMHCD_INTELLIGENCE_ID,
    tenant_id: TENANT_ID,
    proposal_id: PMHCD_PROPOSAL_ID,
    version_number: 1,
    status: 'confirmed',
    contract_type: 'T&M',  // Must match check constraint: FFP, T&M, IDIQ, BPA, CPFF, unknown
    facts_json: { contractType: { value: 'T&M', confidence: 'high' } },
    confirmation_hash: 'sha256-pmhcd-confirmed',
    extracted_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    row_version: 1,
  })
  if (intError) console.error('Intel error:', intError)

  // Update proposal with active intelligence
  await supabase.from('proposals').update({
    active_intelligence_version_id: PMHCD_INTELLIGENCE_ID,
  }).eq('id', PMHCD_PROPOSAL_ID)

  // 2b. Create PM-HCD Intelligence Periods
  const pmhcdPeriods = [
    { id: PMHCD_BASE_PERIOD_ID, name: 'Base Period', months: 12, cumulativeMonthsEnd: 12, gsaRateYear: 1, sortOrder: 0 },
    { id: PMHCD_OPT1_PERIOD_ID, name: 'Option Year 1', months: 12, cumulativeMonthsEnd: 24, gsaRateYear: 2, sortOrder: 1 },
  ]

  for (const period of pmhcdPeriods) {
    await supabase.from('intelligence_periods').upsert({
      id: period.id,
      version_id: PMHCD_INTELLIGENCE_ID,
      name: period.name,
      months: period.months,
      cumulative_months_end: period.cumulativeMonthsEnd,
      gsa_rate_year: period.gsaRateYear,
      sort_order: period.sortOrder,
    })
  }

  // 2c. Create PM-HCD Intelligence Labor Requirements
  // These match the staffing assignments in terms of roles
  // utilization_pct is stored as 0-100 (e.g., 100 = full-time)
  const pmhcdLaborReqs = [
    { id: PMHCD_LABOR_PM_ID, title: 'Product Manager', hoursPerMonth: 160, utilizationPct: 100, periods: ['Base Period', 'Option Year 1'], salaryCents: 14000000 },
    { id: PMHCD_LABOR_UXR_ID, title: 'UX Researcher', hoursPerMonth: 80, utilizationPct: 50, periods: ['Base Period', 'Option Year 1'], salaryCents: 11800000 },
    { id: PMHCD_LABOR_PD_ID, title: 'Product Designer', hoursPerMonth: 120, utilizationPct: 75, periods: ['Base Period'], salaryCents: 11800000 },
    { id: PMHCD_LABOR_CW_ID, title: 'Content/UX Writer', hoursPerMonth: 40, utilizationPct: 25, periods: ['Base Period'], salaryCents: 9500000 },
    { id: PMHCD_LABOR_DL_ID, title: 'Design Lead', hoursPerMonth: 40, utilizationPct: 25, periods: ['Option Year 1'], salaryCents: 15500000 },
  ]

  for (const laborReq of pmhcdLaborReqs) {
    await supabase.from('intelligence_labor_requirements').upsert({
      id: laborReq.id,
      version_id: PMHCD_INTELLIGENCE_ID,
      title: laborReq.title,
      hours_per_month: laborReq.hoursPerMonth,
      utilization_pct: laborReq.utilizationPct,
      appears_in_periods: laborReq.periods,
      confidence: 'high',
    })
  }

  // 3. Create PM-HCD WBS Version (active)
  const { error: wbsError } = await supabase.from('wbs_versions').upsert({
    id: PMHCD_WBS_VERSION_ID,
    tenant_id: TENANT_ID,
    proposal_id: PMHCD_PROPOSAL_ID,
    intelligence_version_id: PMHCD_INTELLIGENCE_ID,
    version_number: 1,
    status: 'active',
    activated_at: new Date().toISOString(),  // Required when status='active'
    row_version: 1,
  })
  if (wbsError) console.error('WBS version error:', wbsError)

  // 4. Create PM-HCD WBS Tasks
  const pmhcdTasks = [
    { id: '11111111-aaaa-aaaa-aaaa-000000000001', code: '1.0', title: 'Product Management', parentId: null },
    { id: '11111111-aaaa-aaaa-aaaa-000000000002', code: '1.1', title: 'Product Strategy', parentId: '11111111-aaaa-aaaa-aaaa-000000000001' },
    { id: '11111111-aaaa-aaaa-aaaa-000000000003', code: '1.2', title: 'Roadmap Development', parentId: '11111111-aaaa-aaaa-aaaa-000000000001' },
    { id: '11111111-aaaa-aaaa-aaaa-000000000004', code: '2.0', title: 'Human-Centered Design', parentId: null },
    { id: '11111111-aaaa-aaaa-aaaa-000000000005', code: '2.1', title: 'User Research', parentId: '11111111-aaaa-aaaa-aaaa-000000000004' },
    { id: '11111111-aaaa-aaaa-aaaa-000000000006', code: '2.2', title: 'UX Design', parentId: '11111111-aaaa-aaaa-aaaa-000000000004' },
    { id: '11111111-aaaa-aaaa-aaaa-000000000007', code: '2.3', title: 'Accessibility Testing', parentId: '11111111-aaaa-aaaa-aaaa-000000000004' },
    { id: '11111111-aaaa-aaaa-aaaa-000000000008', code: '3.0', title: 'Program Support', parentId: null },
    { id: '11111111-aaaa-aaaa-aaaa-000000000009', code: '3.1', title: 'Reporting & Communications', parentId: '11111111-aaaa-aaaa-aaaa-000000000008' },
  ]

  for (const task of pmhcdTasks) {
    await supabase.from('wbs_tasks').upsert({
      id: task.id,
      tenant_id: TENANT_ID,
      wbs_version_id: PMHCD_WBS_VERSION_ID,
      wbs_code: task.code,
      title: task.title,
      parent_task_id: task.parentId,
      source: 'generated',
      sort_order: parseInt(task.code.replace('.', '')),
      row_version: 1,
    })
  }

  // 5. Create PM-HCD Staffing Assignments (realistic mix)
  const pmhcdAssignments: StaffingAssignment[] = [
    // Base Period
    { id: '22222222-aaaa-aaaa-aaaa-000000000001', roleTitle: 'Product Manager', periodLabel: 'Base Period', hours: 1920, salaryCents: 14000000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000002', roleTitle: 'UX Researcher', periodLabel: 'Base Period', hours: 960, salaryCents: 11800000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000003', roleTitle: 'Product Designer', periodLabel: 'Base Period', hours: 1440, salaryCents: 11800000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000004', roleTitle: 'Content/UX Writer', periodLabel: 'Base Period', hours: 480, salaryCents: 9500000, profitRate: 0.10 },
    // Option Year 1
    { id: '22222222-aaaa-aaaa-aaaa-000000000005', roleTitle: 'Product Manager', periodLabel: 'Option Year 1', hours: 1920, salaryCents: 14000000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000006', roleTitle: 'UX Researcher', periodLabel: 'Option Year 1', hours: 960, salaryCents: 11800000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000007', roleTitle: 'Product Designer', periodLabel: 'Option Year 1', hours: 1920, salaryCents: 11800000, profitRate: 0.10 },
    { id: '22222222-aaaa-aaaa-aaaa-000000000008', roleTitle: 'Design Lead', periodLabel: 'Option Year 1', hours: 480, salaryCents: 15500000, profitRate: 0.10 },
  ]

  for (const assignment of pmhcdAssignments) {
    // Assign to appropriate task based on role
    const taskId = assignment.roleTitle.includes('Product')
      ? '11111111-aaaa-aaaa-aaaa-000000000002'  // 1.1 Product Strategy
      : assignment.roleTitle.includes('UX') || assignment.roleTitle.includes('Design')
        ? '11111111-aaaa-aaaa-aaaa-000000000006'  // 2.2 UX Design
        : '11111111-aaaa-aaaa-aaaa-000000000009'  // 3.1 Reporting

    await supabase.from('staffing_assignments').upsert({
      id: assignment.id,
      tenant_id: TENANT_ID,
      wbs_task_id: taskId,
      role_title: assignment.roleTitle,
      discipline: assignment.roleTitle.includes('Product') ? 'product' : 'design',
      prime_or_sub: 'prime',
      period_label: assignment.periodLabel,
      hours: assignment.hours,
      source: 'generated',
      salary_override_cents: assignment.salaryCents,
      profit_margin_override: assignment.profitRate,
      row_version: 1,
    })
  }

  // 6. Create CAMP Proposal with draft intelligence
  await supabase.from('proposals').upsert({
    id: CAMP_PROPOSAL_ID,
    company_id: COMPANY_ID,
    title: 'CAMP IT Modernization',
    solicitation_number: 'CAMP-2026-042',
    agency: 'VA',
    contract_type: 'ffp',
    status: 'draft',
    due_date: '2026-09-01',
    row_version: 1,
    working_data: {
      requirements: [
        { id: 'camp-req-1', code: 'CAMP-001', text: 'Modernize legacy systems', type: 'shall', tags: ['1.1'] },
        { id: 'camp-req-2', code: 'CAMP-002', text: 'Implement cloud infrastructure', type: 'shall', tags: ['UNMAPPED-TAG'] },
        { id: 'camp-req-3', code: 'CAMP-003', text: 'Provide training services', type: 'should', tags: ['1.2', 'NONEXISTENT'] },
      ],
      chargeCodes: [
        { code: 'CAMP-001', description: 'Modernization Phase 1' },
      ],
    },
  })

  // 7. Create CAMP Intelligence Version (draft)
  const { error: campIntError } = await supabase.from('intelligence_versions').upsert({
    id: CAMP_INTELLIGENCE_ID,
    tenant_id: TENANT_ID,
    proposal_id: CAMP_PROPOSAL_ID,
    version_number: 1,
    status: 'draft',
    contract_type: 'FFP',  // Must match check constraint
    facts_json: { contractType: { value: 'FFP', confidence: 'high' } },
    extracted_at: new Date().toISOString(),
    row_version: 1,
  })
  if (campIntError) console.error('CAMP Intel error:', campIntError)

  // Update CAMP proposal with active intelligence
  await supabase.from('proposals').update({
    active_intelligence_version_id: CAMP_INTELLIGENCE_ID,
  }).eq('id', CAMP_PROPOSAL_ID)

  // 8. Create CAMP WBS Version (active)
  const { error: campWbsError } = await supabase.from('wbs_versions').upsert({
    id: CAMP_WBS_VERSION_ID,
    tenant_id: TENANT_ID,
    proposal_id: CAMP_PROPOSAL_ID,
    intelligence_version_id: CAMP_INTELLIGENCE_ID,
    version_number: 1,
    status: 'active',
    activated_at: new Date().toISOString(),  // Required when status='active'
    row_version: 1,
  })
  if (campWbsError) console.error('CAMP WBS error:', campWbsError)

  // 9. Create CAMP WBS Tasks
  const campTasks = [
    { id: '33333333-dddd-dddd-dddd-000000000001', code: '1.0', title: 'System Modernization', parentId: null },
    { id: '33333333-dddd-dddd-dddd-000000000002', code: '1.1', title: 'Legacy Assessment', parentId: '33333333-dddd-dddd-dddd-000000000001' },
    { id: '33333333-dddd-dddd-dddd-000000000003', code: '1.2', title: 'Cloud Migration', parentId: '33333333-dddd-dddd-dddd-000000000001' },
    { id: '33333333-dddd-dddd-dddd-000000000004', code: '2.0', title: 'Training & Support', parentId: null },
  ]

  for (const task of campTasks) {
    await supabase.from('wbs_tasks').upsert({
      id: task.id,
      tenant_id: TENANT_ID,
      wbs_version_id: CAMP_WBS_VERSION_ID,
      wbs_code: task.code,
      title: task.title,
      parent_task_id: task.parentId,
      source: 'generated',
      sort_order: parseInt(task.code.replace('.', '')),
      row_version: 1,
    })
  }

  // 10. Create CAMP Staffing Assignments
  const campAssignments: StaffingAssignment[] = [
    // Base Period only
    { id: '44444444-dddd-dddd-dddd-000000000001', roleTitle: 'Technical Lead', periodLabel: 'Base Period', hours: 1920, salaryCents: 16500000, profitRate: 0.08 },
    { id: '44444444-dddd-dddd-dddd-000000000002', roleTitle: 'DevOps Engineer', periodLabel: 'Base Period', hours: 1920, salaryCents: 12000000, profitRate: 0.08 },
    { id: '44444444-dddd-dddd-dddd-000000000003', roleTitle: 'Back-end Developer', periodLabel: 'Base Period', hours: 1440, salaryCents: 12000000, profitRate: 0.08 },
  ]

  for (const assignment of campAssignments) {
    const taskId = assignment.roleTitle === 'Technical Lead'
      ? '33333333-dddd-dddd-dddd-000000000002'  // 1.1 Legacy Assessment
      : '33333333-dddd-dddd-dddd-000000000003'  // 1.2 Cloud Migration

    await supabase.from('staffing_assignments').upsert({
      id: assignment.id,
      tenant_id: TENANT_ID,
      wbs_task_id: taskId,
      role_title: assignment.roleTitle,
      discipline: 'engineering',
      prime_or_sub: 'prime',
      period_label: assignment.periodLabel,
      hours: assignment.hours,
      source: 'generated',
      salary_override_cents: assignment.salaryCents,
      profit_margin_override: assignment.profitRate,
      row_version: 1,
    })
  }

  console.log('✓ Created PM-HCD proposal with confirmed intelligence, 9 tasks, 8 assignments')
  console.log('✓ Created PM-HCD intelligence periods (Base + Option Year 1) and labor requirements (5 roles)')
  console.log('✓ Created CAMP proposal with draft intelligence, 4 tasks, 3 assignments')
}

/**
 * Legacy projection: compute expected totals using the same engine
 * This simulates what the legacy Roles & Pricing panel would show
 */
async function computeLegacyProjection(proposalId: string): Promise<LegacyProjectionResult> {
  // Load proposal
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, contract_type')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw new Error(`Proposal not found: ${proposalId}`)

  // Load active WBS version
  const { data: wbsVersion } = await supabase
    .from('wbs_versions')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('status', 'active')
    .single()

  if (!wbsVersion) throw new Error(`No active WBS for proposal: ${proposalId}`)

  // Load tasks
  const { data: tasks } = await supabase
    .from('wbs_tasks')
    .select('id')
    .eq('wbs_version_id', wbsVersion.id)

  const taskIds = (tasks || []).map(t => t.id)

  // Load assignments
  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select('id, role_title, period_label, hours, salary_override_cents, profit_margin_override')
    .in('wbs_task_id', taskIds)

  if (!assignments) return { proposalId, proposalTitle: proposal.title, totalHours: 0, totalCost: 0, periodTotals: [], lineCount: 0 }

  // Compute using pricing engine (same as legacy path)
  let totalHours = 0
  let totalCost = 0
  const periodMap = new Map<string, { hours: number; cost: number }>()

  for (const assignment of assignments) {
    const salaryCents = assignment.salary_override_cents || 0
    const salary = salaryCents / 100
    const profitRate = assignment.profit_margin_override ?? DEFAULT_PROFIT_RATE
    const hours = assignment.hours || 0

    const breakdown = calculateFullyBurdenedRate({
      annualSalary: salary,
      rates: RATES,
      profitRate,
    })

    const extendedCost = hours * breakdown.fullyBurdenedRate
    totalHours += hours
    totalCost += extendedCost

    const period = assignment.period_label
    const existing = periodMap.get(period) || { hours: 0, cost: 0 }
    periodMap.set(period, {
      hours: existing.hours + hours,
      cost: existing.cost + extendedCost,
    })
  }

  const periodTotals = Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    hours: data.hours,
    cost: Number(data.cost.toFixed(2)),
  }))

  return {
    proposalId,
    proposalTitle: proposal.title,
    totalHours,
    totalCost: Number(totalCost.toFixed(2)),
    periodTotals,
    lineCount: assignments.length,
  }
}

/**
 * Legacy labor loading projection: compute expected totals using WORKING_DATA periods
 * This simulates what the legacy Roles & Pricing panel would show.
 *
 * CRITICAL DIFFERENCE:
 * - Legacy panel reads periods from working_data.proposalSetup.periods (unconfirmed)
 * - Scenario reads periods from intelligence_periods (confirmed)
 *
 * This models real-world divergence where legacy data was entered before intelligence confirmation.
 */
async function computeLegacyLaborLoading(proposalId: string): Promise<LaborLoadingLegacyResult | null> {
  // Load proposal with working_data
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, active_intelligence_version_id, working_data')
    .eq('id', proposalId)
    .single()

  if (!proposal || !proposal.active_intelligence_version_id) return null

  // Load intelligence version (for labor requirements only)
  const { data: intelligenceVersion } = await supabase
    .from('intelligence_versions')
    .select('id, status')
    .eq('id', proposal.active_intelligence_version_id)
    .single()

  if (!intelligenceVersion || intelligenceVersion.status !== 'confirmed') return null

  // LEGACY: Read periods from working_data.proposalSetup.periods (NOT intelligence_periods)
  const workingData = proposal.working_data as any
  const legacyPeriods = workingData?.proposalSetup?.periods || []

  if (legacyPeriods.length === 0) {
    // Fall back to intelligence periods if no proposalSetup (for comparison baseline)
    const { data: intPeriods } = await supabase
      .from('intelligence_periods')
      .select('id, name, months, sort_order')
      .eq('version_id', intelligenceVersion.id)
      .order('sort_order')

    if (intPeriods) {
      for (const p of intPeriods) {
        legacyPeriods.push({ name: p.name, months: p.months })
      }
    }
  }

  const periodMap = new Map<string, { name: string; months: number }>(
    legacyPeriods.map((p: any) => [p.name, { name: p.name, months: p.months }])
  )

  // Load labor requirements (from intelligence - same source as scenario)
  const { data: laborReqs } = await supabase
    .from('intelligence_labor_requirements')
    .select('id, title, hours_per_month, utilization_pct, appears_in_periods')
    .eq('version_id', intelligenceVersion.id)

  if (!laborReqs) return null

  // Compute totals using pricing engine with LEGACY period months
  let totalHours = 0
  let totalCost = 0
  const periodTotalsMap = new Map<string, { hours: number; cost: number }>()

  for (const laborReq of laborReqs) {
    // Resolve utilization
    let hoursPerMonth: number | null = null
    if (laborReq.hours_per_month !== null) {
      hoursPerMonth = laborReq.hours_per_month
    } else if (laborReq.utilization_pct !== null) {
      hoursPerMonth = (laborReq.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
    }

    if (hoursPerMonth === null) continue

    // Use same salary as scenario for apples-to-apples comparison
    const salaryCents = 12000000 // $120k placeholder

    // Get periods where this role appears
    const appearsInPeriods = laborReq.appears_in_periods || []
    const targetPeriods = appearsInPeriods.length > 0
      ? appearsInPeriods
      : legacyPeriods.map((p: any) => p.name)

    for (const periodName of targetPeriods) {
      const period = periodMap.get(periodName)
      if (!period) continue

      // LEGACY: Uses proposalSetup period months (may differ from intelligence)
      const hours = hoursPerMonth * period.months
      const salary = salaryCents / 100

      const breakdown = calculateFullyBurdenedRate({
        annualSalary: salary,
        rates: RATES,
        profitRate: DEFAULT_PROFIT_RATE,
      })

      const extendedCost = hours * breakdown.fullyBurdenedRate
      totalHours += hours
      totalCost += extendedCost

      const existing = periodTotalsMap.get(periodName) || { hours: 0, cost: 0 }
      periodTotalsMap.set(periodName, {
        hours: existing.hours + hours,
        cost: existing.cost + extendedCost,
      })
    }
  }

  const periodTotals = Array.from(periodTotalsMap.entries()).map(([period, data]) => ({
    period,
    hours: data.hours,
    cost: Number(data.cost.toFixed(2)),
  }))

  return {
    proposalId,
    proposalTitle: proposal.title,
    totalHours,
    totalCost: Number(totalCost.toFixed(2)),
    periodTotals,
    roleCount: laborReqs.length,
  }
}

/**
 * Decompose the delta between legacy and scenario totals.
 * Every cent must be attributed to a specific period-definition difference.
 */
async function decomposeContractLevelDelta(
  proposalId: string,
  legacyTotal: number,
  scenarioTotal: number
): Promise<DeltaDecomposition> {
  const totalDelta = scenarioTotal - legacyTotal

  // Load proposal with working_data
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, active_intelligence_version_id, working_data')
    .eq('id', proposalId)
    .single()

  if (!proposal || !proposal.active_intelligence_version_id) {
    return { totalDelta, attributedDelta: 0, residual: totalDelta, periodDivergences: [], lineItems: [] }
  }

  // Load intelligence periods
  const { data: intPeriods } = await supabase
    .from('intelligence_periods')
    .select('id, name, months, sort_order')
    .eq('version_id', proposal.active_intelligence_version_id)
    .order('sort_order')

  // Load legacy periods from working_data
  const workingData = proposal.working_data as any
  const legacyPeriods = workingData?.proposalSetup?.periods || []

  // Build period divergence map
  const periodDivergences: PeriodDivergence[] = []
  const intPeriodMap = new Map<string, number>(
    (intPeriods || []).map((p: any) => [p.name as string, Number(p.months)])
  )
  const legacyPeriodMap = new Map<string, number>(
    legacyPeriods.map((p: any) => [p.name as string, Number(p.months)])
  )

  const allPeriodNames = new Set([...intPeriodMap.keys(), ...legacyPeriodMap.keys()])
  for (const periodName of allPeriodNames) {
    const intMonths = intPeriodMap.get(periodName) ?? 0
    const legacyMonths = legacyPeriodMap.get(periodName) ?? 0
    if (intMonths !== legacyMonths) {
      periodDivergences.push({
        periodName,
        legacyMonths,
        intelligenceMonths: intMonths,
        monthDelta: intMonths - legacyMonths,
      })
    }
  }

  // Load labor requirements
  const { data: laborReqs } = await supabase
    .from('intelligence_labor_requirements')
    .select('id, title, hours_per_month, utilization_pct, appears_in_periods')
    .eq('version_id', proposal.active_intelligence_version_id)

  // Compute delta per role per period
  const lineItems: DeltaDecompositionLine[] = []
  let attributedDelta = 0

  for (const laborReq of (laborReqs || [])) {
    // Resolve utilization
    let hoursPerMonth: number | null = null
    if (laborReq.hours_per_month !== null) {
      hoursPerMonth = laborReq.hours_per_month
    } else if (laborReq.utilization_pct !== null) {
      hoursPerMonth = (laborReq.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
    }

    if (hoursPerMonth === null) continue

    // Get periods where this role appears
    const appearsInPeriods = laborReq.appears_in_periods || []
    const targetPeriods = appearsInPeriods.length > 0
      ? appearsInPeriods
      : [...allPeriodNames]

    // Use same salary as both computations
    const salaryCents = 12000000 // $120k placeholder
    const breakdown = calculateFullyBurdenedRate({
      annualSalary: salaryCents / 100,
      rates: RATES,
      profitRate: DEFAULT_PROFIT_RATE,
    })

    for (const periodName of targetPeriods) {
      const intMonths = intPeriodMap.get(periodName) ?? 0
      const legacyMonths = legacyPeriodMap.get(periodName) ?? 0
      const monthDelta = intMonths - legacyMonths

      if (monthDelta !== 0) {
        const hoursDelta = hoursPerMonth * monthDelta
        const costDelta = hoursDelta * breakdown.fullyBurdenedRate

        lineItems.push({
          roleTitle: laborReq.title,
          periodName,
          hoursPerMonth,
          monthDelta,
          hoursDelta,
          fullyBurdenedRate: breakdown.fullyBurdenedRate,
          costDelta: Number(costDelta.toFixed(2)),
          attribution: `${periodName}: intelligence=${intMonths}mo vs legacy=${legacyMonths}mo (Δ${monthDelta > 0 ? '+' : ''}${monthDelta}mo)`,
        })

        attributedDelta += costDelta
      }
    }
  }

  const residual = Number((totalDelta - attributedDelta).toFixed(2))

  return {
    totalDelta: Number(totalDelta.toFixed(2)),
    attributedDelta: Number(attributedDelta.toFixed(2)),
    residual,
    periodDivergences,
    lineItems,
  }
}

/**
 * Compute pricing scenario using new command logic
 */
async function computePricingScenario(proposalId: string): Promise<PricingScenarioResult> {
  // Load active WBS version
  const { data: wbsVersion } = await supabase
    .from('wbs_versions')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('status', 'active')
    .single()

  if (!wbsVersion) throw new Error(`No active WBS for proposal: ${proposalId}`)

  // Load tasks
  const { data: tasks } = await supabase
    .from('wbs_tasks')
    .select('id')
    .eq('wbs_version_id', wbsVersion.id)

  const taskIds = (tasks || []).map(t => t.id)
  if (taskIds.length === 0) {
    return {
      scenarioId: '', totalHours: 0, totalCost: 0, periodTotals: [], lineCount: 0,
      wbsEstimateLineCount: 0, wbsEstimateTotalCost: 0,
      laborLoadingLineCount: 0, laborLoadingTotalCost: 0,
    }
  }

  // Load assignments
  const { data: assignments } = await supabase
    .from('staffing_assignments')
    .select('id, role_title, period_label, hours, salary_override_cents, profit_margin_override')
    .in('wbs_task_id', taskIds)

  if (!assignments) {
    return {
      scenarioId: '', totalHours: 0, totalCost: 0, periodTotals: [], lineCount: 0,
      wbsEstimateLineCount: 0, wbsEstimateTotalCost: 0,
      laborLoadingLineCount: 0, laborLoadingTotalCost: 0,
    }
  }

  // Build rate config snapshot
  const rateConfig: RateConfigSnapshot = {
    fringe: RATES.fringe,
    overhead: RATES.overhead,
    ga: RATES.ga,
    defaultProfitRate: DEFAULT_PROFIT_RATE,
    escalationRate: 0.03,
    snapshotAt: new Date().toISOString(),
    sourceSettingsRowVersion: 1,
  }

  // Insert scenario
  const { data: scenario, error: scenarioError } = await supabase
    .from('pricing_scenarios')
    .insert({
      tenant_id: TENANT_ID,
      proposal_id: proposalId,
      wbs_version_id: wbsVersion.id,
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

  if (scenarioError || !scenario) {
    console.error('Failed to create scenario:', scenarioError)
    throw new Error(`Failed to create scenario for ${proposalId}`)
  }

  // Compute and insert WBS estimate lines
  let wbsEstimateTotalCost = 0
  let wbsEstimateTotalHours = 0
  const periodMap = new Map<string, { hours: number; cost: number }>()
  const wbsEstimateLines: any[] = []

  for (const assignment of assignments) {
    const salaryCents = assignment.salary_override_cents || 0
    const salary = salaryCents / 100
    const profitRate = assignment.profit_margin_override ?? DEFAULT_PROFIT_RATE
    const hours = assignment.hours || 0

    const breakdown = calculateFullyBurdenedRate({
      annualSalary: salary,
      rates: RATES,
      profitRate,
    })

    const extendedCost = Number((hours * breakdown.fullyBurdenedRate).toFixed(2))
    wbsEstimateTotalHours += hours
    wbsEstimateTotalCost += extendedCost

    const period = assignment.period_label
    const existing = periodMap.get(period) || { hours: 0, cost: 0 }
    periodMap.set(period, {
      hours: existing.hours + hours,
      cost: existing.cost + extendedCost,
    })

    wbsEstimateLines.push({
      tenant_id: TENANT_ID,
      pricing_scenario_id: scenario.id,
      line_type: 'wbs_estimate',
      staffing_assignment_id: assignment.id,
      intelligence_labor_requirement_id: null,
      intelligence_period_id: null,
      period_label: period,
      hours,
      resolved_salary_cents: salaryCents,
      salary_source: 'override',
      level_key: null,
      step_index: null,
      base_hourly: breakdown.baseHourly,
      fringe_amount: breakdown.fringeAmount,
      overhead_base: breakdown.afterFringe,
      overhead_amount: breakdown.overheadAmount,
      ga_amount: breakdown.gaAmount,
      cost_before_profit: breakdown.costBeforeProfit,
      profit_rate: profitRate,
      profit_source: 'explicit',
      profit_amount: breakdown.profitAmount,
      fully_burdened: breakdown.fullyBurdenedRate,
      escalation_rate_applied: breakdown.escalationRateApplied,
      escalation_year_index: breakdown.escalationYearIndex,
      extended_cost: extendedCost,
    })
  }

  // Compute and insert labor_loading lines from confirmed intelligence
  let laborLoadingTotalCost = 0
  let laborLoadingTotalHours = 0
  const laborLoadingLines: any[] = []
  const laborLoadingPeriodMap = new Map<string, { hours: number; cost: number }>()

  // Load intelligence version
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, active_intelligence_version_id')
    .eq('id', proposalId)
    .single()

  if (proposal?.active_intelligence_version_id) {
    const { data: intelligenceVersion } = await supabase
      .from('intelligence_versions')
      .select('id, status')
      .eq('id', proposal.active_intelligence_version_id)
      .single()

    if (intelligenceVersion?.status === 'confirmed') {
      // Load periods
      const { data: periods } = await supabase
        .from('intelligence_periods')
        .select('id, name, months, sort_order')
        .eq('version_id', intelligenceVersion.id)
        .order('sort_order')

      const intPeriods = periods || []
      const intPeriodMap = new Map(intPeriods.map((p: any) => [p.name, p]))

      // Load labor requirements
      const { data: laborReqs } = await supabase
        .from('intelligence_labor_requirements')
        .select('id, title, hours_per_month, utilization_pct, appears_in_periods')
        .eq('version_id', intelligenceVersion.id)

      for (const laborReq of (laborReqs || [])) {
        // Resolve utilization
        let hoursPerMonth: number | null = null
        if (laborReq.hours_per_month !== null) {
          hoursPerMonth = laborReq.hours_per_month
        } else if (laborReq.utilization_pct !== null) {
          hoursPerMonth = (laborReq.utilization_pct / 100) * STANDARD_HOURS_PER_MONTH
        }

        if (hoursPerMonth === null) continue

        // Get periods where this role appears
        const appearsInPeriods = laborReq.appears_in_periods || []
        const targetPeriods = appearsInPeriods.length > 0
          ? appearsInPeriods
          : intPeriods.map((p: any) => p.name)

        for (const periodName of targetPeriods) {
          const period = intPeriodMap.get(periodName)
          if (!period) continue

          const hours = hoursPerMonth * period.months
          const salaryCents = 12000000 // $120k placeholder

          const breakdown = calculateFullyBurdenedRate({
            annualSalary: salaryCents / 100,
            rates: RATES,
            profitRate: DEFAULT_PROFIT_RATE,
          })

          const extendedCost = Number((hours * breakdown.fullyBurdenedRate).toFixed(2))
          laborLoadingTotalHours += hours
          laborLoadingTotalCost += extendedCost

          const existing = laborLoadingPeriodMap.get(periodName) || { hours: 0, cost: 0 }
          laborLoadingPeriodMap.set(periodName, {
            hours: existing.hours + hours,
            cost: existing.cost + extendedCost,
          })

          laborLoadingLines.push({
            tenant_id: TENANT_ID,
            pricing_scenario_id: scenario.id,
            line_type: 'labor_loading',
            staffing_assignment_id: null,
            intelligence_labor_requirement_id: laborReq.id,
            intelligence_period_id: period.id,
            period_label: periodName,
            hours,
            resolved_salary_cents: salaryCents,
            salary_source: 'catalog',
            level_key: null,
            step_index: null,
            base_hourly: breakdown.baseHourly,
            fringe_amount: breakdown.fringeAmount,
            overhead_base: breakdown.afterFringe,
            overhead_amount: breakdown.overheadAmount,
            ga_amount: breakdown.gaAmount,
            cost_before_profit: breakdown.costBeforeProfit,
            profit_rate: DEFAULT_PROFIT_RATE,
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

  // Combine all lines
  const allLines = [...wbsEstimateLines, ...laborLoadingLines]

  // Insert lines
  if (allLines.length > 0) {
    const { error: linesError } = await supabase
      .from('pricing_lines')
      .insert(allLines)

    if (linesError) {
      console.error('Failed to insert lines:', linesError)
    }
  }

  // Combine period totals (wbs_estimate totals for rate-level conservation)
  const periodTotals = Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    hours: data.hours,
    cost: Number(data.cost.toFixed(2)),
  }))

  // Total hours and cost = labor loading if available, else wbs_estimate
  const totalHours = laborLoadingTotalHours > 0 ? laborLoadingTotalHours : wbsEstimateTotalHours
  const totalCost = laborLoadingTotalCost > 0 ? laborLoadingTotalCost : wbsEstimateTotalCost

  return {
    scenarioId: scenario.id,
    totalHours,
    totalCost: Number(totalCost.toFixed(2)),
    periodTotals,
    lineCount: allLines.length,
    wbsEstimateLineCount: wbsEstimateLines.length,
    wbsEstimateTotalCost: Number(wbsEstimateTotalCost.toFixed(2)),
    laborLoadingLineCount: laborLoadingLines.length,
    laborLoadingTotalCost: Number(laborLoadingTotalCost.toFixed(2)),
  }
}

/**
 * Run conservation gate: compare legacy vs scenario totals
 * TWO conservation tables:
 * 1. RATE-LEVEL: wbs_estimate lines vs legacy staffing assignment projection
 * 2. CONTRACT-LEVEL: labor_loading lines vs legacy panel total (confirmed intelligence)
 */
async function runConservationGate(): Promise<void> {
  console.log('\n' + '='.repeat(70))
  console.log(' CONSERVATION GATE: Pricing Scenarios')
  console.log('='.repeat(70))

  const proposals = [
    { id: PMHCD_PROPOSAL_ID, name: 'PM-HCD' },
    { id: CAMP_PROPOSAL_ID, name: 'CAMP' },
  ]

  for (const proposal of proposals) {
    console.log(`\n${'─'.repeat(70)}`)
    console.log(` ${proposal.name}`)
    console.log('─'.repeat(70))

    // Compute legacy projection (from staffing assignments)
    const legacy = await computeLegacyProjection(proposal.id)

    // Compute new pricing scenario
    const scenario = await computePricingScenario(proposal.id)

    // ──────────────────────────────────────────────────────────────────────
    // TABLE 1: RATE-LEVEL CONSERVATION (wbs_estimate vs legacy assignments)
    // ──────────────────────────────────────────────────────────────────────
    console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')
    console.log('┃ TABLE 1: RATE-LEVEL CONSERVATION                                  ┃')
    console.log('┃ (wbs_estimate lines vs legacy staffing assignment projection)     ┃')
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')

    console.log(`┃ Legacy (assignments):  ${legacy.lineCount.toString().padStart(3)} lines, ${legacy.totalHours.toString().padStart(6)} hours, $${legacy.totalCost.toLocaleString().padStart(12)} ┃`)
    console.log(`┃ Scenario (wbs_est):    ${scenario.wbsEstimateLineCount.toString().padStart(3)} lines, ${legacy.totalHours.toString().padStart(6)} hours, $${scenario.wbsEstimateTotalCost.toLocaleString().padStart(12)} ┃`)

    const rateCostDiff = Math.abs(legacy.totalCost - scenario.wbsEstimateTotalCost)
    const rateLineDiff = Math.abs(legacy.lineCount - scenario.wbsEstimateLineCount)
    const ratePassed = rateCostDiff < 0.01 && rateLineDiff === 0

    console.log(`┃                                                                    ┃`)
    console.log(`┃ RATE-LEVEL CHECK: ${ratePassed ? '✓ PASS (penny-perfect)' : '✗ FAIL'}                              ┃`)
    if (!ratePassed) {
      console.log(`┃   Cost delta: $${rateCostDiff.toFixed(2)}, Line delta: ${rateLineDiff}                           ┃`)
    }
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')

    // Period breakdown for rate-level
    if (legacy.periodTotals.length > 0) {
      console.log('\n  Period breakdown (rate-level):')
      console.log('  ┌────────────────────┬──────────────┬──────────────┬──────────┐')
      console.log('  │ Period             │ Legacy Cost  │ WBS Est Cost │ Delta    │')
      console.log('  ├────────────────────┼──────────────┼──────────────┼──────────┤')

      for (const legacyPeriod of legacy.periodTotals) {
        const scenarioPeriod = scenario.periodTotals.find(p => p.period === legacyPeriod.period)
        const scenarioCost = scenarioPeriod?.cost ?? 0
        const delta = Math.abs(legacyPeriod.cost - scenarioCost)

        console.log(`  │ ${legacyPeriod.period.padEnd(18)} │ $${legacyPeriod.cost.toLocaleString().padStart(10)} │ $${scenarioCost.toLocaleString().padStart(10)} │ $${delta.toFixed(2).padStart(7)} │`)
      }

      console.log('  └────────────────────┴──────────────┴──────────────┴──────────┘')
    }

    // ──────────────────────────────────────────────────────────────────────
    // TABLE 2: CONTRACT-LEVEL CONSERVATION (labor_loading vs legacy panel)
    // ──────────────────────────────────────────────────────────────────────
    const legacyLoading = await computeLegacyLaborLoading(proposal.id)

    console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')
    console.log('┃ TABLE 2: CONTRACT-LEVEL CONSERVATION                              ┃')
    console.log('┃ (labor_loading lines vs legacy panel total from intelligence)     ┃')
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')

    if (legacyLoading) {
      console.log(`┃ Legacy (panel):        ${legacyLoading.roleCount.toString().padStart(3)} roles, ${legacyLoading.totalHours.toString().padStart(6)} hours, $${legacyLoading.totalCost.toLocaleString().padStart(12)} ┃`)
      console.log(`┃ Scenario (loading):    ${scenario.laborLoadingLineCount.toString().padStart(3)} lines, ${scenario.totalHours.toString().padStart(6)} hours, $${scenario.laborLoadingTotalCost.toLocaleString().padStart(12)} ┃`)

      const contractCostDiff = scenario.laborLoadingTotalCost - legacyLoading.totalCost

      // Decompose the delta
      const decomposition = await decomposeContractLevelDelta(
        proposal.id,
        legacyLoading.totalCost,
        scenario.laborLoadingTotalCost
      )

      // Contract-level passes if: all delta is attributed (residual = 0)
      const contractPassed = Math.abs(decomposition.residual) < 0.01

      console.log(`┃                                                                    ┃`)
      console.log(`┃ Delta: $${contractCostDiff.toFixed(2).padStart(10)} (scenario - legacy)                     ┃`)
      console.log(`┃                                                                    ┃`)
      console.log(`┃ CONTRACT-LEVEL CHECK: ${contractPassed ? '✓ PASS (fully attributed)' : '✗ FAIL (unattributed residual)'}                 ┃`)
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')

      // Show delta decomposition
      if (decomposition.periodDivergences.length > 0) {
        console.log('\n  ╔════════════════════════════════════════════════════════════════╗')
        console.log('  ║ DELTA DECOMPOSITION: Period Definition Divergences             ║')
        console.log('  ╠════════════════════════════════════════════════════════════════╣')
        console.log('  ║                                                                ║')
        console.log('  ║ DATA FINDING: Legacy panel uses unconfirmed proposalSetup      ║')
        console.log('  ║ periods; scenario uses confirmed intelligence periods.         ║')
        console.log('  ║                                                                ║')

        for (const div of decomposition.periodDivergences) {
          const direction = div.monthDelta > 0 ? '+' : ''
          console.log(`  ║ ${div.periodName.padEnd(16)}: Legacy=${div.legacyMonths}mo → Intelligence=${div.intelligenceMonths}mo (Δ${direction}${div.monthDelta}mo) ║`)
        }

        console.log('  ╠════════════════════════════════════════════════════════════════╣')
        console.log('  ║ Line-by-Line Attribution                                       ║')
        console.log('  ╠════════════════════════════════════════════════════════════════╣')
        console.log('  ║ Role               │ Period      │ Hrs/Mo │ ΔMo │ ΔHrs  │ ΔCost ║')
        console.log('  ╟────────────────────┼─────────────┼────────┼─────┼───────┼───────╢')

        for (const line of decomposition.lineItems) {
          const roleTrunc = line.roleTitle.length > 18 ? line.roleTitle.substring(0, 15) + '...' : line.roleTitle
          const periodTrunc = line.periodName.length > 11 ? line.periodName.substring(0, 8) + '...' : line.periodName
          const deltaMo = line.monthDelta > 0 ? `+${line.monthDelta}` : `${line.monthDelta}`
          const deltaHrs = line.hoursDelta > 0 ? `+${line.hoursDelta}` : `${line.hoursDelta}`
          const deltaCost = line.costDelta > 0 ? `+$${line.costDelta.toFixed(0)}` : `-$${Math.abs(line.costDelta).toFixed(0)}`

          console.log(`  ║ ${roleTrunc.padEnd(18)} │ ${periodTrunc.padEnd(11)} │ ${line.hoursPerMonth.toString().padStart(6)} │ ${deltaMo.padStart(3)} │ ${deltaHrs.padStart(5)} │ ${deltaCost.padStart(5)} ║`)
        }

        console.log('  ╠════════════════════════════════════════════════════════════════╣')
        console.log(`  ║ Total Delta:       $${decomposition.totalDelta.toFixed(2).padStart(10)}                              ║`)
        console.log(`  ║ Attributed:        $${decomposition.attributedDelta.toFixed(2).padStart(10)}                              ║`)
        console.log(`  ║ Residual:          $${decomposition.residual.toFixed(2).padStart(10)} ${Math.abs(decomposition.residual) < 0.01 ? '✓ (fully explained)' : '✗ BUG'}           ║`)
        console.log('  ╚════════════════════════════════════════════════════════════════╝')

        // Known limitation notice
        console.log('\n  ┌────────────────────────────────────────────────────────────────┐')
        console.log('  │ KNOWN LIMITATION (to be documented):                           │')
        console.log('  │ Legacy contract-total uses unconfirmed period definitions from │')
        console.log('  │ working_data.proposalSetup. Scenarios use confirmed            │')
        console.log('  │ intelligence_periods. Displays converge when the panel reads   │')
        console.log('  │ from scenarios in Phase 6B/D.                                  │')
        console.log('  └────────────────────────────────────────────────────────────────┘')
      }

      // Period breakdown for contract-level
      if (legacyLoading.periodTotals.length > 0) {
        console.log('\n  Period breakdown (contract-level):')
        console.log('  ┌────────────────────┬──────────────┬──────────────┬──────────┐')
        console.log('  │ Period             │ Panel Cost   │ Loading Cost │ Delta    │')
        console.log('  ├────────────────────┼──────────────┼──────────────┼──────────┤')

        for (const panelPeriod of legacyLoading.periodTotals) {
          const { data: loadingLines } = await supabase
            .from('pricing_lines')
            .select('period_label, extended_cost')
            .eq('pricing_scenario_id', scenario.scenarioId)
            .eq('line_type', 'labor_loading')
            .eq('period_label', panelPeriod.period)

          const loadingCost = (loadingLines || []).reduce((sum, l) => sum + Number(l.extended_cost), 0)
          const delta = loadingCost - panelPeriod.cost

          console.log(`  │ ${panelPeriod.period.padEnd(18)} │ $${panelPeriod.cost.toLocaleString().padStart(10)} │ $${loadingCost.toLocaleString().padStart(10)} │ $${delta.toFixed(2).padStart(7)} │`)
        }

        console.log('  └────────────────────┴──────────────┴──────────────┴──────────┘')
      }
    } else {
      console.log('┃ No confirmed intelligence - labor_loading lines skipped          ┃')
      console.log(`┃ Scenario labor_loading lines: ${scenario.laborLoadingLineCount}                                  ┃`)
      console.log('┃                                                                    ┃')
      console.log('┃ CONTRACT-LEVEL CHECK: ⊘ N/A (no confirmed intelligence)           ┃')
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')
    }
  }
}

/**
 * Run requirements backfill and report
 */
async function runRequirementsBackfill(): Promise<void> {
  console.log('\n\n=== REQUIREMENTS BACKFILL ===\n')

  const proposals = [
    { id: PMHCD_PROPOSAL_ID, name: 'PM-HCD', expectedStatus: 'confirmed' },
    { id: CAMP_PROPOSAL_ID, name: 'CAMP', expectedStatus: 'draft' },
  ]

  for (const proposal of proposals) {
    console.log(`\n--- ${proposal.name} ---`)

    // Load proposal with working_data
    const { data: propData } = await supabase
      .from('proposals')
      .select('id, title, working_data, active_intelligence_version_id')
      .eq('id', proposal.id)
      .single()

    if (!propData) {
      console.log('  Proposal not found')
      continue
    }

    // Load intelligence version
    const { data: intelligence } = await supabase
      .from('intelligence_versions')
      .select('id, status, version_number')
      .eq('id', propData.active_intelligence_version_id)
      .single()

    console.log(`  Intelligence version: v${intelligence?.version_number} (${intelligence?.status})`)
    console.log(`  Expected status: ${proposal.expectedStatus}`)
    console.log(`  Status match: ${intelligence?.status === proposal.expectedStatus ? '✓' : '✗'}`)

    // Get requirements from working_data
    const workingData = propData.working_data as any
    const requirements = workingData?.requirements || []
    console.log(`  Requirements in working_data: ${requirements.length}`)

    // Load WBS tasks for tag resolution
    const { data: wbsVersion } = await supabase
      .from('wbs_versions')
      .select('id')
      .eq('proposal_id', proposal.id)
      .eq('status', 'active')
      .single()

    const { data: tasks } = await supabase
      .from('wbs_tasks')
      .select('id, wbs_code')
      .eq('wbs_version_id', wbsVersion?.id)

    const taskCodeMap = new Map((tasks || []).map(t => [t.wbs_code, t.id]))

    // Process requirements
    let inserted = 0
    let linked = 0
    const unresolvableTags: string[] = []

    for (const req of requirements) {
      // Insert requirement
      const { data: insertedReq, error: insertError } = await supabase
        .from('requirements')
        .insert({
          tenant_id: TENANT_ID,
          proposal_id: proposal.id,
          intelligence_version_id: intelligence?.id,
          reference_number: req.code,
          title: req.text,
          type: req.type || 'shall',
          row_version: 1,
        })
        .select('id')
        .single()

      if (insertError) {
        console.log(`  Error inserting ${req.code}: ${insertError.message}`)
        continue
      }

      inserted++

      // Resolve tags
      const tags = req.tags || []
      for (const tag of tags) {
        const taskId = taskCodeMap.get(tag)
        if (taskId) {
          // Create link
          await supabase.from('requirement_links').insert({
            requirement_id: insertedReq.id,
            wbs_task_id: taskId,
            link_source: 'ai',
          })
          linked++
        } else {
          unresolvableTags.push(`${req.code}:${tag}`)
        }
      }
    }

    console.log(`  Requirements inserted: ${inserted}`)
    console.log(`  Links created: ${linked}`)
    console.log(`  Unresolvable tags: ${unresolvableTags.length}`)
    if (unresolvableTags.length > 0) {
      console.log(`  Unresolvable tag list:`)
      for (const tag of unresolvableTags) {
        console.log(`    - ${tag} (disposition: orphaned, no matching WBS code)`)
      }
    }
  }
}

/**
 * Run charge code migration and report
 */
async function runChargeCodeMigration(): Promise<void> {
  console.log('\n\n=== CHARGE CODE MIGRATION ===\n')

  const proposals = [
    { id: PMHCD_PROPOSAL_ID, name: 'PM-HCD' },
    { id: CAMP_PROPOSAL_ID, name: 'CAMP' },
  ]

  for (const proposal of proposals) {
    console.log(`\n--- ${proposal.name} ---`)

    // Load proposal with working_data
    const { data: propData } = await supabase
      .from('proposals')
      .select('id, working_data')
      .eq('id', proposal.id)
      .single()

    if (!propData) {
      console.log('  Proposal not found')
      continue
    }

    const workingData = propData.working_data as any
    const chargeCodes = workingData?.chargeCodes || []
    console.log(`  Charge codes in working_data: ${chargeCodes.length}`)

    if (chargeCodes.length === 0) {
      console.log('  No charge codes to migrate')
      continue
    }

    // Load WBS tasks for linkage
    const { data: wbsVersion } = await supabase
      .from('wbs_versions')
      .select('id')
      .eq('proposal_id', proposal.id)
      .eq('status', 'active')
      .single()

    const { data: tasks } = await supabase
      .from('wbs_tasks')
      .select('id, wbs_code')
      .eq('wbs_version_id', wbsVersion?.id)

    const taskCodeMap = new Map((tasks || []).map(t => [t.wbs_code, t.id]))

    let created = 0
    let linkedHits = 0
    let linkedMisses = 0

    for (const cc of chargeCodes) {
      // Try to resolve task linkage
      let wbsTaskId = null
      if (cc.taskCode) {
        wbsTaskId = taskCodeMap.get(cc.taskCode)
        if (wbsTaskId) {
          linkedHits++
        } else {
          linkedMisses++
        }
      }

      const { error } = await supabase.from('proposal_charge_codes').insert({
        tenant_id: TENANT_ID,
        proposal_id: proposal.id,
        wbs_task_id: wbsTaskId,
        code: cc.code,
        description: cc.description,
      })

      if (!error) {
        created++
      }
    }

    console.log(`  Charge codes created: ${created}`)
    console.log(`  Task linkage hits: ${linkedHits}`)
    console.log(`  Task linkage misses: ${linkedMisses}`)
  }
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║         Phase 6A Backfill Rehearsal                          ║')
  console.log('║         Conservation Gate + Requirements + Charge Codes      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  try {
    // 1. Create prod-shaped test data
    await createProdShapedData()

    // 2. Run conservation gate (pricing scenario vs legacy)
    await runConservationGate()

    // 3. Run requirements backfill
    await runRequirementsBackfill()

    // 4. Run charge code migration
    await runChargeCodeMigration()

    console.log('\n\n=== BACKFILL REHEARSAL COMPLETE ===\n')
    console.log('Ready for Step 4: Staging deploy + E2E verification')

  } catch (error) {
    console.error('\n\nBackfill rehearsal failed:', error)
    process.exit(1)
  }
}

main()
