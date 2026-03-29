'use client'

import { useEffect, useRef } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { proposalsApi } from '@/lib/api'

const PROPOSAL_DATA_PREFIX = 'truebid-proposal-data-'

/**
 * Hook to sync AppContext state with Supabase via the proposals API.
 *
 * On load: fetches proposal from API and hydrates context from working_data.
 *          Falls back to localStorage if API fails (offline safety).
 * On save: debounces 2s, then PUTs working_data + metadata to API.
 *          Also writes to localStorage as a cache.
 */

// Map dashboard contract type to context format
function mapContractType(type: string): 'FFP' | 'T&M' | 'GSA' | 'CPFF' | 'CPAF' | 'IDIQ' | 'BPA' | 'hybrid' | '' {
  const mapping: Record<string, 'FFP' | 'T&M' | 'GSA' | 'CPFF' | 'CPAF' | 'IDIQ' | 'BPA' | 'hybrid' | ''> = {
    'ffp': 'FFP',
    'tm': 'T&M',
    'gsa': 'GSA',
    'cpff': 'CPFF',
    'cpaf': 'CPAF',
    'idiq': 'IDIQ',
    'bpa': 'BPA',
    'hybrid': 'hybrid',
  }
  return mapping[type.toLowerCase()] || 'T&M'
}

// Map context contract type to dashboard format
function mapContractTypeToDashboard(type: string): 'tm' | 'ffp' | 'hybrid' {
  if (type === 'FFP' || type === 'CPFF' || type === 'CPAF') return 'ffp'
  if (type === 'T&M' || type === 'GSA') return 'tm'
  if (type === 'hybrid' || type === 'IDIQ' || type === 'BPA') return 'hybrid'
  return 'tm'
}

interface WorkingData {
  solicitation?: Record<string, unknown>
  selectedRoles?: unknown[]
  subcontractors?: unknown[]
  teamingPartners?: unknown[]
  estimateWbsElements?: unknown[]
  rateJustifications?: Record<string, unknown>
  odcs?: unknown[]
  perDiem?: unknown[]
  extractedRequirements?: unknown[]
  lastSaved?: string
  // Extra fields not managed by context (e.g., solicitationRawText)
  [key: string]: unknown
}

// Fields managed by context - used to preserve extra fields when saving
const MANAGED_FIELDS = [
  'solicitation',
  'selectedRoles',
  'subcontractors',
  'teamingPartners',
  'estimateWbsElements',
  'rateJustifications',
  'odcs',
  'perDiem',
  'extractedRequirements',
  'lastSaved',
]

// Uses ReturnType to get exact setter signatures from useAppContext
type ContextSetters = Pick<
  ReturnType<typeof useAppContext>,
  'setSolicitation' | 'updateSolicitation' | 'setSelectedRoles' | 'setSubcontractors' |
  'setTeamingPartners' | 'setEstimateWbsElements' | 'setRateJustifications' | 'setODCs' | 'setPerDiem' | 'setExtractedRequirements'
>

function hydrateContext(
  data: WorkingData,
  setters: ContextSetters,
  apiProposal?: { title?: string; solicitation?: string; client?: string; contractType?: string; dueDate?: string } | null,
) {
  // These casts are safe — the data shape comes from the same context that wrote it
  if (data.selectedRoles) setters.setSelectedRoles(data.selectedRoles as Parameters<ContextSetters['setSelectedRoles']>[0])
  if (data.subcontractors) setters.setSubcontractors(data.subcontractors as Parameters<ContextSetters['setSubcontractors']>[0])
  if (data.teamingPartners) setters.setTeamingPartners(data.teamingPartners as Parameters<ContextSetters['setTeamingPartners']>[0])
  if (data.estimateWbsElements) setters.setEstimateWbsElements(data.estimateWbsElements as Parameters<ContextSetters['setEstimateWbsElements']>[0])
  if (data.rateJustifications) setters.setRateJustifications(data.rateJustifications as Parameters<ContextSetters['setRateJustifications']>[0])
  if (data.odcs) setters.setODCs(data.odcs as Parameters<ContextSetters['setODCs']>[0])
  if (data.perDiem) setters.setPerDiem(data.perDiem as Parameters<ContextSetters['setPerDiem']>[0])
  if (data.extractedRequirements) setters.setExtractedRequirements(data.extractedRequirements as Parameters<ContextSetters['setExtractedRequirements']>[0])

  // Merge solicitation: API metadata takes precedence, working_data fills the rest
  const localSol = (data.solicitation || {}) as Record<string, unknown>
  if (apiProposal) {
    setters.updateSolicitation({
      ...localSol,
      title: apiProposal.title || (localSol.title as string) || '',
      solicitationNumber: apiProposal.solicitation || (localSol.solicitationNumber as string) || '',
      clientAgency: apiProposal.client || (localSol.clientAgency as string) || '',
      contractType: mapContractType(apiProposal.contractType || 'tm'),
      proposalDueDate: apiProposal.dueDate || (localSol.proposalDueDate as string) || '',
    } as Parameters<ContextSetters['updateSolicitation']>[0])
  } else if (data.solicitation) {
    setters.setSolicitation(data.solicitation as unknown as Parameters<ContextSetters['setSolicitation']>[0])
  }
}

export function useProposalSync(proposalId: string) {
  const {
    solicitation,
    selectedRoles,
    subcontractors,
    teamingPartners,
    estimateWbsElements,
    rateJustifications,
    odcs,
    perDiem,
    extractedRequirements,
    setSolicitation,
    updateSolicitation,
    setSelectedRoles,
    setSubcontractors,
    setTeamingPartners,
    setEstimateWbsElements,
    setRateJustifications,
    setODCs,
    setPerDiem,
    setExtractedRequirements,
    resetSolicitation,
  } = useAppContext()

  const isInitialLoad = useRef(true)
  const lastSavedRef = useRef<string>('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastProposalIdRef = useRef<string>('')
  // Store extra fields from DB that aren't managed by context (e.g., solicitationRawText)
  const extraFieldsRef = useRef<Record<string, unknown>>({})

  const setters = {
    setSolicitation, updateSolicitation, setSelectedRoles, setSubcontractors,
    setTeamingPartners, setEstimateWbsElements, setRateJustifications, setODCs, setPerDiem, setExtractedRequirements,
  }

  // Clear all working data state (call when proposal changes)
  const clearWorkingData = () => {
    resetSolicitation()
    setSelectedRoles([])
    setSubcontractors([])
    setTeamingPartners([])
    setEstimateWbsElements([])
    setRateJustifications({})
    setODCs([])
    setPerDiem([])
    setExtractedRequirements([])
    lastSavedRef.current = ''
    console.log('[ProposalSync] Cleared working data')
  }

  // ===== LOAD =====
  useEffect(() => {
    if (!proposalId) return

    // Clear stale data when proposal ID changes
    if (lastProposalIdRef.current && lastProposalIdRef.current !== proposalId) {
      console.log('[ProposalSync] Proposal ID changed, clearing stale data')
      clearWorkingData()
    }
    lastProposalIdRef.current = proposalId

    async function loadProposalData() {
      try {
        // Primary source: Supabase API
        const response = await proposalsApi.get(proposalId) as {
          proposal: {
            title?: string
            solicitation?: string
            client?: string
            contractType?: string
            dueDate?: string
            workingData?: WorkingData
          } | null
        }

        if (response.proposal) {
          const proposal = response.proposal
          const workingData: WorkingData = proposal.workingData || {}

          // Extract extra fields not managed by context (e.g., solicitationRawText)
          const extraFields: Record<string, unknown> = {}
          for (const key of Object.keys(workingData)) {
            if (!MANAGED_FIELDS.includes(key)) {
              extraFields[key] = workingData[key]
            }
          }
          extraFieldsRef.current = extraFields

          // If API has working_data, use it
          if (workingData && Object.keys(workingData).length > 0) {
            hydrateContext(workingData, setters, proposal)
            console.log('[ProposalSync] Loaded working data from API:', proposalId, 'Extra fields:', Object.keys(extraFields))
          } else {
            // API has no working_data yet — check localStorage for migration
            const localData = loadFromLocalStorage(proposalId)
            if (localData) {
              hydrateContext(localData, setters, proposal)
              console.log('[ProposalSync] Loaded working data from localStorage (will migrate):', proposalId)
            } else {
              // Just set solicitation from API metadata
              hydrateContext({}, setters, proposal)
            }
          }
        } else {
          throw new Error('No proposal found in API')
        }
      } catch (error) {
        console.warn('[ProposalSync] API load failed, falling back to localStorage:', error)

        // Fallback: localStorage
        const localData = loadFromLocalStorage(proposalId)
        if (localData) {
          hydrateContext(localData, setters)
          console.log('[ProposalSync] Loaded from localStorage fallback:', proposalId)
        } else {
          // New proposal — reset to defaults
          resetSolicitation()
          setSelectedRoles([])
          setSubcontractors([])
          setEstimateWbsElements([])
          setRateJustifications({})
          setODCs([])
          setPerDiem([])
          console.log('[ProposalSync] New proposal, reset to defaults:', proposalId)
        }
      }

      // Mark initial load complete after a tick
      setTimeout(() => {
        isInitialLoad.current = false
      }, 100)
    }

    loadProposalData()

    return () => {
      isInitialLoad.current = true
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable refs, only re-run when proposalId changes
  }, [proposalId])

  // Clear working data when component unmounts (navigating away from proposal)
  useEffect(() => {
    return () => {
      // Clear stale data when leaving proposal view
      clearWorkingData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on unmount
  }, [])

  // ===== SAVE =====
  useEffect(() => {
    if (isInitialLoad.current || !proposalId) return

    // Merge managed fields with extra fields from DB (e.g., solicitationRawText)
    const workingData = {
      ...extraFieldsRef.current,
      solicitation,
      selectedRoles,
      subcontractors,
      teamingPartners,
      estimateWbsElements,
      rateJustifications,
      odcs,
      perDiem,
      extractedRequirements,
      lastSaved: new Date().toISOString(),
    }

    // Skip if nothing changed (only compare managed fields to avoid churn from extra fields)
    const managedData = {
      solicitation,
      selectedRoles,
      subcontractors,
      teamingPartners,
      estimateWbsElements,
      rateJustifications,
      odcs,
      perDiem,
      extractedRequirements,
    }
    const dataHash = JSON.stringify(managedData)
    if (dataHash === lastSavedRef.current) return
    lastSavedRef.current = dataHash

    // Write to localStorage as cache
    try {
      const proposalDataKey = `${PROPOSAL_DATA_PREFIX}${proposalId}`
      localStorage.setItem(proposalDataKey, JSON.stringify(workingData))
    } catch {
      // localStorage may be full or unavailable
    }

    // Debounce API save (2s)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await proposalsApi.update(proposalId, {
          // Metadata fields (for dashboard display)
          title: solicitation.title || 'Untitled Proposal',
          solicitation: solicitation.solicitationNumber || '',
          client: solicitation.clientAgency || '',
          totalValue: calculateTotalValue(selectedRoles, subcontractors),
          dueDate: solicitation.proposalDueDate || null,
          teamSize: selectedRoles.length + subcontractors.length,
          contractType: mapContractTypeToDashboard(solicitation.contractType),
          periodOfPerformance: formatPeriodOfPerformance(solicitation.periodOfPerformance),
          progress: calculateProgress(solicitation, selectedRoles, estimateWbsElements),
          // Full working data blob
          working_data: workingData,
        })
        console.log('[ProposalSync] Saved to Supabase:', proposalId)
      } catch (error) {
        console.warn('[ProposalSync] API save failed (cached in localStorage):', error)
      }
    }, 2000)
  }, [
    proposalId,
    solicitation,
    selectedRoles,
    subcontractors,
    teamingPartners,
    estimateWbsElements,
    rateJustifications,
    odcs,
    perDiem,
    extractedRequirements,
  ])
}

// ===== HELPERS =====

function loadFromLocalStorage(proposalId: string): WorkingData | null {
  try {
    const stored = localStorage.getItem(`${PROPOSAL_DATA_PREFIX}${proposalId}`)
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore parse errors
  }
  return null
}

function calculateTotalValue(
  roles: Array<{ baseSalary: number; fte: number; years: Record<string, boolean> }>,
  subs: Array<{ billedRate: number; fte: number; years: Record<string, boolean> }>
): number {
  const HOURS_PER_YEAR = 1920
  let total = 0

  roles.forEach(role => {
    const activeYears = Object.values(role.years).filter(Boolean).length
    total += role.baseSalary * role.fte * activeYears
  })

  subs.forEach(sub => {
    const activeYears = Object.values(sub.years).filter(Boolean).length
    total += sub.billedRate * HOURS_PER_YEAR * sub.fte * activeYears
  })

  return total
}

function formatPeriodOfPerformance(pop: { baseYear: boolean; optionYears: number }): string {
  if (pop.baseYear && pop.optionYears > 0) {
    return `1 Base + ${pop.optionYears} OY${pop.optionYears > 1 ? 's' : ''}`
  }
  if (pop.baseYear) return '1 Base Year'
  if (pop.optionYears > 0) return `${pop.optionYears} Option Year${pop.optionYears > 1 ? 's' : ''}`
  return ''
}

function calculateProgress(
  solicitation: { title?: string; clientAgency?: string; solicitationNumber?: string },
  roles: unknown[],
  wbsElements: unknown[]
): number {
  let progress = 0
  if (solicitation.title || solicitation.solicitationNumber) progress += 15
  if (solicitation.clientAgency) progress += 15
  if (roles.length > 0) progress += 40
  if (wbsElements.length > 0) progress += 30
  return Math.min(progress, 100)
}

// ===== ONE-TIME MIGRATION =====

const MIGRATION_KEY = 'truebid-localstorage-migrated'

/**
 * Migrate all proposal working data from localStorage to Supabase.
 * Runs once on login for users who have localStorage data.
 * Call this from the dashboard or layout after auth is confirmed.
 */
export async function migrateLocalStorageToSupabase(): Promise<{ migrated: number; errors: number }> {
  if (typeof window === 'undefined') return { migrated: 0, errors: 0 }

  // Already migrated?
  if (localStorage.getItem(MIGRATION_KEY)) return { migrated: 0, errors: 0 }

  let migrated = 0
  let errors = 0

  // Find all proposal data keys in localStorage
  const keysToMigrate: { proposalId: string; data: WorkingData }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PROPOSAL_DATA_PREFIX)) {
      const proposalId = key.replace(PROPOSAL_DATA_PREFIX, '')
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        if (data && Object.keys(data).length > 0) {
          keysToMigrate.push({ proposalId, data })
        }
      } catch {
        // skip corrupt entries
      }
    }
  }

  if (keysToMigrate.length === 0) {
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString())
    return { migrated: 0, errors: 0 }
  }

  console.log(`[Migration] Found ${keysToMigrate.length} proposals to migrate from localStorage`)

  for (const { proposalId, data } of keysToMigrate) {
    try {
      await proposalsApi.update(proposalId, { working_data: data })
      migrated++
      console.log(`[Migration] Migrated proposal ${proposalId}`)
    } catch (error) {
      errors++
      console.warn(`[Migration] Failed to migrate proposal ${proposalId}:`, error)
    }
  }

  // Mark migration as done (even if some failed — they'll still have localStorage fallback)
  localStorage.setItem(MIGRATION_KEY, new Date().toISOString())
  console.log(`[Migration] Complete: ${migrated} migrated, ${errors} errors`)

  return { migrated, errors }
}

export default useProposalSync
