'use client'

import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { proposalsApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { UploadTab } from '@/components/tabs/upload-tab'

// Error boundary for this component
class SolicitationSummaryErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SolicitationSummary] Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-red-600 mb-2">Error loading Solicitation Summary</p>
          <p className="text-sm text-gray-500">{this.state.error?.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

// ==================== TYPES ====================

interface AISummary {
  generated_at: string
  problem_statement: string
  what_they_want: string
  why_it_matters: string
  key_challenges: string[]
  evaluation_emphasis: string
  fftc_relevance: string | null
  win_themes_at_generation?: string[]
}

interface SolicitationSummaryProps {
  onContinue?: () => void
}

// ==================== MAIN COMPONENT ====================

function SolicitationSummaryInner({ onContinue }: SolicitationSummaryProps) {
  const params = useParams()
  const proposalId = params?.id as string

  const { solicitation } = useAppContext()

  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [winThemesChanged, setWinThemesChanged] = useState(false)

  // Load AI summary on mount
  useEffect(() => {
    if (!proposalId) {
      setIsLoading(false)
      return
    }

    async function loadSummary() {
      try {
        const response = await proposalsApi.get(proposalId) as {
          proposal?: {
            aiSummary?: AISummary | null
            strategy?: { winThemes?: string[] } | null
          } | null
        }

        const proposal = response?.proposal
        if (proposal?.aiSummary && typeof proposal.aiSummary === 'object') {
          setAiSummary(proposal.aiSummary)

          // Check if win themes have changed since generation
          const currentThemes = proposal.strategy?.winThemes?.filter((t: string) => t?.trim()) || []
          const generatedThemes = proposal.aiSummary.win_themes_at_generation || []

          if (currentThemes.length > 0 && generatedThemes.length > 0) {
            const themesChanged = JSON.stringify([...currentThemes].sort()) !== JSON.stringify([...generatedThemes].sort())
            setWinThemesChanged(themesChanged)
          }
        }
      } catch (err) {
        console.warn('[SolicitationSummary] Failed to load:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSummary()
  }, [proposalId])

  const generateSummary = async () => {
    if (!proposalId) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/generate-summary`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      setAiSummary(data.summary)
      setWinThemesChanged(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setIsGenerating(false)
      setShowRegenerateConfirm(false)
    }
  }

  const handleRegenerate = () => {
    if (aiSummary) {
      setShowRegenerateConfirm(true)
    } else {
      generateSummary()
    }
  }

  const hasDocument = Boolean(solicitation?.analyzedFromDocument || solicitation?.title)

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* AI Summary Section */}
        {isLoading ? (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="h-6 bg-gray-100 rounded animate-pulse w-48" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            </div>
          </Card>
        ) : isGenerating ? (
          <GeneratingState />
        ) : error ? (
          <ErrorAlert
            variant="page"
            title="Summary Generation Failed"
            message={error}
            onRetry={generateSummary}
          />
        ) : aiSummary ? (
          <SummaryDisplay
            summary={aiSummary}
            onRegenerate={handleRegenerate}
            winThemesChanged={winThemesChanged}
            formatDate={formatDate}
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Generate AI summary"
            description="Get a plain-language breakdown of what the government needs and why it matters — in under 2 minutes of reading."
            action={
              hasDocument
                ? { label: 'Generate Summary', onClick: generateSummary }
                : undefined
            }
          />
        )}

        {/* Generate button tooltip when no document */}
        {!aiSummary && !isGenerating && !hasDocument && (
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Summary
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload an RFP first</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Existing Upload Tab (metadata extraction) */}
        <UploadTab onContinue={onContinue} />

        {/* Regenerate Confirmation Dialog */}
        <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate summary?</DialogTitle>
              <DialogDescription>
                This will replace the current summary with a new AI-generated version.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={generateSummary}>
                Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

// ==================== SUB-COMPONENTS ====================

function GeneratingState() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="p-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Generating AI summary...</p>
          <p className="text-xs text-muted-foreground mt-1">Reading the solicitation</p>
        </div>
        <div className="w-full max-w-xs">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">This may take 10-20 seconds</p>
      </div>
    </Card>
  )
}

interface SummaryDisplayProps {
  summary: AISummary
  onRegenerate: () => void
  winThemesChanged: boolean
  formatDate: (date: string) => string
}

function SummaryDisplay({ summary, onRegenerate, winThemesChanged, formatDate }: SummaryDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Win themes changed notice */}
      {winThemesChanged && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Your win themes have changed since this summary was generated. Consider regenerating
            to update the FFTC relevance section.
          </p>
        </div>
      )}

      {/* Main summary card */}
      <Card className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Generated {formatDate(summary.generated_at)}
            </span>
            <Button variant="ghost" size="sm" onClick={onRegenerate}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Regenerate
            </Button>
          </div>
        </div>

        {/* The problem */}
        <SummarySection title="The problem">
          <p className="text-sm text-gray-700">{summary.problem_statement}</p>
        </SummarySection>

        {/* What they want */}
        <SummarySection title="What they want">
          <p className="text-sm text-gray-700">{summary.what_they_want}</p>
        </SummarySection>

        {/* Why it matters */}
        <SummarySection title="Why it matters">
          <p className="text-sm text-gray-700">{summary.why_it_matters}</p>
        </SummarySection>

        {/* Key challenges */}
        <SummarySection title="Key challenges">
          <div className="flex flex-wrap gap-2">
            {(summary.key_challenges || []).map((challenge, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
              >
                {challenge}
              </span>
            ))}
          </div>
        </SummarySection>

        {/* What evaluators care most about */}
        <SummarySection title="What evaluators care most about">
          <p className="text-sm text-gray-700">{summary.evaluation_emphasis}</p>
        </SummarySection>
      </Card>

      {/* FFTC Relevance card (if exists) */}
      {summary.fftc_relevance && (
        <Card className="p-6 border-l-4 border-l-green-500">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">
              FFTC&apos;s angle on this opportunity
            </h4>
            <p className="text-sm text-gray-700">{summary.fftc_relevance}</p>
            <p className="text-xs text-muted-foreground">
              Based on your win themes from Strategy
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

// Wrapped export with error boundary
export function SolicitationSummary(props: SolicitationSummaryProps) {
  return (
    <SolicitationSummaryErrorBoundary>
      <SolicitationSummaryInner {...props} />
    </SolicitationSummaryErrorBoundary>
  )
}

export default SolicitationSummary
