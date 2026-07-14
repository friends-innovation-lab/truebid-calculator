'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  PricingLineType,
  SalarySource,
  ProfitSource,
  RateConfigSnapshot,
} from '@/lib/commands'

export interface UtilizationProvenance {
  utilizationPct: number
  periodMonths: number
  sourceText: string
}

export interface PricingLine {
  id: string
  lineType: PricingLineType
  staffingAssignmentId: string | null
  intelligenceLaborRequirementId: string | null
  intelligencePeriodId: string | null
  periodLabel: string
  hours: number
  resolvedSalaryCents: number
  salarySource: SalarySource
  levelKey: string | null
  stepIndex: number | null
  baseHourly: number
  fringeAmount: number
  overheadBase: number
  overheadAmount: number
  gaAmount: number
  costBeforeProfit: number
  profitRate: number
  profitSource: ProfitSource
  profitAmount: number
  fullyBurdened: number
  escalationRateApplied: number | null
  escalationYearIndex: number | null
  extendedCost: number
  utilizationProvenance: UtilizationProvenance | null
}

export interface PeriodTotal {
  periodLabel: string
  hours: number
  extendedCost: number
}

export interface ScenarioTotals {
  total: number
  totalCents: number
  totalHours: number
  lineCount: number
  periodTotals: PeriodTotal[]
}

export interface EngineFlags {
  needsUtilizationBackfill: boolean
}

interface PricingLinesResponse {
  lines: PricingLine[]
  totals: ScenarioTotals
  rateConfig: RateConfigSnapshot
  engineFlags: EngineFlags
}

/**
 * Hook for fetching pricing lines for a scenario.
 *
 * Single-source principle: totals are computed server-side from the fetched rows.
 */
export function usePricingLines(proposalId: string, scenarioId: string | null) {
  const [lines, setLines] = useState<PricingLine[]>([])
  const [totals, setTotals] = useState<ScenarioTotals | null>(null)
  const [rateConfig, setRateConfig] = useState<RateConfigSnapshot | null>(null)
  const [engineFlags, setEngineFlags] = useState<EngineFlags | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLines = useCallback(async () => {
    if (!proposalId || !scenarioId) {
      setLines([])
      setTotals(null)
      setRateConfig(null)
      setEngineFlags(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/pricing/${scenarioId}/lines`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch lines')
      }

      const data: PricingLinesResponse = await response.json()
      setLines(data.lines)
      setTotals(data.totals)
      setRateConfig(data.rateConfig)
      setEngineFlags(data.engineFlags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lines')
    } finally {
      setIsLoading(false)
    }
  }, [proposalId, scenarioId])

  useEffect(() => {
    fetchLines()
  }, [fetchLines])

  // Client-side verification: sum of line extended costs should match totals.total
  // This enforces the single-source principle
  const verifyConservation = useCallback((): boolean => {
    if (!lines.length || !totals) return true

    const clientSum = lines.reduce((sum, line) => sum + line.extendedCost, 0)
    const clientSumCents = Math.round(clientSum * 100)

    return clientSumCents === totals.totalCents
  }, [lines, totals])

  return {
    lines,
    totals,
    rateConfig,
    engineFlags,
    isLoading,
    error,
    refetch: fetchLines,
    verifyConservation,
  }
}

export default usePricingLines
