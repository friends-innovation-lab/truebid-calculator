/**
 * Phase 3: Roles Projection Layer
 *
 * Field-location split:
 * - STAFFING fields (hours, FTE, periods) → from staffing_assignments table
 * - PRICING fields (salary, rates, levels) → from working_data.roles
 *
 * This projection merges both sources into the Role[] format the UI expects,
 * providing a bridge during the Phase 3 transition.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '@/contexts/app-context'
import {
  calculateBillRate as pricingEngineBillRate,
  resolveProfitRateWithFallback,
  DEFAULT_PROFIT_TARGETS,
  type IndirectRates,
  type ContractType,
} from '@/lib/pricing'

// =============================================================================
// TYPES
// =============================================================================

interface StaffingRow {
  role_title: string
  discipline: string
  prime_or_sub: 'prime' | 'sub'
  subcontractor_name: string | null
  period_label: string
  hours: number
}

interface WorkingDataRole {
  id: string
  name: string
  type?: 'prime' | 'sub'
  subcontractorName?: string | null
  billRateBase?: number
  laborCategory?: string | null
  socCode?: string | null
  selectedLevel?: string
  selectedLevelTitle?: string
  selectedStep?: number
  currentSalary?: number
  profitMargin?: number
  isManual?: boolean
  [key: string]: unknown
}

interface LaborCategory {
  title: string
  laborCategory?: string
  labor_category?: string
  socCode?: string
  soc_code?: string
  salary_levels?: { level: string; level_title?: string; steps: number[] }[]
}

interface ProposalSetup {
  optionYears?: number
  billableHoursPerYear?: number
  profitMargin?: number
  contractType?: ContractType
}

// Default indirect rates (loaded from company_settings in practice)
const DEFAULT_INDIRECT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}

// Default salaries by role name
const DEFAULT_SALARIES: Record<string, number> = {
  'Back-end Developer': 120000,
  'Front-end Developer': 128000,
  'DevOps Engineer': 120000,
  'QA Engineer': 103000,
  'Product Manager': 125000,
  'Product Designer': 118000,
  'UX Researcher': 118000,
  'Content/UX Writer': 95000,
  'Delivery Manager': 125000,
  'Technical Lead': 145000,
  'Design Lead': 138000,
}

// Period label to hoursByYear key mapping
type HoursByYearKey = 'baseYear' | 'oy1' | 'oy2' | 'oy3' | 'oy4'
const PERIOD_TO_YEAR_KEY: Record<string, HoursByYearKey> = {
  'Base Period': 'baseYear',
  'Option Period 1': 'oy1',
  'Option Period 2': 'oy2',
  'Option Period 3': 'oy3',
  'Option Period 4': 'oy4',
}

// =============================================================================
// PROJECTION FUNCTION
// =============================================================================

export interface ProjectedRolesResult {
  roles: Role[]
  hasActiveWbs: boolean
  wbsVersionId: string | null
}

/**
 * Project roles from staffing_assignments + working_data.roles
 *
 * Source of truth split:
 * - Hours by period → staffing_assignments table (grouped by role_title)
 * - Pricing (salary, rates) → working_data.roles
 * - Labor categories → company_roles table
 */
export async function projectRoles(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<ProjectedRolesResult> {
  // 1. Get proposal with working_data
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('working_data, contract_type, period_of_performance, company_id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    throw new Error(`Proposal not found: ${proposalError?.message}`)
  }

  const workingData = (proposal.working_data || {}) as Record<string, unknown>
  const existingRoles = (workingData.roles || []) as WorkingDataRole[]
  const proposalSetup = (workingData.proposalSetup || {}) as ProposalSetup
  const contractType = (proposal.contract_type as ContractType) || 'tm'
  const periodOfPerformance = (proposal.period_of_performance || {}) as { optionYears?: number }
  const optionYears = periodOfPerformance.optionYears ?? 4

  // 2. Get active WBS version
  const { data: activeWbs, error: wbsError } = await supabase
    .from('wbs_versions')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('status', 'active')
    .single()

  if (wbsError || !activeWbs) {
    // No active WBS — return existing roles from working_data only (manual roles)
    return {
      roles: existingRoles.filter(r => r.isManual).map(r => workingDataToRole(r, proposalSetup)),
      hasActiveWbs: false,
      wbsVersionId: null,
    }
  }

  // 3. Query staffing assignments for active WBS version
  const { data: assignments, error: assignError } = await supabase
    .from('staffing_assignments')
    .select(`
      role_title,
      discipline,
      prime_or_sub,
      subcontractor_name,
      period_label,
      hours,
      wbs_tasks!inner(wbs_version_id)
    `)
    .eq('wbs_tasks.wbs_version_id', activeWbs.id)

  if (assignError) {
    throw new Error(`Failed to load staffing: ${assignError.message}`)
  }

  // 4. Load labor categories for salary lookup
  let laborCategories: LaborCategory[] = []
  if (proposal.company_id) {
    const { data: roles } = await supabase
      .from('company_roles')
      .select('title, labor_category, soc_code, salary_levels')
      .eq('company_id', proposal.company_id)
    laborCategories = (roles || []).map(r => ({
      title: r.title,
      laborCategory: r.labor_category,
      labor_category: r.labor_category,
      socCode: r.soc_code,
      soc_code: r.soc_code,
      salary_levels: r.salary_levels,
    }))
  }

  // 5. Aggregate hours by role_title
  const staffingRows = (assignments || []) as StaffingRow[]
  const roleAggregates = aggregateByRole(staffingRows)

  // 6. Resolve profit rate
  const resolved = resolveProfitRateWithFallback({
    explicitProfitRate: proposalSetup.profitMargin,
    contractType,
  }, DEFAULT_PROFIT_TARGETS.tm)
  const profit = resolved.profitRate
  const billableHrs = proposalSetup.billableHoursPerYear || 1920

  // 7. Build projected roles
  const projectedRoles: Role[] = []

  for (const [roleTitle, agg] of Object.entries(roleAggregates)) {
    const existing = existingRoles.find(r => r.name === roleTitle)
    const laborCat = laborCategories.find(lc => lc.title === roleTitle)

    // Get salary from existing role or labor category defaults
    const levels = laborCat?.salary_levels || []
    const defaultLevel = levels.find(l => l.level === 'IC3') || levels[2] || levels[0]
    const defaultSalary = defaultLevel?.steps?.[0] || DEFAULT_SALARIES[roleTitle] || 120000
    const levelTitle = defaultLevel?.level_title || 'Mid-Level'

    const currentSalary = existing?.currentSalary || defaultSalary
    const billRate = existing?.billRateBase || pricingEngineBillRate({
      annualSalary: currentSalary,
      rates: DEFAULT_INDIRECT_RATES,
      profitRate: profit,
    })

    // Cap hours per year at billable hours
    const hoursByYear = {
      baseYear: Math.min(agg.hoursByYear.baseYear, billableHrs),
      oy1: Math.min(agg.hoursByYear.oy1, billableHrs),
      oy2: Math.min(agg.hoursByYear.oy2, billableHrs),
      oy3: Math.min(agg.hoursByYear.oy3, billableHrs),
      oy4: Math.min(agg.hoursByYear.oy4, billableHrs),
    }

    const totalHours = Object.values(hoursByYear).reduce((a, b) => a + b, 0)
    const contractYears = optionYears + 1
    const hoursPerYear = Math.min(Math.round(totalHours / contractYears), billableHrs)
    const fte = Math.round((hoursPerYear / billableHrs) * 100) / 100

    projectedRoles.push({
      id: existing?.id || crypto.randomUUID(),
      name: roleTitle,
      description: laborCat?.laborCategory || laborCat?.labor_category || roleTitle,
      icLevel: (existing?.selectedLevel || 'IC3') as Role['icLevel'],
      baseSalary: currentSalary,
      quantity: 1,
      fte,
      storyPoints: 0,
      years: {
        base: hoursByYear.baseYear > 0,
        option1: hoursByYear.oy1 > 0,
        option2: hoursByYear.oy2 > 0,
        option3: hoursByYear.oy3 > 0,
        option4: hoursByYear.oy4 > 0,
      },
      loadedRate: billRate,
      billableHours: hoursPerYear,
      type: agg.type,
      subcontractorName: agg.subcontractorName,
      selectedLevel: existing?.selectedLevel || defaultLevel?.level || 'IC3',
      selectedLevelTitle: existing?.selectedLevelTitle || levelTitle,
      selectedStep: existing?.selectedStep ?? 0,
      currentSalary,
      billRateBase: billRate,
      profitMargin: existing?.profitMargin ?? profit,
      laborCategory: laborCat?.laborCategory || laborCat?.labor_category || null,
      socCode: laborCat?.socCode || laborCat?.soc_code || null,
      hoursByYear,
      totalHoursFromWBS: totalHours,
      isManual: false,
    })
  }

  // 8. Add manual roles that aren't in staffing
  const staffingRoleNames = new Set(Object.keys(roleAggregates))
  const manualRoles = existingRoles
    .filter(r => r.isManual && !staffingRoleNames.has(r.name))
    .map(r => workingDataToRole(r, proposalSetup))

  return {
    roles: [...projectedRoles, ...manualRoles],
    hasActiveWbs: true,
    wbsVersionId: activeWbs.id,
  }
}

// =============================================================================
// HELPERS
// =============================================================================

interface HoursByYear {
  baseYear: number
  oy1: number
  oy2: number
  oy3: number
  oy4: number
}

interface RoleAggregate {
  hoursByYear: HoursByYear
  type: 'prime' | 'sub'
  subcontractorName: string | null
}

function aggregateByRole(rows: StaffingRow[]): Record<string, RoleAggregate> {
  const agg: Record<string, RoleAggregate> = {}

  for (const row of rows) {
    if (!agg[row.role_title]) {
      agg[row.role_title] = {
        hoursByYear: { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 },
        type: row.prime_or_sub,
        subcontractorName: row.subcontractor_name,
      }
    }

    const yearKey = PERIOD_TO_YEAR_KEY[row.period_label]
    if (yearKey) {
      agg[row.role_title].hoursByYear[yearKey] += row.hours
    }
  }

  return agg
}

function workingDataToRole(r: WorkingDataRole, _setup?: ProposalSetup | null): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.laborCategory || r.name,
    icLevel: (r.selectedLevel || 'IC3') as Role['icLevel'],
    baseSalary: r.currentSalary || 0,
    quantity: 1,
    fte: 0,
    storyPoints: 0,
    years: { base: false, option1: false, option2: false, option3: false, option4: false },
    loadedRate: r.billRateBase || 0,
    billableHours: 0,
    type: r.type || 'prime',
    subcontractorName: r.subcontractorName || null,
    selectedLevel: r.selectedLevel || 'IC3',
    selectedLevelTitle: r.selectedLevelTitle || '',
    selectedStep: r.selectedStep ?? 0,
    currentSalary: r.currentSalary || 0,
    billRateBase: r.billRateBase || 0,
    profitMargin: r.profitMargin ?? 0.10,
    laborCategory: r.laborCategory || null,
    socCode: r.socCode || null,
    hoursByYear: { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 },
    totalHoursFromWBS: 0,
    isManual: r.isManual || false,
  }
}

// =============================================================================
// FIELD LOCATION MAP (Documentation)
// =============================================================================

/**
 * FIELD LOCATION MAP - Phase 3 Split
 *
 * STAFFING FIELDS (source: staffing_assignments table)
 * - hoursByYear.baseYear
 * - hoursByYear.oy1-oy4
 * - totalHoursFromWBS
 * - fte (derived)
 * - billableHours (derived)
 * - years.base/option1-4 (derived)
 * - type (prime/sub)
 * - subcontractorName
 *
 * PRICING FIELDS (source: working_data.roles)
 * - id
 * - name
 * - currentSalary
 * - billRateBase
 * - profitMargin
 * - selectedLevel
 * - selectedLevelTitle
 * - selectedStep
 * - laborCategory
 * - socCode
 * - isManual
 *
 * UI BEHAVIOR:
 * - Edit salary/level/profit → updates working_data.roles (pricing)
 * - Edit hours → calls UpdateStaffingAssignment command
 * - Add manual role → updates working_data.roles
 * - View hours → projected from staffing_assignments
 */
