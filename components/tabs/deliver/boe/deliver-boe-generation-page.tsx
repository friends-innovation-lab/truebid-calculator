'use client'

import { useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useBOEArtifacts } from '@/hooks/use-boe-artifacts'
import { PreFlightPanel } from './pre-flight-panel'
import { CitationWorklist } from './citation-worklist'
import { ArtifactList } from './artifact-list'
import { ArtifactViewer } from './artifact-viewer'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Plus } from 'lucide-react'

/**
 * Main BOE Generation & Artifacts page.
 *
 * Orchestrates 6 states:
 * 1. Pre-flight panel (gate checklist before generation)
 * 2. CITATION_INCOMPLETE worklist (error as actionable list)
 * 3. Artifact viewer (read-only document with provenance)
 * 4. Generation succeeded (new artifact appears)
 * 5. Snapshot creation entry (minimal form)
 * 6. Citations walkable (folded into viewer)
 */
export function DeliverBoeGenerationPage() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
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
    clearCitationError,
  } = useBOEArtifacts(proposalId)

  const handleNavigate = useCallback((viewId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', viewId)
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const handleGenerate = useCallback(async () => {
    const result = await generateArtifact()
    if (result) {
      // Load the newly generated artifact
      await loadArtifact(result.artifactId)
    }
  }, [generateArtifact, loadArtifact])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-muted-foreground">Loading BOE artifacts...</span>
      </div>
    )
  }

  // Error state
  if (error && !citationError) {
    return (
      <div className="flex-1 p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <Button variant="link" onClick={refresh} className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Check if all preconditions are met
  const allPreconditionsMet =
    preconditions?.intelligenceConfirmed &&
    preconditions?.wbsActive &&
    preconditions?.scenarioApproved &&
    preconditions?.citationCoverage.allCited

  // Has any generated artifacts?
  const hasGeneratedArtifacts = artifacts.some((a) => a.status === 'generated')

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">BOE Artifacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate and view Basis of Estimate documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {hasGeneratedArtifacts && allPreconditionsMet && (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    New Artifact
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* CITATION_INCOMPLETE error worklist */}
        {citationError && (
          <CitationWorklist
            uncitedLines={citationError.details.uncitedLines}
            onDismiss={clearCitationError}
          />
        )}

        {/* Main content */}
        {artifacts.length === 0 ? (
          // State 1: No artifacts - show pre-flight panel
          <div className="flex items-center justify-center py-12">
            {preconditions && (
              <PreFlightPanel
                preconditions={preconditions}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                onNavigate={handleNavigate}
              />
            )}
          </div>
        ) : (
          // States 3-6: Artifacts exist - show list + viewer
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Artifact list (sidebar) */}
            <div className="lg:col-span-1">
              <div className="sticky top-0">
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Artifacts ({artifacts.length})
                </h2>
                <ArtifactList
                  artifacts={artifacts}
                  selectedId={selectedArtifact?.id ?? null}
                  onSelect={loadArtifact}
                />

                {/* Pre-flight panel if no generated artifacts */}
                {!hasGeneratedArtifacts && preconditions && (
                  <div className="mt-6">
                    <PreFlightPanel
                      preconditions={preconditions}
                      onGenerate={handleGenerate}
                      isGenerating={isGenerating}
                      onNavigate={handleNavigate}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Artifact viewer (main content) */}
            <div className="lg:col-span-3">
              {selectedArtifact ? (
                <ArtifactViewer
                  artifact={selectedArtifact}
                  citations={citations}
                />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  Select an artifact to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeliverBoeGenerationPage
