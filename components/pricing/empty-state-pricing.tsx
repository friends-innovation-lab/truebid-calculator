'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calculator, FileText, Layers, Loader2 } from 'lucide-react'

interface EmptyStatePricingProps {
  /** Whether confirmed intelligence exists */
  hasConfirmedIntelligence: boolean
  /** Whether active WBS exists */
  hasActiveWBS: boolean
  /** Handler to navigate to Scope */
  onNavigateToScope: () => void
  /** Handler to navigate to WBS */
  onNavigateToWBS: () => void
  /** Handler to create scenario (only enabled if prerequisites met) */
  onCreateScenario: () => void
  /** Whether scenario creation is in progress */
  isCreating?: boolean
}

/**
 * Empty state for Scenario & Pricing screen (State 1).
 *
 * Per spec:
 * - If !hasConfirmedIntelligence → disabled, link to Scope
 * - If !hasActiveWBS → disabled, link to WBS
 * - If both met → "Create Scenario" button
 */
export function EmptyStatePricing({
  hasConfirmedIntelligence,
  hasActiveWBS,
  onNavigateToScope,
  onNavigateToWBS,
  onCreateScenario,
  isCreating = false,
}: EmptyStatePricingProps) {
  const canCreateScenario = hasConfirmedIntelligence && hasActiveWBS

  return (
    <Card className="p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Calculator className="w-6 h-6 text-gray-400" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No Pricing Scenario
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        {canCreateScenario
          ? 'Create a pricing scenario to calculate bill rates and contract totals from your confirmed intelligence and WBS.'
          : 'Complete the prerequisites below to create a pricing scenario.'}
      </p>

      {/* Prerequisites */}
      {!canCreateScenario && (
        <div className="space-y-3 mb-6 max-w-sm mx-auto text-left">
          {/* Intelligence prerequisite */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              hasConfirmedIntelligence
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <FileText
              className={`w-5 h-5 ${
                hasConfirmedIntelligence ? 'text-green-600' : 'text-amber-600'
              }`}
            />
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  hasConfirmedIntelligence ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {hasConfirmedIntelligence
                  ? 'Intelligence confirmed'
                  : 'Confirm intelligence in Scope'}
              </p>
            </div>
            {!hasConfirmedIntelligence && (
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 h-auto"
                onClick={onNavigateToScope}
              >
                Go to Scope
              </Button>
            )}
          </div>

          {/* WBS prerequisite */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              hasActiveWBS
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <Layers
              className={`w-5 h-5 ${
                hasActiveWBS ? 'text-green-600' : 'text-amber-600'
              }`}
            />
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  hasActiveWBS ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {hasActiveWBS ? 'WBS active' : 'Create WBS in Scope of Work'}
              </p>
            </div>
            {!hasActiveWBS && (
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 h-auto"
                onClick={onNavigateToWBS}
              >
                Go to WBS
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Create button */}
      <Button
        onClick={onCreateScenario}
        disabled={!canCreateScenario || isCreating}
        size="lg"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Computing Scenario...
          </>
        ) : (
          'Create Scenario'
        )}
      </Button>
    </Card>
  )
}

export default EmptyStatePricing
