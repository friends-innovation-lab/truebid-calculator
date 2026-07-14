'use client'

import { Card } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ArtifactTotals, ArtifactConservation } from '@/lib/schemas/boe-artifact'

interface ArtifactTotalsSummaryProps {
  totals: ArtifactTotals
  conservation: ArtifactConservation
}

/**
 * Totals summary for artifact viewer.
 * Shows grand totals and conservation assertions.
 */
export function ArtifactTotalsSummary({
  totals,
  conservation,
}: ArtifactTotalsSummaryProps) {
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
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Totals Summary</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WBS Estimates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">WBS Estimates</span>
            {conservation.wbsEstimateConserved ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Hours</p>
              <p className="tabular-nums">{formatNumber(totals.wbsEstimateHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="tabular-nums font-medium">
                {formatCurrency(totals.wbsEstimateTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="tabular-nums">{formatCurrency(totals.wbsEstimateCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee</p>
              <p className="tabular-nums">{formatCurrency(totals.wbsEstimateFee)}</p>
            </div>
          </div>
        </div>

        {/* Labor Loading */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Labor Loading</span>
            {conservation.laborLoadingConserved ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Hours</p>
              <p className="tabular-nums">{formatNumber(totals.laborLoadingHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="tabular-nums font-medium">
                {formatCurrency(totals.laborLoadingTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="tabular-nums">{formatCurrency(totals.laborLoadingCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee</p>
              <p className="tabular-nums">{formatCurrency(totals.laborLoadingFee)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grand Totals */}
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-900">Grand Total</span>
          {conservation.allConserved ? (
            <div className="flex items-center gap-1 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">All conserved</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Conservation check failed</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Hours</p>
            <p className="text-lg tabular-nums font-semibold">
              {formatNumber(totals.grandTotalHours)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-lg tabular-nums font-semibold">
              {formatCurrency(totals.grandTotalCost)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fee</p>
            <p className="text-lg tabular-nums font-semibold">
              {formatCurrency(totals.grandTotalFee)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="text-lg tabular-nums font-bold text-gray-900">
              {formatCurrency(totals.grandTotal)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
