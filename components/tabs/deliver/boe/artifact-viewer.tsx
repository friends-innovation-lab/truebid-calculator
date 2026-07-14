'use client'

import { useCallback } from 'react'
import { ArtifactProvenanceHeader } from './artifact-provenance-header'
import { ArtifactEstimatesTable } from './artifact-estimates-table'
import { ArtifactTotalsSummary } from './artifact-totals-summary'
import type { BOEArtifactDetail, BOECitation } from '@/hooks/use-boe-artifacts'

interface ArtifactViewerProps {
  artifact: BOEArtifactDetail
  citations: BOECitation[]
}

/**
 * Artifact viewer component.
 *
 * VIEWER FETCH RULE: This component renders from ONE fetch of the stored
 * artifact row (content JSONB + joined boe_citations). No reads of live
 * pricing_lines anywhere in this path. The viewer is a pure render of
 * immutable stored data.
 */
export function ArtifactViewer({ artifact, citations }: ArtifactViewerProps) {
  const content = artifact.content

  // Extract sections
  const wbsEstimatesSection = content.sections.find(
    (s) => s.sectionType === 'wbs_estimates'
  )
  const laborLoadingSection = content.sections.find(
    (s) => s.sectionType === 'labor_loading_summary'
  )

  const handleCitationClick = useCallback((requirementLinkId: string) => {
    // Navigate to requirement view with the requirement link
    // This would show the requirement + source quote
    // For now, just navigate to requirements view
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'requirements')
    url.searchParams.set('linkId', requirementLinkId)
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return (
    <div className="space-y-6">
      {/* Provenance header - rendered first per contract */}
      <ArtifactProvenanceHeader artifact={artifact} />

      {/* WBS Estimates */}
      {wbsEstimatesSection?.lines && wbsEstimatesSection.lines.length > 0 && (
        <ArtifactEstimatesTable
          lines={wbsEstimatesSection.lines}
          rateConfig={content.rateConfig}
          citations={citations}
          title="WBS Estimates"
          onCitationClick={handleCitationClick}
        />
      )}

      {/* Labor Loading */}
      {laborLoadingSection?.lines && laborLoadingSection.lines.length > 0 && (
        <ArtifactEstimatesTable
          lines={laborLoadingSection.lines}
          rateConfig={content.rateConfig}
          citations={citations}
          title="Labor Loading Summary"
          onCitationClick={handleCitationClick}
        />
      )}

      {/* Totals Summary */}
      <ArtifactTotalsSummary
        totals={content.totals}
        conservation={content.conservation}
      />
    </div>
  )
}
