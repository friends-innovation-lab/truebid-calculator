'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { usePricingScenarios } from '@/hooks/use-pricing-scenarios'
import { EmptyStatePricing } from './empty-state-pricing'
import { ScenarioList } from './scenario-list'
import { ScenarioDetail } from './scenario-detail'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import type { RateConfigSnapshot } from '@/lib/commands'

interface ScenarioDetailData {
  approvedBy: string | null
  rateConfig: RateConfigSnapshot | null
}

/**
 * Main Scenario & Pricing page component.
 *
 * Orchestrates the 6 states:
 * 1. Empty/No Scenario
 * 2. Draft Scenario
 * 3. Approve Gate
 * 4. Approved Scenario
 * 5. Staleness
 * 6. Multiple Scenarios
 */
export function ScenarioPricingPage() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    scenarios,
    approved,
    hasConfirmedIntelligence,
    hasActiveWBS,
    isLoading,
    error,
    refetch,
    computeScenario,
    approveScenario,
  } = usePricingScenarios(proposalId)

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [scenarioDetail, setScenarioDetail] = useState<ScenarioDetailData>({
    approvedBy: null,
    rateConfig: null,
  })

  // Select approved scenario by default, or first draft
  useEffect(() => {
    if (!selectedScenarioId && scenarios.length > 0) {
      const toSelect = approved?.id || scenarios[0]?.id
      if (toSelect) {
        setSelectedScenarioId(toSelect)
      }
    }
  }, [scenarios, approved, selectedScenarioId])

  // Load scenario detail when selection changes
  useEffect(() => {
    async function loadDetail() {
      if (!selectedScenarioId) return

      try {
        const response = await fetch(
          `/api/proposals/${proposalId}/pricing/${selectedScenarioId}`
        )
        if (response.ok) {
          const data = await response.json()
          setScenarioDetail({
            approvedBy: data.scenario.approvedBy,
            rateConfig: data.scenario.rateConfig,
          })
        }
      } catch {
        // Silently fail - the detail component will load its own data
      }
    }
    loadDetail()
  }, [proposalId, selectedScenarioId])

  const handleNavigateToScope = useCallback(() => {
    // Navigate to solicitation view
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'requirements')
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const handleNavigateToWBS = useCallback(() => {
    // Navigate to WBS view
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'wbs-elements')
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const handleCreateScenario = useCallback(async () => {
    setIsCreating(true)
    try {
      const result = await computeScenario()
      if (result) {
        setSelectedScenarioId(result.id)
      }
    } finally {
      setIsCreating(false)
    }
  }, [computeScenario])

  const handleApproveScenario = useCallback(async () => {
    if (!selectedScenarioId) return

    setIsApproving(true)
    try {
      await approveScenario(selectedScenarioId)
    } finally {
      setIsApproving(false)
    }
  }, [selectedScenarioId, approveScenario])

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-muted-foreground">Loading scenarios...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <Button variant="link" onClick={refetch} className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // State 1: Empty/No Scenario
  if (scenarios.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyStatePricing
          hasConfirmedIntelligence={hasConfirmedIntelligence}
          hasActiveWBS={hasActiveWBS}
          onNavigateToScope={handleNavigateToScope}
          onNavigateToWBS={handleNavigateToWBS}
          onCreateScenario={handleCreateScenario}
          isCreating={isCreating}
        />
      </div>
    )
  }

  // States 2-6: One or more scenarios exist
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Scenario & Pricing</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
              {approved && ' • 1 approved'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleCreateScenario}
              disabled={isCreating || !hasConfirmedIntelligence || !hasActiveWBS}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  New Scenario
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Two-column layout for multiple scenarios */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scenario list (sidebar) */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Scenarios
            </h2>
            <ScenarioList
              scenarios={scenarios}
              selectedId={selectedScenarioId}
              onSelect={setSelectedScenarioId}
            />
          </div>

          {/* Selected scenario detail */}
          <div className="lg:col-span-2">
            {selectedScenario ? (
              <ScenarioDetail
                scenario={selectedScenario}
                proposalId={proposalId}
                rateConfigSnapshot={scenarioDetail.rateConfig || undefined}
                approvedBy={scenarioDetail.approvedBy}
                onApprove={handleApproveScenario}
                onCreateNewScenario={handleCreateScenario}
                isApproving={isApproving}
                isCreating={isCreating}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Select a scenario to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioPricingPage
