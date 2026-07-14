'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CalcTracePanelProps {
  /** Annual salary (resolved from line trace: baseHourly × 2080) */
  resolvedSalaryCents: number
  /** Base hourly rate (salary / 2080) */
  baseHourly: number
  /** Fringe amount (hourly) */
  fringeAmount: number
  /** Overhead base (base + fringe) */
  overheadBase: number
  /** Overhead amount (hourly) */
  overheadAmount: number
  /** G&A amount (hourly) */
  gaAmount: number
  /** Cost before profit (hourly) */
  costBeforeProfit: number
  /** Profit rate (decimal, e.g., 0.10) */
  profitRate: number
  /** Profit amount (hourly) */
  profitAmount: number
  /** Fully burdened rate (final bill rate) */
  fullyBurdened: number
  /** Rate config for labels */
  rates?: {
    fringe?: number
    overhead?: number
    ga?: number
  }
  /** Variant: approved (solid) or preview (dashed with warning) */
  variant?: 'approved' | 'preview'
  /** Optional className */
  className?: string
}

/**
 * Bill rate calculation trace panel (Keeper #1).
 *
 * Renders the cascade in ANNUAL amounts through loaded cost,
 * then ÷2,080 at the transition to hourly, per wireframe spec.
 *
 * The stored trace is hourly; we multiply by 2080 for annual display.
 */
export function CalcTracePanel({
  resolvedSalaryCents,
  // baseHourly not destructured - annual format derives from resolvedSalaryCents
  fringeAmount,
  overheadBase,
  overheadAmount,
  gaAmount,
  costBeforeProfit,
  profitRate,
  profitAmount,
  fullyBurdened,
  rates,
  variant = 'approved',
  className,
}: CalcTracePanelProps) {
  // Convert hourly amounts to annual for display (through loaded cost)
  const annualSalary = resolvedSalaryCents / 100
  const annualFringe = fringeAmount * 2080
  const annualAfterFringe = overheadBase * 2080
  const annualOverhead = overheadAmount * 2080
  const annualAfterOverhead = (overheadBase + overheadAmount) * 2080
  const annualGA = gaAmount * 2080
  const annualLoadedCost = costBeforeProfit * 2080

  // Format helpers
  const formatCurrency = (value: number, showCents = true) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(value)
  }

  const formatRate = (rate: number) => `${(rate * 100).toFixed(2)}%`

  const isPreview = variant === 'preview'

  return (
    <Card
      className={cn(
        'p-4 font-mono text-sm',
        isPreview && 'border-dashed border-amber-400 bg-amber-50/30',
        className
      )}
    >
      {/* Preview warning banner */}
      {isPreview && (
        <div className="text-xs text-amber-700 font-semibold mb-3 pb-2 border-b border-amber-200">
          PREVIEW — NOT AN APPROVED PRICE
        </div>
      )}

      {/* Annual section */}
      <div className="space-y-1">
        {/* Base Salary */}
        <Row
          label="Base Salary"
          value={formatCurrency(annualSalary, false)}
          suffix="/yr"
        />

        {/* Fringe */}
        <Row
          label={`+ Fringe ${rates?.fringe ? `(${formatRate(rates.fringe)})` : ''}`}
          value={formatCurrency(annualFringe, false)}
          isAddition
        />

        <Divider />

        {/* After Fringe */}
        <Row
          label="After Fringe"
          value={formatCurrency(annualAfterFringe, false)}
          isBold
        />

        {/* Overhead */}
        <Row
          label={`+ Overhead ${rates?.overhead ? `(${formatRate(rates.overhead)})` : ''}`}
          value={formatCurrency(annualOverhead, false)}
          isAddition
        />

        <Divider />

        {/* After Overhead */}
        <Row
          label="After Overhead"
          value={formatCurrency(annualAfterOverhead, false)}
          isBold
        />

        {/* G&A */}
        <Row
          label={`+ G&A ${rates?.ga ? `(${formatRate(rates.ga)})` : ''}`}
          value={formatCurrency(annualGA, false)}
          isAddition
        />

        <Divider type="double" />

        {/* Loaded Cost (Annual) */}
        <Row
          label="Loaded Cost"
          value={formatCurrency(annualLoadedCost, false)}
          suffix="/yr"
          isBold
        />

        {/* Division line */}
        <Row
          label="÷ 2,080 hrs"
          value=""
          isDivider
        />

        <Divider />

        {/* Cost per Hour */}
        <Row
          label="Cost per Hour"
          value={formatCurrency(costBeforeProfit)}
          isBold
        />

        {/* Profit */}
        <Row
          label={`+ Profit (${formatRate(profitRate)})`}
          value={formatCurrency(profitAmount)}
          isAddition
        />

        <Divider type="double" />

        {/* Bill Rate */}
        <Row
          label="Bill Rate"
          value={formatCurrency(fullyBurdened)}
          suffix="/hr"
          isBold
          isTotal
        />
      </div>
    </Card>
  )
}

// Helper components
function Row({
  label,
  value,
  suffix,
  isAddition,
  isBold,
  isTotal,
  isDivider,
}: {
  label: string
  value: string
  suffix?: string
  isAddition?: boolean
  isBold?: boolean
  isTotal?: boolean
  isDivider?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between items-center py-0.5',
        isAddition && 'text-muted-foreground',
        isBold && 'font-semibold',
        isTotal && 'text-base',
        isDivider && 'text-muted-foreground'
      )}
    >
      <span className={cn(isAddition && 'pl-2')}>{label}</span>
      <span className="tabular-nums">
        {value}
        {suffix && <span className="text-muted-foreground text-xs ml-0.5">{suffix}</span>}
      </span>
    </div>
  )
}

function Divider({ type = 'single' }: { type?: 'single' | 'double' }) {
  return (
    <div
      className={cn(
        'border-t my-1',
        type === 'double' ? 'border-t-2 border-gray-400' : 'border-gray-200'
      )}
    />
  )
}

export default CalcTracePanel
