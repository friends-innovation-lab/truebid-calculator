'use client'

import { useEffect, useRef } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { proposalsApi } from '@/lib/api'

const PROPOSAL_DATA_PREFIX = 'truebid-proposal-data-'

/**
 * Hook to sync AppContext data with dashboard localStorage
 * 
 * This bridges the gap between:
 * - Dashboard's proposal list (truebid-proposals) - metadata for cards
 * - AppContext state (solicitation, selectedRoles, etc.) - working data
 * - Per-proposal storage (truebid-proposal-data-{id}) - full proposal data
 * 
 * Usage: Call this hook in the proposal workspace layout/page
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
    setSolicitation,
    updateSolicitation,
    setSelectedRoles,
    setSubcontractors,
    setTeamingPartners,
    setEstimateWbsElements,
    setRateJustifications,
    setODCs,
    setPerDiem,
    resetSolicitation,
  } = useAppContext()

  const isInitialLoad = useRef(true)
  const lastSavedRef = useRef<string>('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load proposal data on mount - try API first, fallback to localStorage
  useEffect(() => {
    if (!proposalId) return

    async function loadProposalData() {
      try {
        // Try loading from API first
        const response = await proposalsApi.get(proposalId) as {
          proposal: {
            title?: string
            solicitation?: string
            client?: string
            contractType?: string
            dueDate?: string
            periodOfPerformance?: string
            requirements?: unknown[]
            wbsElements?: unknown[]
          } | null
        }

        if (response.proposal) {
          const proposal = response.proposal

          // Also check localStorage for extended data not in API yet
          const proposalDataKey = `${PROPOSAL_DATA_PREFIX}${proposalId}`
          const storedData = localStorage.getItem(proposalDataKey)
          let localSolicitation: Record<string, unknown> = {}

          if (storedData) {
            try {
              const data = JSON.parse(storedData)
              // Preserve solicitation from localStorage (includes analyzedFromDocument, etc.)
              if (data.solicitation) localSolicitation = data.solicitation
              // Load data that's not yet in the API
              if (data.selectedRoles) setSelectedRoles(data.selectedRoles)
              if (data.subcontractors) setSubcontractors(data.subcontractors)
              if (data.teamingPartners) setTeamingPartners(data.teamingPartners)
              if (data.estimateWbsElements) setEstimateWbsElements(data.estimateWbsElements)
              if (data.rateJustifications) setRateJustifications(data.rateJustifications)
              if (data.odcs) setODCs(data.odcs)
              if (data.perDiem) setPerDiem(data.perDiem)
              console.log('[ProposalSync] Loaded extended data from localStorage')
            } catch (e) {
              console.error('[ProposalSync] Failed to parse localStorage data:', e)
            }
          }

          // Update solicitation - merge API data with localStorage data
          // This preserves fields like analyzedFromDocument, setAside, placeOfPerformance
          updateSolicitation({
            ...localSolicitation,
            title: proposal.title || (localSolicitation.title as string) || '',
            solicitationNumber: proposal.solicitation || (localSolicitation.solicitationNumber as string) || '',
            clientAgency: proposal.client || (localSolicitation.clientAgency as string) || '',
            contractType: mapContractType(proposal.contractType || 'tm'),
            proposalDueDate: proposal.dueDate || (localSolicitation.proposalDueDate as string) || '',
          })

          console.log('[ProposalSync] Loaded proposal from API:', proposalId)
        } else {
          throw new Error('No proposal found in API')
        }
      } catch (error) {
        console.warn('[ProposalSync] Failed to load from API, trying localStorage:', error)

        // Fallback to localStorage
        const proposalDataKey = `${PROPOSAL_DATA_PREFIX}${proposalId}`
        const storedData = localStorage.getItem(proposalDataKey)

        if (storedData) {
          try {
            const data = JSON.parse(storedData)

            // Restore all AppContext state
            if (data.solicitation) setSolicitation(data.solicitation)
            if (data.selectedRoles) setSelectedRoles(data.selectedRoles)
            if (data.subcontractors) setSubcontractors(data.subcontractors)
            if (data.teamingPartners) setTeamingPartners(data.teamingPartners)
            if (data.estimateWbsElements) setEstimateWbsElements(data.estimateWbsElements)
            if (data.rateJustifications) setRateJustifications(data.rateJustifications)
            if (data.odcs) setODCs(data.odcs)
            if (data.perDiem) setPerDiem(data.perDiem)

            console.log('[ProposalSync] Loaded proposal from localStorage:', proposalId)
          } catch (e) {
            console.error('[ProposalSync] Failed to parse proposal data:', e)
          }
        } else {
          // New proposal - reset to defaults
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

    // Cleanup on unmount - don't reset, data is saved
    return () => {
      isInitialLoad.current = true
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [proposalId, setSolicitation, updateSolicitation, setSelectedRoles, setSubcontractors, setTeamingPartners, setEstimateWbsElements, setRateJustifications, setODCs, setPerDiem, resetSolicitation])

  // Save proposal data when AppContext changes (debounced)
  useEffect(() => {
    // Skip during initial load to avoid overwriting with defaults
    if (isInitialLoad.current || !proposalId) return

    const proposalData = {
      solicitation,
      selectedRoles,
      subcontractors,
      teamingPartners,
      estimateWbsElements,
      rateJustifications,
      odcs,
      perDiem,
      lastSaved: new Date().toISOString(),
    }

    // Avoid saving if nothing changed (simple hash check)
    const dataHash = JSON.stringify(proposalData)
    if (dataHash === lastSavedRef.current) return
    lastSavedRef.current = dataHash

    // Save full proposal data to localStorage (for extended data not in API)
    const proposalDataKey = `${PROPOSAL_DATA_PREFIX}${proposalId}`
    localStorage.setItem(proposalDataKey, JSON.stringify(proposalData))

    // Debounce API updates to avoid too many requests
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Update proposal metadata in API
        await proposalsApi.update(proposalId, {
          title: solicitation.title || 'Untitled Proposal',
          solicitation: solicitation.solicitationNumber || '',
          client: solicitation.clientAgency || '',
          totalValue: calculateTotalValue(selectedRoles, subcontractors),
          dueDate: solicitation.proposalDueDate || null,
          teamSize: selectedRoles.length + subcontractors.length,
          contractType: mapContractTypeToDashboard(solicitation.contractType),
          periodOfPerformance: formatPeriodOfPerformance(solicitation.periodOfPerformance),
          progress: calculateProgress(solicitation, selectedRoles, estimateWbsElements),
        })
        console.log('[ProposalSync] Synced proposal to API:', proposalId)
      } catch (error) {
        console.warn('[ProposalSync] Failed to sync to API:', error)
      }
    }, 1000) // Debounce by 1 second

    console.log('[ProposalSync] Saved proposal data locally:', proposalId)
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
  ])
}

// Helper: Calculate total contract value from roles and subs
// NOTE: This is a SIMPLIFIED estimate for dashboard display only.
// It uses baseSalary * FTE * years, without escalation, ODCs, or travel.
// The accurate total is in Roles & Pricing tab (calculations.totalContract).
function calculateTotalValue(
  roles: Array<{ baseSalary: number; fte: number; years: Record<string, boolean> }>,
  subs: Array<{ billedRate: number; fte: number; years: Record<string, boolean> }>
): number {
  const HOURS_PER_YEAR = 1920

  let total = 0

  // Prime labor (simplified - just base salary * FTE * years)
  roles.forEach(role => {
    const activeYears = Object.values(role.years).filter(Boolean).length
    total += role.baseSalary * role.fte * activeYears
  })

  // Subcontractors
  subs.forEach(sub => {
    const activeYears = Object.values(sub.years).filter(Boolean).length
    total += sub.billedRate * HOURS_PER_YEAR * sub.fte * activeYears
  })

  return total
}

// Helper: Format period of performance for display
function formatPeriodOfPerformance(pop: { baseYear: boolean; optionYears: number }): string {
  if (pop.baseYear && pop.optionYears > 0) {
    return `1 Base + ${pop.optionYears} OY${pop.optionYears > 1 ? 's' : ''}`
  }
  if (pop.baseYear) {
    return '1 Base Year'
  }
  if (pop.optionYears > 0) {
    return `${pop.optionYears} Option Year${pop.optionYears > 1 ? 's' : ''}`
  }
  return ''
}

// Helper: Calculate rough progress percentage
function calculateProgress(
  solicitation: { title?: string; clientAgency?: string; solicitationNumber?: string },
  roles: unknown[],
  wbsElements: unknown[]
): number {
  let progress = 0
  
  // Has basic info (30%)
  if (solicitation.title || solicitation.solicitationNumber) progress += 15
  if (solicitation.clientAgency) progress += 15
  
  // Has roles (40%)
  if (roles.length > 0) progress += 40
  
  // Has estimates (30%)
  if (wbsElements.length > 0) progress += 30
  
  return Math.min(progress, 100)
}

export default useProposalSync