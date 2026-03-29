'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Sparkles,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ==================== TYPES ====================

interface CoachingScores {
  understanding: number
  approach: number
  proof: number
  risk_mitigation: number
  win_theme_alignment: number
}

interface FeedbackItem {
  category: string
  severity: 'critical' | 'important' | 'suggestion'
  issue: string
  recommendation: string
  example?: string
}

interface CoachingResult {
  id?: string
  scores: CoachingScores
  overall_assessment: string
  feedback: FeedbackItem[]
  generatedAt?: string
  contentSnapshot?: string
}

interface CoachingPanelProps {
  proposalId: string
  sectionId: string
  sectionTitle: string
  hasContent: boolean
  onClose: () => void
}

const SCORE_LABELS: Record<keyof CoachingScores, string> = {
  understanding: 'Understanding',
  approach: 'Approach',
  proof: 'Proof',
  risk_mitigation: 'Risk Mitigation',
  win_theme_alignment: 'Win Theme Alignment',
}

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  important: { label: 'Important', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  suggestion: { label: 'Suggestion', color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

// ==================== MAIN COMPONENT ====================

export function CoachingPanel({
  proposalId,
  sectionId,
  sectionTitle,
  hasContent,
  onClose,
}: CoachingPanelProps) {
  const [coaching, setCoaching] = useState<CoachingResult | null>(null)
  const [history, setHistory] = useState<CoachingResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Load coaching history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch(
          `/api/proposals/${proposalId}/sections/${sectionId}/coach`
        )
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history || [])
          setIsStale(data.isStale || false)
          if (data.history?.length > 0) {
            setCoaching(data.history[0])
          }
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [proposalId, sectionId])

  // Run coaching analysis
  const runCoaching = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/sections/${sectionId}/coach`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to run coaching')
      }

      const data = await response.json()
      setCoaching(data.coaching)
      setIsStale(false)
      // Add to history
      setHistory(prev => [data.coaching, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run coaching')
    } finally {
      setIsLoading(false)
    }
  }, [proposalId, sectionId])

  // Calculate average score
  const averageScore = coaching?.scores
    ? Object.values(coaching.scores).reduce((a, b) => a + b, 0) / 5
    : 0

  // Get score color
  const getScoreColor = (score: number) => {
    if (score <= 2) return 'bg-red-500'
    if (score === 3) return 'bg-amber-500'
    return 'bg-green-500'
  }

  const getScoreBarWidth = (score: number) => `${(score / 5) * 100}%`

  // Sort feedback by severity
  const sortedFeedback = coaching?.feedback
    ? [...coaching.feedback].sort((a, b) => {
        const order = { critical: 0, important: 1, suggestion: 2 }
        return order[a.severity] - order[b.severity]
      })
    : []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[560px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Section Coaching</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">
              {sectionTitle}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close coaching panel"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error state */}
          {error && (
            <ErrorAlert
              variant="form"
              title="Coaching failed"
              message={error}
              onRetry={runCoaching}
            />
          )}

          {/* Loading history state */}
          {isLoadingHistory && !coaching && !error && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state - no coaching run yet */}
          {!isLoadingHistory && !coaching && !isLoading && !error && (
            <EmptyState
              icon={Sparkles}
              title="Get section feedback"
              description="The coaching engine evaluates your writing against Shipley methodology, the RFP's evaluation criteria, and your win themes."
              action={
                hasContent
                  ? { label: 'Analyze Section', onClick: runCoaching }
                  : undefined
              }
            />
          )}

          {!hasContent && !coaching && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Write some content first before running coaching.
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  Reading your section against Shipley methodology...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This may take 15-30 seconds
                </p>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {coaching && !isLoading && (
            <div className="space-y-6">
              {/* Stale warning */}
              {isStale && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800">
                      Content has changed since this analysis. Re-run coaching to get updated feedback.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={runCoaching}
                      className="mt-2"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Re-analyze
                    </Button>
                  </div>
                </div>
              )}

              {/* Score Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Scores</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {averageScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500">/5</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {(Object.entries(coaching.scores) as [keyof CoachingScores, number][]).map(
                    ([key, score]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{SCORE_LABELS[key]}</span>
                          <span className="font-medium text-gray-900">{score}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', getScoreColor(score))}
                            style={{ width: getScoreBarWidth(score) }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </Card>

              {/* Overall Assessment */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Overall Assessment
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {coaching.overall_assessment}
                </p>
              </Card>

              {/* Feedback Items */}
              {sortedFeedback.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Feedback ({sortedFeedback.length})
                  </h3>

                  {sortedFeedback.map((item, idx) => (
                    <Card key={idx} className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', SEVERITY_CONFIG[item.severity].color)}
                        >
                          {SEVERITY_CONFIG[item.severity].label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.category}
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-gray-900">
                        {item.issue}
                      </p>

                      <p className="text-sm text-gray-600">
                        {item.recommendation}
                      </p>

                      {item.example && (
                        <div className="pl-3 border-l-2 border-gray-200 mt-2">
                          <p className="text-xs text-gray-500 italic">
                            {item.example}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {/* Run Again Button */}
              {!isStale && (
                <Button
                  variant="outline"
                  onClick={runCoaching}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Again
                </Button>
              )}

              {/* History */}
              {history.length > 1 && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showHistory ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    Previous analyses ({history.length - 1})
                  </button>

                  {showHistory && (
                    <div className="mt-2 space-y-2">
                      {history.slice(1).map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCoaching(item)
                            setIsStale(true) // Previous analyses are always stale
                          }}
                          className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-xs text-gray-500">
                            {item.generatedAt
                              ? new Date(item.generatedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : 'Unknown date'}
                          </p>
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            Score: {(Object.values(item.scores).reduce((a, b) => a + b, 0) / 5).toFixed(1)}/5
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default CoachingPanel
