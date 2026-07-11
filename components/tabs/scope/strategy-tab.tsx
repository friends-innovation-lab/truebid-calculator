'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SaveStatus } from '@/components/ui/save-status'
import { proposalsApi } from '@/lib/api'
import { Target, Plus, X } from 'lucide-react'

// ==================== TYPES ====================

type BidDecision = 'bid' | 'no-bid' | 'undecided' | null
type CapabilityFit = 'strong' | 'partial' | 'stretch' | null
type CompetitivePosition = 'competitive' | 'need-partners' | 'long-shot' | null
type PastPerformanceStrength = 'strong' | 'adequate' | 'weak' | null

interface StrategyData {
  decision: BidDecision
  decisionRationale: string
  capabilityFit: CapabilityFit
  capabilityNotes: string
  relevantExperience: string
  competitivePosition: CompetitivePosition
  competitiveNotes: string
  potentialPartners: string
  pastPerformanceStrength: PastPerformanceStrength
  relevantContracts: string
  pastPerformanceGaps: string
  winThemes: string[]
}

const DEFAULT_STRATEGY: StrategyData = {
  decision: null,
  decisionRationale: '',
  capabilityFit: null,
  capabilityNotes: '',
  relevantExperience: '',
  competitivePosition: null,
  competitiveNotes: '',
  potentialPartners: '',
  pastPerformanceStrength: null,
  relevantContracts: '',
  pastPerformanceGaps: '',
  winThemes: ['', ''],
}

// ==================== TOGGLE BUTTON ====================

interface ToggleButtonProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  variant?: 'green' | 'red' | 'amber' | 'neutral'
}

function ToggleButton({ selected, onClick, children, variant = 'neutral' }: ToggleButtonProps) {
  const baseClasses = 'flex-1 px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all'

  const variantClasses = {
    green: selected
      ? 'bg-green-50 border-green-500 text-green-700'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
    red: selected
      ? 'bg-red-50 border-red-500 text-red-700'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
    amber: selected
      ? 'bg-amber-50 border-amber-500 text-amber-700'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
    neutral: selected
      ? 'bg-gray-100 border-gray-900 text-gray-900'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  )
}

// ==================== PILL TOGGLE ====================

interface PillToggleProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}

function PillToggle<T extends string>({ value, onChange, options }: PillToggleProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 text-sm font-medium rounded-full border transition-all ${
            value === option.value
              ? 'bg-gray-900 border-gray-900 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function StrategyTab() {
  const params = useParams()
  const proposalId = params?.id as string

  const [strategy, setStrategy] = useState<StrategyData>(DEFAULT_STRATEGY)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasData, setHasData] = useState(false)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load strategy on mount
  useEffect(() => {
    if (!proposalId) return

    async function loadStrategy() {
      try {
        const response = await proposalsApi.get(proposalId) as {
          proposal: { strategy?: StrategyData }
        }
        if (response.proposal?.strategy && Object.keys(response.proposal.strategy).length > 0) {
          setStrategy({ ...DEFAULT_STRATEGY, ...response.proposal.strategy })
          setHasData(true)
        }
      } catch (error) {
        console.warn('[Strategy] Failed to load:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStrategy()
  }, [proposalId])

  // Autosave with debounce
  const saveStrategy = useCallback(async (data: StrategyData) => {
    if (!proposalId) return

    setSaveStatus('saving')
    try {
      await proposalsApi.update(proposalId, { strategy: data })
      setSaveStatus('saved')
      setHasData(true)
    } catch (error) {
      console.error('[Strategy] Save failed:', error)
      setSaveStatus('error')
    }
  }, [proposalId])

  const updateStrategy = useCallback((updates: Partial<StrategyData>) => {
    setStrategy(prev => {
      const updated = { ...prev, ...updates }

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveStrategy(updated)
      }, 1500)

      return updated
    })
  }, [saveStrategy])

  // Win themes handlers
  const addWinTheme = () => {
    if (strategy.winThemes.length >= 5) return
    updateStrategy({ winThemes: [...strategy.winThemes, ''] })
  }

  const removeWinTheme = (index: number) => {
    if (strategy.winThemes.length <= 1) return
    const updated = strategy.winThemes.filter((_, i) => i !== index)
    updateStrategy({ winThemes: updated })
  }

  const updateWinTheme = (index: number, value: string) => {
    const updated = [...strategy.winThemes]
    updated[index] = value
    updateStrategy({ winThemes: updated })
  }

  // Show empty state if no data and not loading
  if (!isLoading && !hasData && !strategy.decision) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Target}
          title="No strategy captured yet"
          description="Start by making your bid decision."
          action={{
            label: 'Start Strategy',
            onClick: () => setHasData(true),
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Strategy</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Capture your bid decision before building the proposal
          </p>
        </div>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Section 1: Go / No-Bid Decision */}
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Go / No-Bid Decision</h3>

        <div className="flex gap-3">
          <ToggleButton
            selected={strategy.decision === 'bid'}
            onClick={() => updateStrategy({ decision: 'bid' })}
            variant="green"
          >
            Bid
          </ToggleButton>
          <ToggleButton
            selected={strategy.decision === 'no-bid'}
            onClick={() => updateStrategy({ decision: 'no-bid' })}
            variant="red"
          >
            No Bid
          </ToggleButton>
          <ToggleButton
            selected={strategy.decision === 'undecided'}
            onClick={() => updateStrategy({ decision: 'undecided' })}
            variant="amber"
          >
            Undecided
          </ToggleButton>
        </div>

        <div className="space-y-2">
          <Label htmlFor="decision-rationale">Decision rationale</Label>
          <Textarea
            id="decision-rationale"
            value={strategy.decisionRationale}
            onChange={(e) => updateStrategy({ decisionRationale: e.target.value })}
            placeholder="Why are we making this call?"
            rows={3}
          />
        </div>
      </Card>

      {/* Section 2: FFTC's Fit */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">FFTC&apos;s Fit</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Do we have the capability to deliver this work?
          </p>
        </div>

        <PillToggle
          value={strategy.capabilityFit}
          onChange={(value) => updateStrategy({ capabilityFit: value })}
          options={[
            { value: 'strong', label: 'Strong fit' },
            { value: 'partial', label: 'Partial fit' },
            { value: 'stretch', label: 'Stretch' },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="capability-notes">Capability notes</Label>
          <Textarea
            id="capability-notes"
            value={strategy.capabilityNotes}
            onChange={(e) => updateStrategy({ capabilityNotes: e.target.value })}
            placeholder="What makes us qualified? Where are the gaps?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="relevant-experience">Relevant past experience</Label>
          <Textarea
            id="relevant-experience"
            value={strategy.relevantExperience}
            onChange={(e) => updateStrategy({ relevantExperience: e.target.value })}
            placeholder="Which past contracts or work is most relevant to this opportunity?"
            rows={3}
          />
        </div>
      </Card>

      {/* Section 3: Competitive Position */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Competitive Position</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Can we compete to win?
          </p>
        </div>

        <PillToggle
          value={strategy.competitivePosition}
          onChange={(value) => updateStrategy({ competitivePosition: value })}
          options={[
            { value: 'competitive', label: 'Competitive' },
            { value: 'need-partners', label: 'Need partners' },
            { value: 'long-shot', label: 'Long shot' },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="competitive-notes">Competitive notes</Label>
          <Textarea
            id="competitive-notes"
            value={strategy.competitiveNotes}
            onChange={(e) => updateStrategy({ competitiveNotes: e.target.value })}
            placeholder="Who else is likely bidding? What's our angle?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="potential-partners">Potential teaming partners</Label>
          <Textarea
            id="potential-partners"
            value={strategy.potentialPartners}
            onChange={(e) => updateStrategy({ potentialPartners: e.target.value })}
            placeholder="Which companies could make us more competitive? What capability do they bring?"
            rows={3}
          />
        </div>
      </Card>

      {/* Section 4: Past Performance */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Past Performance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Can we prime based on past performance?
          </p>
        </div>

        <PillToggle
          value={strategy.pastPerformanceStrength}
          onChange={(value) => updateStrategy({ pastPerformanceStrength: value })}
          options={[
            { value: 'strong', label: 'Strong' },
            { value: 'adequate', label: 'Adequate' },
            { value: 'weak', label: 'Weak' },
          ]}
        />

        <div className="space-y-2">
          <Label htmlFor="relevant-contracts">Relevant contracts</Label>
          <Textarea
            id="relevant-contracts"
            value={strategy.relevantContracts}
            onChange={(e) => updateStrategy({ relevantContracts: e.target.value })}
            placeholder="Which past contracts best support our ability to prime this work? Include contract name, agency, value, and what we delivered."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="past-performance-gaps">Gaps to address</Label>
          <Textarea
            id="past-performance-gaps"
            value={strategy.pastPerformanceGaps}
            onChange={(e) => updateStrategy({ pastPerformanceGaps: e.target.value })}
            placeholder="Any past performance gaps? How will we address them — through partners, mentor-protégé, or other means?"
            rows={3}
          />
        </div>
      </Card>

      {/* Section 5: Win Themes */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Win Themes</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The 2-3 reasons we should win this contract. These will be referenced throughout the proposal.
          </p>
        </div>

        <div className="space-y-3">
          {strategy.winThemes.map((theme, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={theme}
                onChange={(e) => updateWinTheme(index, e.target.value)}
                placeholder={`Win theme ${index + 1}`}
                className="flex-1"
              />
              {strategy.winThemes.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWinTheme(index)}
                  aria-label="Remove win theme"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {strategy.winThemes.length < 5 && (
          <Button variant="outline" size="sm" onClick={addWinTheme}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add win theme
          </Button>
        )}
      </Card>
    </div>
  )
}

export default StrategyTab
