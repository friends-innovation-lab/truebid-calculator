/**
 * Sync roles from WBS task assignments into the roles pricing array.
 * Called after WBS generation and on task changes.
 * Looks up salaries from labor categories and calculates bill rates.
 */

import type { Role } from '@/contexts/app-context'
import {
  calculateBillRate as pricingEngineBillRate,
  resolveProfitRateWithFallback,
  DEFAULT_PROFIT_TARGETS,
  type IndirectRates,
  type ContractType,
} from '@/lib/pricing'

// FFTC indirect rates (will come from Account → Company Settings later)
const DEFAULT_INDIRECT_RATES: IndirectRates = {
  fringe: 0.2116,
  overhead: 0.3426,
  ga: 0.1983,
}

// Default profit resolved via central resolver for T&M contracts
const DEFAULT_PROFIT = DEFAULT_PROFIT_TARGETS.tm

// Default salaries by role name when no labor categories available
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

/**
 * Calculate bill rate using the centralized pricing engine.
 *
 * IMPORTANT: This function previously had a BUG where overhead was calculated
 * on salary alone instead of (salary + fringe). The pricing engine now uses
 * the correct formula, which results in rates ~$4/hr HIGHER (correct behavior).
 *
 * @param salary - Annual salary
 * @param profit - Profit rate as decimal (default 0.10)
 * @param rates - Optional indirect rates override
 * @returns Fully burdened hourly rate
 */
export function calculateBillRate(
  salary: number,
  profit: number = DEFAULT_PROFIT,
  rates: IndirectRates = DEFAULT_INDIRECT_RATES
): number {
  if (salary <= 0) return 0

  return pricingEngineBillRate({
    annualSalary: salary,
    rates,
    profitRate: profit,
  })
}

interface WBSTask {
  name?: string
  role: string | null
  hours: number
}

interface WBSElement {
  tasks?: WBSTask[]
  laborEstimates?: {
    roleName: string
    hoursByPeriod: { base: number; option1: number; option2: number; option3: number; option4: number }
  }[]
}

interface LaborCategory {
  title: string
  laborCategory?: string
  socCode?: string
  salaryLevels?: { level: string; levelTitle: string; steps: number[] }[]
  salary_levels?: { level: string; levelTitle?: string; level_title?: string; steps: number[] }[]
}

interface ExistingRole {
  id: string
  name: string
  type?: 'prime' | 'sub'
  subcontractorName?: string | null
  billRateBase?: number
  laborCategory?: string | null
  level?: string | null
  selectedLevel?: string
  selectedStep?: number
  currentSalary?: number
  profitMargin?: number
  isManual?: boolean
  [key: string]: unknown
}

interface ProposalSetup {
  optionYears?: number
  billableHoursPerYear?: number
  profitMargin?: number
  contractType?: ContractType
}

export interface SyncedRole {
  id: string
  name: string
  type: 'prime' | 'sub'
  subcontractorName: string | null
  billRateBase: number
  laborCategory: string | null
  socCode: string | null
  selectedLevel: string
  selectedLevelTitle: string
  selectedStep: number
  currentSalary: number
  profitMargin: number
  level: string | null
  totalHoursFromWBS: number
  isManual: boolean
  hoursByYear: {
    baseYear: number
    oy1: number
    oy2: number
    oy3: number
    oy4: number
  }
}

function mapToRole(r: SyncedRole, setup?: ProposalSetup | null): Role {
  const billableHrs = setup?.billableHoursPerYear || 1920
  const contractYears = (setup?.optionYears ?? 4) + 1
  const rawHoursPerYear = Math.round((r.totalHoursFromWBS || 0) / contractYears)
  // Cap at billable hours — cannot exceed one full-time person per year
  const hoursPerYear = Math.min(rawHoursPerYear, billableHrs)
  const fte = Math.round((hoursPerYear / billableHrs) * 100) / 100

  return {
    id: r.id,
    name: r.name,
    description: r.laborCategory || r.name,
    icLevel: (r.selectedLevel || 'IC3') as Role['icLevel'],
    baseSalary: r.currentSalary || 0,
    quantity: 1,
    fte,
    storyPoints: 0,
    years: {
      base: (r.hoursByYear?.baseYear || 0) > 0,
      option1: (r.hoursByYear?.oy1 || 0) > 0,
      option2: (r.hoursByYear?.oy2 || 0) > 0,
      option3: (r.hoursByYear?.oy3 || 0) > 0,
      option4: (r.hoursByYear?.oy4 || 0) > 0,
    },
    loadedRate: r.billRateBase || 0,
    billableHours: hoursPerYear,
    type: r.type || 'prime',
    subcontractorName: r.subcontractorName || null,
    selectedLevel: r.selectedLevel || 'IC3',
    selectedLevelTitle: r.selectedLevelTitle || '',
    selectedStep: r.selectedStep || 0,
    currentSalary: r.currentSalary || 0,
    billRateBase: r.billRateBase || 0,
    profitMargin: r.profitMargin || 0.10,
    laborCategory: r.laborCategory || null,
    socCode: r.socCode || null,
    hoursByYear: r.hoursByYear,
    totalHoursFromWBS: r.totalHoursFromWBS || 0,
    isManual: r.isManual || false,
  }
}

export function syncRolesFromWBS(
  wbsElements: WBSElement[],
  existingRoles: ExistingRole[],
  setup?: ProposalSetup | null,
  laborCategories?: LaborCategory[],
): Role[] {
  // Resolve profit rate via central resolver
  const resolved = resolveProfitRateWithFallback({
    explicitProfitRate: setup?.profitMargin,
    contractType: setup?.contractType || 'tm',
  }, DEFAULT_PROFIT)
  const profit = resolved.profitRate
  const billableHrs = setup?.billableHoursPerYear || 1920

  // Aggregate hours by role from laborEstimates only (tasks duplicate the same data)
  const roleHours: Record<string, number> = {}

  wbsElements.forEach(element => {
    element.laborEstimates?.forEach(le => {
      if (!le.roleName) return
      const h = le.hoursByPeriod
      const total = (h.base || 0) + (h.option1 || 0) + (h.option2 || 0) + (h.option3 || 0) + (h.option4 || 0)
      roleHours[le.roleName] = (roleHours[le.roleName] || 0) + total
    })
  })

  // Build WBS-derived roles
  const wbsRoles: SyncedRole[] = Object.entries(roleHours)
    .filter(([, hours]) => hours > 0)
    .map(([roleName, totalHours]) => {
      const existing = existingRoles.find(r => r.name === roleName)

      // Sum per-year hours across all elements for this role from laborEstimates
      const yearHours = { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 }
      wbsElements.forEach(el => {
        el.laborEstimates?.forEach(le => {
          if (le.roleName !== roleName) return
          const h = le.hoursByPeriod
          yearHours.baseYear += h.base || 0
          yearHours.oy1 += h.option1 || 0
          yearHours.oy2 += h.option2 || 0
          yearHours.oy3 += h.option3 || 0
          yearHours.oy4 += h.option4 || 0
        })
      })

      // Look up labor category
      const laborCat = laborCategories?.find(lc => lc.title === roleName)
      const levels = laborCat?.salaryLevels || laborCat?.salary_levels || []
      const defaultLevel = levels.find(l => l.level === 'IC3') || levels[2] || levels[0]
      const defaultSalary = defaultLevel?.steps?.[0] || DEFAULT_SALARIES[roleName] || 120000
      const levelTitle = defaultLevel?.levelTitle || (defaultLevel as Record<string, unknown>)?.level_title as string || 'Mid-Level'

      const currentSalary = existing?.currentSalary || defaultSalary
      const billRate = existing?.billRateBase || calculateBillRate(currentSalary, profit)

      return {
        id: existing?.id || crypto.randomUUID(),
        name: roleName,
        type: (existing?.type as 'prime' | 'sub') || 'prime',
        subcontractorName: existing?.subcontractorName || null,
        billRateBase: billRate,
        laborCategory: laborCat?.laborCategory || null,
        socCode: laborCat?.socCode || null,
        selectedLevel: existing?.selectedLevel || defaultLevel?.level || 'IC3',
        selectedLevelTitle: levelTitle,
        selectedStep: existing?.selectedStep ?? 0,
        currentSalary,
        profitMargin: existing?.profitMargin ?? profit,
        level: existing?.selectedLevel || defaultLevel?.level || 'IC3',
        totalHoursFromWBS: totalHours,
        isManual: false,
        hoursByYear: {
          baseYear: Math.min(yearHours.baseYear, billableHrs),
          oy1: Math.min(yearHours.oy1, billableHrs),
          oy2: Math.min(yearHours.oy2, billableHrs),
          oy3: Math.min(yearHours.oy3, billableHrs),
          oy4: Math.min(yearHours.oy4, billableHrs),
        },
      }
    })

  // Keep manually added roles
  const manualRoles: SyncedRole[] = existingRoles
    .filter(r => r.isManual && !roleHours[r.name])
    .map(r => ({
      id: r.id,
      name: r.name,
      type: (r.type as 'prime' | 'sub') || 'prime',
      subcontractorName: r.subcontractorName || null,
      billRateBase: r.billRateBase || 0,
      laborCategory: r.laborCategory || null,
      socCode: null,
      selectedLevel: r.selectedLevel || 'IC3',
      selectedLevelTitle: 'Mid-Level',
      selectedStep: r.selectedStep ?? 0,
      currentSalary: r.currentSalary || 0,
      profitMargin: r.profitMargin ?? DEFAULT_PROFIT,
      level: r.level || null,
      totalHoursFromWBS: 0,
      isManual: true,
      hoursByYear: { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 },
    }))

  const allRoles = [...wbsRoles, ...manualRoles]
  return allRoles.map(r => mapToRole(r, setup))
}
