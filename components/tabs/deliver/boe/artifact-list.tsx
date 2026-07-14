'use client'

import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { BOEArtifactSummary } from '@/hooks/use-boe-artifacts'

interface ArtifactListProps {
  artifacts: BOEArtifactSummary[]
  selectedId: string | null
  onSelect: (artifactId: string) => void
}

/**
 * Artifact list sidebar component.
 * Shows all artifacts for the proposal with status badges.
 */
export function ArtifactList({ artifacts, selectedId, onSelect }: ArtifactListProps) {
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const truncateHash = (hash: string) => {
    return hash.slice(0, 8)
  }

  if (artifacts.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">
          No artifacts generated yet
        </p>
      </Card>
    )
  }

  // Sort: generated first, then by date descending
  const sortedArtifacts = [...artifacts].sort((a, b) => {
    if (a.status === 'generated' && b.status !== 'generated') return -1
    if (a.status !== 'generated' && b.status === 'generated') return 1
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  })

  return (
    <div className="space-y-2">
      {sortedArtifacts.map((artifact) => (
        <Card
          key={artifact.id}
          className={cn(
            'p-3 cursor-pointer transition-colors',
            selectedId === artifact.id
              ? 'bg-blue-50 border-blue-200'
              : 'hover:bg-gray-50'
          )}
          onClick={() => onSelect(artifact.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={artifact.status as 'generated' | 'superseded'}
                />
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {truncateHash(artifact.contentHash)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                {formatDate(artifact.generatedAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                v{artifact.engineVersion}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
