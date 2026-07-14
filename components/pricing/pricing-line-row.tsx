'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CalcTracePanel } from '@/components/shared/calc-trace-panel'
import { cn } from '@/lib/utils'
import type { PricingLine } from '@/hooks/use-pricing-lines'
import type { RateConfigSnapshot } from '@/lib/commands'

interface PricingLineRowProps {
  line: PricingLine
  rateConfig: RateConfigSnapshot | null
  variant?: 'approved' | 'preview'
}

/**
 * Single pricing line row with expandable calculation trace.
 */
export function PricingLineRow({
  line,
  rateConfig,
  variant = 'approved',
}: PricingLineRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Get line description
  const getLineDescription = () => {
    if (line.lineType === 'labor_loading') {
      return line.utilizationProvenance?.sourceText || 'Labor loading line'
    }
    return `WBS estimate • ${line.salarySource === 'override' ? 'Override' : 'Catalog'} salary`
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0" data-testid="pricing-line-row">
      {/* Row header - clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Expand/collapse icon */}
        <span className="text-gray-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        {/* Period */}
        <span className="w-24 text-sm font-medium text-gray-900 truncate">
          {line.periodLabel}
        </span>

        {/* Line type badge */}
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded',
            line.lineType === 'labor_loading'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          )}
        >
          {line.lineType === 'labor_loading' ? 'Loading' : 'WBS'}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm text-muted-foreground truncate">
          {getLineDescription()}
        </span>

        {/* Hours */}
        <span className="w-20 text-sm tabular-nums text-right" data-testid="line-hours">
          {formatNumber(line.hours)} hrs
        </span>

        {/* Bill Rate */}
        <span className="w-24 text-sm tabular-nums text-right" data-testid="line-bill-rate">
          {formatCurrency(line.fullyBurdened)}
        </span>

        {/* Extended Cost */}
        <span className="w-28 text-sm font-medium tabular-nums text-right" data-testid="line-extended-cost">
          {formatCurrency(line.extendedCost)}
        </span>
      </button>

      {/* Expanded trace panel */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-7">
            <CalcTracePanel
              resolvedSalaryCents={line.resolvedSalaryCents}
              baseHourly={line.baseHourly}
              fringeAmount={line.fringeAmount}
              overheadBase={line.overheadBase}
              overheadAmount={line.overheadAmount}
              gaAmount={line.gaAmount}
              costBeforeProfit={line.costBeforeProfit}
              profitRate={line.profitRate}
              profitAmount={line.profitAmount}
              fullyBurdened={line.fullyBurdened}
              rates={rateConfig ? {
                fringe: rateConfig.fringe,
                overhead: rateConfig.overhead,
                ga: rateConfig.ga,
              } : undefined}
              variant={variant}
            />

            {/* Extended cost calculation */}
            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatNumber(line.hours)} hours × {formatCurrency(line.fullyBurdened)}/hr
                </span>
                <span className="font-semibold tabular-nums">
                  = {formatCurrency(line.extendedCost)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PricingLineRow
