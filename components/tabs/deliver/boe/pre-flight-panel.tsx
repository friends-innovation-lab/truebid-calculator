'use client'

import { GateChecklist, GateCondition } from '@/components/shared/gate-checklist'
import type { BOEPreconditions } from '@/hooks/use-boe-artifacts'

interface PreFlightPanelProps {
  preconditions: BOEPreconditions
  onGenerate: () => void
  isGenerating: boolean
  onNavigate: (viewId: string) => void
}

/**
 * Pre-flight panel for BOE generation.
 * Shows the four gate conditions and Generate button.
 */
export function PreFlightPanel({
  preconditions,
  onGenerate,
  isGenerating,
  onNavigate,
}: PreFlightPanelProps) {
  const conditions: GateCondition[] = [
    {
      label: 'Intelligence confirmed',
      met: preconditions.intelligenceConfirmed,
      detail: preconditions.intelligenceConfirmed
        ? 'Contract intelligence has been confirmed'
        : 'Contract intelligence must be confirmed before generating BOE',
      fixHref: preconditions.intelligenceConfirmed
        ? undefined
        : `?view=solicitation`,
    },
    {
      label: 'WBS active',
      met: preconditions.wbsActive,
      detail: preconditions.wbsActive
        ? 'Work breakdown structure is active'
        : 'An active WBS is required for generation',
      fixHref: preconditions.wbsActive ? undefined : `?view=wbs-elements`,
    },
    {
      label: 'Scenario approved',
      met: preconditions.scenarioApproved,
      detail: preconditions.scenarioApproved
        ? 'A pricing scenario has been approved'
        : 'A pricing scenario must be approved before generating BOE',
      fixHref: preconditions.scenarioApproved ? undefined : `?view=pricing`,
    },
    {
      label: 'All estimate lines cited',
      met: preconditions.citationCoverage.allCited,
      detail: preconditions.citationCoverage.allCited
        ? `All ${preconditions.citationCoverage.total} lines have requirement citations`
        : `${preconditions.citationCoverage.cited} of ${preconditions.citationCoverage.total} lines have citations`,
      fixHref: preconditions.citationCoverage.allCited
        ? undefined
        : `?view=wbs-elements`,
    },
  ]

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Pre-flight Check</h3>
        <p className="text-xs text-muted-foreground mt-1">
          All conditions must be met before generating a BOE artifact
        </p>
      </div>
      <GateChecklist
        conditions={conditions}
        actionLabel="Generate BOE"
        onAction={onGenerate}
        loading={isGenerating}
      />
    </div>
  )
}
