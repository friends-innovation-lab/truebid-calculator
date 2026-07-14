'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PeriodTotal {
  periodLabel: string
  hours: number
  extendedCost: number
}

interface SummaryHeaderProps {
  /** Total contract value */
  total: number
  /** Per-period breakdown */
  periodTotals: PeriodTotal[]
  /** Approval timestamp (ISO string) */
  approvedAt?: string
  /** Name of person who approved */
  approvedBy?: string
  /** Optional className */
  className?: string
}

/**
 * Summary header component (Keeper #5).
 *
 * Renders headline total + per-period columns from approved scenario lines only.
 * This component reads exclusively from the approved scenario's pricing_lines.
 */
export function SummaryHeader({
  total,
  periodTotals,
  approvedAt,
  approvedBy,
  className,
}: SummaryHeaderProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <Card className={cn('p-6', className)} data-testid="summary-header">
      {/* Headline total */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Contract Total</p>
          <p className="text-3xl font-bold tabular-nums">{formatCurrency(total)}</p>
        </div>

        {/* Approval signature */}
        {approvedAt && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                APPROVED
              </span>
            </div>
            {approvedBy && (
              <p className="text-sm text-muted-foreground mt-1">by {approvedBy}</p>
            )}
            <p className="text-xs text-muted-foreground">{formatDate(approvedAt)}</p>
          </div>
        )}
      </div>

      {/* Period breakdown */}
      {periodTotals.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">By Period</p>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(periodTotals.length, 5)}, 1fr)` }}>
            {periodTotals.map((period) => (
              <div key={period.periodLabel} className="text-center">
                <p className="text-xs text-muted-foreground truncate" title={period.periodLabel}>
                  {period.periodLabel}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(period.extendedCost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(period.hours)} hrs
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default SummaryHeader
