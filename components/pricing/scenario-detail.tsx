'use client'

import { Card } from '@/components/ui/card'
import { PricingLineRow } from './pricing-line-row'
import { SummaryHeader } from '@/components/shared/summary-header'
import { GateChecklist } from '@/components/shared/gate-checklist'
import { StatusBadge } from '@/components/shared/status-badge'
import { StalenessNotice } from './staleness-notice'
import { usePricingLines } from '@/hooks/use-pricing-lines'
import type { PricingScenarioSummary } from '@/hooks/use-pricing-scenarios'
import type { RateConfigSnapshot } from '@/lib/commands'
import { Loader2 } from 'lucide-react'

interface ScenarioDetailProps {
  scenario: PricingScenarioSummary
  proposalId: string
  rateConfigSnapshot?: RateConfigSnapshot
  approvedBy?: string | null
  onApprove: () => void
  onCreateNewScenario: () => void
  isApproving: boolean
  isCreating: boolean
}

/**
 * Scenario detail view showing lines table, summary, and approval gate.
 */
export function ScenarioDetail({
  scenario,
  proposalId,
  rateConfigSnapshot,
  approvedBy,
  onApprove,
  onCreateNewScenario,
  isApproving,
  isCreating,
}: ScenarioDetailProps) {
  const {
    lines,
    totals,
    rateConfig,
    engineFlags,
    isLoading,
    error,
    verifyConservation,
  } = usePricingLines(proposalId, scenario.id)

  // Determine if conservation check passes
  const conservationPasses = verifyConservation()

  // Gate conditions for approval
  const gateConditions = [
    {
      label: 'Conservation check passes',
      met: conservationPasses,
      detail: conservationPasses
        ? 'Sum of lines equals scenario total'
        : 'Sum of lines does not match scenario total',
    },
    {
      label: 'No unresolved engine flags',
      met: !engineFlags?.needsUtilizationBackfill,
      detail: engineFlags?.needsUtilizationBackfill
        ? 'Some lines are missing utilization data'
        : 'All lines have required data',
      fixHref: engineFlags?.needsUtilizationBackfill ? '?view=requirements' : undefined,
    },
  ]

  const isApproved = scenario.status === 'approved'
  const isDraft = scenario.status === 'draft'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-muted-foreground">Loading lines...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    )
  }

  const effectiveRateConfig = rateConfig || rateConfigSnapshot

  return (
    <div className="space-y-6">
      {/* Staleness notice */}
      {scenario.isStale && (
        <StalenessNotice
          onCreateNewScenario={onCreateNewScenario}
          isCreating={isCreating}
        />
      )}

      {/* Summary header (only for approved scenarios) */}
      {isApproved && totals && (
        <SummaryHeader
          total={totals.total}
          periodTotals={totals.periodTotals}
          approvedAt={scenario.computedAt}
          approvedBy={approvedBy || undefined}
        />
      )}

      {/* Scenario info card */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{scenario.label}</h3>
            <StatusBadge status={scenario.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            Engine: {scenario.engineVersion}
          </div>
        </div>

        {/* Rate config snapshot */}
        {effectiveRateConfig && (
          <div className="flex gap-4 text-sm text-muted-foreground border-t pt-3">
            <span>
              Fringe: {(effectiveRateConfig.fringe * 100).toFixed(2)}%
            </span>
            <span>
              Overhead: {(effectiveRateConfig.overhead * 100).toFixed(2)}%
            </span>
            <span>
              G&A: {(effectiveRateConfig.ga * 100).toFixed(2)}%
            </span>
            <span>
              Profit: {(effectiveRateConfig.defaultProfitRate * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </Card>

      {/* Lines table */}
      <Card className="p-0 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span className="w-4" /> {/* Expand icon space */}
          <span className="w-24">Period</span>
          <span className="w-16">Type</span>
          <span className="flex-1">Description</span>
          <span className="w-20 text-right">Hours</span>
          <span className="w-24 text-right">Bill Rate</span>
          <span className="w-28 text-right">Extended</span>
        </div>

        {/* Lines */}
        {lines.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No pricing lines in this scenario
          </div>
        ) : (
          lines.map((line) => (
            <PricingLineRow
              key={line.id}
              line={line}
              rateConfig={effectiveRateConfig ?? null}
              variant={isApproved ? 'approved' : 'preview'}
            />
          ))
        )}

        {/* Totals row */}
        {totals && (
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-t font-semibold">
            <span className="w-4" />
            <span className="flex-1">Total ({totals.lineCount} lines)</span>
            <span className="w-20 text-right tabular-nums">
              {new Intl.NumberFormat('en-US').format(totals.totalHours)} hrs
            </span>
            <span className="w-24" />
            <span className="w-28 text-right tabular-nums">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(totals.total)}
            </span>
          </div>
        )}
      </Card>

      {/* Approval gate (only for draft scenarios) */}
      {isDraft && !scenario.isStale && (
        <GateChecklist
          conditions={gateConditions}
          actionLabel="Approve"
          onAction={onApprove}
          loading={isApproving}
        />
      )}
    </div>
  )
}

export default ScenarioDetail
