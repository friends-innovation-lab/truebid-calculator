'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface CandidateData {
  hasCandidate: boolean
  candidateVersionId?: string
  candidateVersionNumber?: number
  candidateStatus?: string
  candidateRowVersion?: number
  generationNote?: string
  createdAt?: string
  hasActive: boolean
  activeVersionId?: string | null
  diff?: {
    totalTasks: number
    addedTasks: number
    changedTasks: number
    removedTasks: number
    conflictTasks: number
    totalConflicts: number
    taskDiffs: {
      status: string
      wbsCode: string
      title: string
      hasUserModifiedConflict: boolean
      assignmentSummary: {
        total: number
        added: number
        changed: number
        conflicts: number
      }
    }[]
  }
}

interface Props {
  proposalId: string
  onAccepted?: () => void
  onDiscarded?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function WbsCandidateReview({ proposalId, onAccepted, onDiscarded }: Props) {
  const [data, setData] = useState<CandidateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const fetchCandidate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/wbs/candidate`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      console.error('Failed to fetch candidate')
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    fetchCandidate()
  }, [fetchCandidate])

  const handleAccept = async () => {
    if (!data?.candidateVersionId || !data?.candidateRowVersion) return

    setAccepting(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/wbs/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          candidateVersionId: data.candidateVersionId,
          expectedRowVersion: data.candidateRowVersion,
          // Default: keep user modifications on conflicts
          conflictResolutions: [],
        }),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(`WBS v${data.candidateVersionNumber} accepted`, {
          description: result.conflictsResolved > 0
            ? `${result.conflictsResolved} user modifications preserved`
            : undefined,
        })
        onAccepted?.()
        fetchCandidate() // Refresh to show no candidate
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to accept candidate')
      }
    } catch {
      toast.error('Failed to accept candidate')
    } finally {
      setAccepting(false)
    }
  }

  const handleDiscard = async () => {
    if (!data?.candidateVersionId || !data?.candidateRowVersion) return

    setDiscarding(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/wbs/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discard',
          candidateVersionId: data.candidateVersionId,
          expectedRowVersion: data.candidateRowVersion,
        }),
      })

      if (res.ok) {
        toast.success('WBS candidate discarded')
        onDiscarded?.()
        fetchCandidate()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to discard candidate')
      }
    } catch {
      toast.error('Failed to discard candidate')
    } finally {
      setDiscarding(false)
    }
  }

  // Don't render if no candidate
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border border-blue-200">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-600" />
        <span className="text-sm text-blue-700">Loading candidate...</span>
      </div>
    )
  }

  if (!data?.hasCandidate) {
    return null // No candidate to review
  }

  const diff = data.diff!

  return (
    <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-amber-900">
            WBS Candidate v{data.candidateVersionNumber}
          </span>
          <Badge variant="outline" className="text-amber-700 border-amber-300">
            {data.candidateStatus === 'generated_candidate' ? 'Generated' : 'Draft'}
          </Badge>
        </div>
        <span className="text-xs text-amber-600">
          {data.generationNote}
        </span>
      </div>

      {/* Diff Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-green-600" />
          <span className="text-sm">
            <span className="font-medium">{diff.addedTasks}</span>
            <span className="text-gray-500"> added</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-sm">
            <span className="font-medium">{diff.changedTasks}</span>
            <span className="text-gray-500"> changed</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus className="w-3.5 h-3.5 text-red-600" />
          <span className="text-sm">
            <span className="font-medium">{diff.removedTasks}</span>
            <span className="text-gray-500"> removed</span>
          </span>
        </div>
        {diff.totalConflicts > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-sm">
              <span className="font-medium">{diff.totalConflicts}</span>
              <span className="text-gray-500"> conflicts</span>
            </span>
          </div>
        )}
      </div>

      {/* Conflict Warning */}
      {diff.totalConflicts > 0 && (
        <div className="bg-orange-100 rounded-md p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <span className="font-medium">{diff.totalConflicts} conflicts detected.</span>
            {' '}Your manual edits will be preserved when you accept this candidate.
          </div>
        </div>
      )}

      {/* Task List Preview */}
      {diff.taskDiffs.length > 0 && diff.taskDiffs.length <= 10 && (
        <div className="mb-4 max-h-48 overflow-y-auto">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Changes ({diff.totalTasks} tasks)
          </div>
          <div className="space-y-1">
            {diff.taskDiffs
              .filter(t => t.status !== 'unchanged')
              .slice(0, 8)
              .map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-white/50"
                >
                  {task.status === 'added' && <Plus className="w-3 h-3 text-green-600" />}
                  {task.status === 'changed' && <RefreshCw className="w-3 h-3 text-blue-600" />}
                  {task.status === 'removed' && <Minus className="w-3 h-3 text-red-600" />}
                  {task.status === 'conflict' && <AlertTriangle className="w-3 h-3 text-orange-600" />}
                  <span className="text-gray-500">{task.wbsCode}</span>
                  <span className="truncate">{task.title}</span>
                  {task.hasUserModifiedConflict && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      edited
                    </Badge>
                  )}
                </div>
              ))}
            {diff.taskDiffs.filter(t => t.status !== 'unchanged').length > 8 && (
              <div className="text-xs text-gray-500 pl-2">
                + {diff.taskDiffs.filter(t => t.status !== 'unchanged').length - 8} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAccept}
          disabled={accepting || discarding}
          className="bg-green-600 hover:bg-green-700"
        >
          {accepting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-4 h-4 mr-2" />
          )}
          Accept Candidate
        </Button>
        <Button
          variant="outline"
          onClick={handleDiscard}
          disabled={accepting || discarding}
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          {discarding ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          Discard
        </Button>
      </div>
    </div>
  )
}
