/**
 * Sync roles from WBS task assignments into the roles pricing array.
 * Called after WBS generation and on task changes.
 */

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

interface ExistingRole {
  id: string
  name: string
  type?: 'prime' | 'sub'
  subcontractorName?: string | null
  billRateBase?: number
  laborCategory?: string | null
  level?: string | null
  isManual?: boolean
  [key: string]: unknown
}

interface ProposalSetup {
  optionYears?: number
  billableHoursPerYear?: number
}

interface SyncedRole {
  id: string
  name: string
  type: 'prime' | 'sub'
  subcontractorName: string | null
  billRateBase: number
  laborCategory: string | null
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

export function syncRolesFromWBS(
  wbsElements: WBSElement[],
  existingRoles: ExistingRole[],
  setup?: ProposalSetup | null,
): SyncedRole[] {
  const optionYears = setup?.optionYears ?? 4

  // Aggregate hours by role across all tasks and labor estimates
  const roleHours: Record<string, number> = {}

  wbsElements.forEach(element => {
    // From tasks array (new format)
    element.tasks?.forEach(task => {
      if (!task.role) return
      roleHours[task.role] = (roleHours[task.role] || 0) + (task.hours || 0)
    })
    // From laborEstimates (legacy format)
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
      const yearCount = optionYears + 1
      const hoursPerYear = Math.round(totalHours / yearCount)

      return {
        id: existing?.id || crypto.randomUUID(),
        name: roleName,
        type: (existing?.type as 'prime' | 'sub') || 'prime',
        subcontractorName: existing?.subcontractorName || null,
        billRateBase: existing?.billRateBase || 0,
        laborCategory: existing?.laborCategory || null,
        level: existing?.level || null,
        totalHoursFromWBS: totalHours,
        isManual: false,
        hoursByYear: {
          baseYear: hoursPerYear,
          oy1: optionYears >= 1 ? hoursPerYear : 0,
          oy2: optionYears >= 2 ? hoursPerYear : 0,
          oy3: optionYears >= 3 ? hoursPerYear : 0,
          oy4: optionYears >= 4 ? hoursPerYear : 0,
        },
      }
    })

  // Keep manually added roles that don't come from WBS
  const manualRoles: SyncedRole[] = existingRoles
    .filter(r => r.isManual && !roleHours[r.name])
    .map(r => ({
      id: r.id,
      name: r.name,
      type: (r.type as 'prime' | 'sub') || 'prime',
      subcontractorName: r.subcontractorName || null,
      billRateBase: r.billRateBase || 0,
      laborCategory: r.laborCategory || null,
      level: r.level || null,
      totalHoursFromWBS: 0,
      isManual: true,
      hoursByYear: { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 },
    }))

  return [...wbsRoles, ...manualRoles]
}
