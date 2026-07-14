'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BOEArtifactContent } from '@/lib/schemas/boe-artifact'
import type { UncitedLineDetail } from '@/lib/commands/boe/types'

// Types for API responses
export interface BOEPreconditions {
  intelligenceConfirmed: boolean
  wbsActive: boolean
  scenarioApproved: boolean
  citationCoverage: {
    total: number
    cited: number
    allCited: boolean
  }
  confirmedIntelVersionId: string | null
  activeWbsVersionId: string | null
  approvedScenarioId: string | null
}

export interface BOEArtifactSummary {
  id: string
  status: 'generated' | 'superseded'
  contentHash: string
  engineVersion: string
  generatedAt: string
  generatedBy: string | null
  supersededAt: string | null
  intelligenceVersionId: string
  wbsVersionId: string
  pricingScenarioId: string
}

export interface BOEArtifactDetail {
  id: string
  proposalId: string
  intelligenceVersionId: string
  intelligenceHash: string | null
  wbsVersionId: string
  pricingScenarioId: string
  status: 'generated' | 'superseded'
  content: BOEArtifactContent
  contentHash: string
  engineVersion: string
  generatedAt: string
  generatedBy: string | null
  generatedByName: string | null
  supersededAt: string | null
  rowVersion: number
}

export interface BOECitation {
  artifactLineId: string
  citationTargetType: 'requirement_link'
  requirementLinkId: string
}

export interface GenerateResult {
  artifactId: string
  contentHash: string
  engineVersion: string
  lineCount: number
  citationCount: number
  totals: {
    wbsEstimateTotal: number
    laborLoadingTotal: number
    grandTotal: number
  }
  conservation: {
    allConserved: boolean
  }
  generatedAt: string
}

export interface CitationIncompleteError {
  code: 'CITATION_INCOMPLETE'
  message: string
  details: {
    uncitedLines: UncitedLineDetail[]
  }
}

export function useBOEArtifacts(proposalId: string) {
  const [preconditions, setPreconditions] = useState<BOEPreconditions | null>(null)
  const [artifacts, setArtifacts] = useState<BOEArtifactSummary[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<BOEArtifactDetail | null>(null)
  const [citations, setCitations] = useState<BOECitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [citationError, setCitationError] = useState<CitationIncompleteError | null>(null)

  // Load preconditions
  const loadPreconditions = useCallback(async () => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/boe/preconditions`)
      if (!response.ok) {
        throw new Error('Failed to load preconditions')
      }
      const data = await response.json()
      setPreconditions(data)
    } catch (err) {
      console.error('[useBOEArtifacts] Preconditions error:', err)
      setError('Failed to load preconditions')
    }
  }, [proposalId])

  // Load artifacts list
  const loadArtifacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}/boe/artifacts`)
      if (!response.ok) {
        throw new Error('Failed to load artifacts')
      }
      const data = await response.json()
      setArtifacts(data.artifacts)
    } catch (err) {
      console.error('[useBOEArtifacts] Artifacts error:', err)
      setError('Failed to load artifacts')
    }
  }, [proposalId])

  // Load single artifact
  const loadArtifact = useCallback(
    async (artifactId: string) => {
      try {
        const response = await fetch(
          `/api/proposals/${proposalId}/boe/artifacts/${artifactId}`
        )
        if (!response.ok) {
          throw new Error('Failed to load artifact')
        }
        const data = await response.json()
        setSelectedArtifact(data.artifact)
        setCitations(data.citations)
      } catch (err) {
        console.error('[useBOEArtifacts] Artifact detail error:', err)
        setError('Failed to load artifact')
      }
    },
    [proposalId]
  )

  // Generate artifact
  const generateArtifact = useCallback(async (): Promise<GenerateResult | null> => {
    if (!preconditions?.approvedScenarioId) {
      setError('No approved scenario available')
      return null
    }

    setIsGenerating(true)
    setCitationError(null)
    setError(null)

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/boe/artifacts/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pricingScenarioId: preconditions.approvedScenarioId,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'CITATION_INCOMPLETE') {
          setCitationError({
            code: 'CITATION_INCOMPLETE',
            message: data.error,
            details: data.details,
          })
          return null
        }
        throw new Error(data.error || 'Failed to generate artifact')
      }

      // Refresh artifacts list
      await loadArtifacts()

      return data as GenerateResult
    } catch (err) {
      console.error('[useBOEArtifacts] Generate error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate artifact')
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [proposalId, preconditions, loadArtifacts])

  // Supersede artifact
  const supersedeArtifact = useCallback(
    async (artifactId: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/proposals/${proposalId}/boe/artifacts/${artifactId}/supersede`,
          { method: 'POST' }
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to supersede artifact')
        }

        // Refresh artifacts list
        await loadArtifacts()
        return true
      } catch (err) {
        console.error('[useBOEArtifacts] Supersede error:', err)
        setError(err instanceof Error ? err.message : 'Failed to supersede artifact')
        return false
      }
    },
    [proposalId, loadArtifacts]
  )

  // Refresh all data
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setCitationError(null)

    await Promise.all([loadPreconditions(), loadArtifacts()])

    setIsLoading(false)
  }, [loadPreconditions, loadArtifacts])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Select first generated artifact by default
  useEffect(() => {
    if (!selectedArtifact && artifacts.length > 0) {
      const generated = artifacts.find((a) => a.status === 'generated')
      if (generated) {
        loadArtifact(generated.id)
      }
    }
  }, [artifacts, selectedArtifact, loadArtifact])

  return {
    preconditions,
    artifacts,
    selectedArtifact,
    citations,
    isLoading,
    isGenerating,
    error,
    citationError,
    refresh,
    loadArtifact,
    generateArtifact,
    supersedeArtifact,
    clearCitationError: () => setCitationError(null),
  }
}
