'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PricingScenarioStatus } from '@/lib/commands'

export interface PricingScenarioSummary {
  id: string
  proposalId: string
  wbsVersionId: string
  label: string
  status: PricingScenarioStatus
  engineVersion: string
  computedAt: string
  totalCost: number
  lineCount: number
  isStale: boolean
}

interface PricingScenariosResponse {
  scenarios: PricingScenarioSummary[]
  approved: PricingScenarioSummary | null
  hasConfirmedIntelligence: boolean
  hasActiveWBS: boolean
}

interface ComputeScenarioResponse {
  scenario: {
    id: string
    label: string
    engineVersion: string
    totalCost: number
    lineCount: number
    needsUtilizationBackfill: boolean
    computedAt: string
  }
}

interface ApproveScenarioResponse {
  approved: boolean
  scenarioId: string
  supersededId: string | null
  newRowVersion: number
}

/**
 * Hook for fetching and managing pricing scenarios for a proposal.
 */
export function usePricingScenarios(proposalId: string) {
  const [scenarios, setScenarios] = useState<PricingScenarioSummary[]>([])
  const [approved, setApproved] = useState<PricingScenarioSummary | null>(null)
  const [hasConfirmedIntelligence, setHasConfirmedIntelligence] = useState(false)
  const [hasActiveWBS, setHasActiveWBS] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchScenarios = useCallback(async () => {
    if (!proposalId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/pricing`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch scenarios')
      }

      const data: PricingScenariosResponse = await response.json()
      setScenarios(data.scenarios)
      setApproved(data.approved)
      setHasConfirmedIntelligence(data.hasConfirmedIntelligence)
      setHasActiveWBS(data.hasActiveWBS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scenarios')
    } finally {
      setIsLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  const computeScenario = useCallback(
    async (label?: string): Promise<ComputeScenarioResponse['scenario'] | null> => {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/pricing/compute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to compute scenario')
        }

        const data: ComputeScenarioResponse = await response.json()
        // Refetch scenarios to get updated list
        await fetchScenarios()
        return data.scenario
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to compute scenario')
        return null
      }
    },
    [proposalId, fetchScenarios]
  )

  const approveScenario = useCallback(
    async (scenarioId: string, expectedVersion?: number): Promise<ApproveScenarioResponse | null> => {
      try {
        const response = await fetch(
          `/api/proposals/${proposalId}/pricing/${scenarioId}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedVersion }),
          }
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to approve scenario')
        }

        const data: ApproveScenarioResponse = await response.json()
        // Refetch scenarios to get updated statuses
        await fetchScenarios()
        return data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve scenario')
        return null
      }
    },
    [proposalId, fetchScenarios]
  )

  return {
    scenarios,
    approved,
    hasConfirmedIntelligence,
    hasActiveWBS,
    isLoading,
    error,
    refetch: fetchScenarios,
    computeScenario,
    approveScenario,
  }
}

export default usePricingScenarios
