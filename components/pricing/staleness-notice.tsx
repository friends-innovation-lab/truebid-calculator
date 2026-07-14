'use client'

import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StalenessNoticeProps {
  /** Handler to create a new scenario */
  onCreateNewScenario: () => void
  /** Whether scenario creation is in progress */
  isCreating?: boolean
}

/**
 * Staleness notice (State 5).
 *
 * Per spec:
 * - "Intelligence was superseded after this scenario was approved"
 * - "Create new scenario" button
 * - No auto-recompute
 */
export function StalenessNotice({
  onCreateNewScenario,
  isCreating = false,
}: StalenessNoticeProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4" data-testid="staleness-notice">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">
          Intelligence was superseded after this scenario was approved
        </p>
        <p className="text-sm text-amber-700 mt-1">
          The underlying data has changed. Create a new scenario to reflect the current state.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onCreateNewScenario}
        disabled={isCreating}
        className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Computing...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-1" />
            Create New Scenario
          </>
        )}
      </Button>
    </div>
  )
}

export default StalenessNotice
