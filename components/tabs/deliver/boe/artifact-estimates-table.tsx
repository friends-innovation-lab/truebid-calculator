'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalcTracePanel } from '@/components/shared/calc-trace-panel'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { ArtifactEstimateLine, ArtifactRateConfig } from '@/lib/schemas/boe-artifact'
import type { BOECitation } from '@/hooks/use-boe-artifacts'

interface ArtifactEstimatesTableProps {
  lines: ArtifactEstimateLine[]
  rateConfig: ArtifactRateConfig
  citations: BOECitation[]
  title: string
  onCitationClick?: (requirementLinkId: string) => void
}

/**
 * Estimates table for artifact viewer.
 * Renders WBS estimates or labor loading lines with expandable calc traces.
 */
export function ArtifactEstimatesTable({
  lines,
  rateConfig,
  citations,
  title,
  onCitationClick,
}: ArtifactEstimatesTableProps) {
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number, decimals = 1) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  // Build citation lookup
  const citationsByLine = new Map<string, string[]>()
  for (const c of citations) {
    const existing = citationsByLine.get(c.artifactLineId) || []
    existing.push(c.requirementLinkId)
    citationsByLine.set(c.artifactLineId, existing)
  }

  if (lines.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">No lines in this section</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lines.length} line{lines.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="w-8"></th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">
                WBS
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">
                Task
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">
                Role
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">
                Period
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">
                Hours
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">
                Rate
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">
                Cost
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">
                Fee
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">
                Total
              </th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">
                Cited
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const isExpanded = expandedLineId === line.lineId
              const lineCitations = citationsByLine.get(line.lineId) || []

              return (
                <>
                  <tr
                    key={line.lineId}
                    className={`
                      border-b cursor-pointer hover:bg-gray-50
                      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                      ${isExpanded ? 'bg-blue-50' : ''}
                    `}
                    onClick={() =>
                      setExpandedLineId(isExpanded ? null : line.lineId)
                    }
                  >
                    <td className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedLineId(isExpanded ? null : line.lineId)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {line.wbsCode || '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-900 max-w-[200px] truncate">
                      {line.taskTitle || '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{line.roleTitle}</td>
                    <td className="py-2 px-3 text-gray-600">{line.periodLabel}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatNumber(line.hours)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatCurrency(line.calcTrace.fullyBurdenedRate)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatCurrency(line.costComponent)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {formatCurrency(line.feeComponent)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">
                      {formatCurrency(line.extendedTotal)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {lineCitations.length > 0 ? (
                        <button
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onCitationClick && lineCitations[0]) {
                              onCitationClick(lineCitations[0])
                            }
                          }}
                        >
                          <FileText className="w-3 h-3" />
                          {lineCitations.length}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${line.lineId}-trace`}>
                      <td colSpan={11} className="p-4 bg-blue-50/50">
                        <div className="max-w-md">
                          <CalcTracePanel
                            resolvedSalaryCents={line.calcTrace.resolvedSalaryCents}
                            baseHourly={line.calcTrace.baseHourly}
                            fringeAmount={line.calcTrace.fringeAmount}
                            overheadBase={line.calcTrace.overheadBase}
                            overheadAmount={line.calcTrace.overheadAmount}
                            gaAmount={line.calcTrace.gaAmount}
                            costBeforeProfit={line.calcTrace.costBeforeProfit}
                            profitRate={line.calcTrace.profitRate}
                            profitAmount={line.calcTrace.profitAmount}
                            fullyBurdened={line.calcTrace.fullyBurdenedRate}
                            rates={{
                              fringe: rateConfig.fringe,
                              overhead: rateConfig.overhead,
                              ga: rateConfig.ga,
                            }}
                            variant="approved"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
