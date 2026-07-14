'use client'

import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { PricingScenarioSummary } from '@/hooks/use-pricing-scenarios'
import { Clock, AlertTriangle } from 'lucide-react'

interface ScenarioListProps {
  scenarios: PricingScenarioSummary[]
  selectedId: string | null
  onSelect: (scenarioId: string) => void
}

/**
 * List of scenarios with status badges.
 * Click to select a scenario for detail view.
 */
export function ScenarioList({
  scenarios,
  selectedId,
  onSelect,
}: ScenarioListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Sort: approved first, then by computedAt descending
  const sortedScenarios = [...scenarios].sort((a, b) => {
    if (a.status === 'approved' && b.status !== 'approved') return -1
    if (b.status === 'approved' && a.status !== 'approved') return 1
    return new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
  })

  return (
    <Card className="p-0 divide-y">
      {sortedScenarios.map((scenario) => (
        <button
          key={scenario.id}
          onClick={() => onSelect(scenario.id)}
          className={cn(
            'w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors',
            selectedId === scenario.id && 'bg-blue-50 hover:bg-blue-50'
          )}
          data-testid="scenario-card"
          data-status={scenario.status}
        >
          {/* Label and status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{scenario.label}</span>
              <StatusBadge status={scenario.status} />
              {scenario.isStale && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  Stale
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDate(scenario.computedAt)}</span>
              <span>•</span>
              <span>{scenario.lineCount} lines</span>
            </div>
          </div>

          {/* Total */}
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(scenario.totalCost)}
            </p>
            <p className="text-xs text-muted-foreground">
              {scenario.engineVersion}
            </p>
          </div>
        </button>
      ))}
    </Card>
  )
}

export default ScenarioList
