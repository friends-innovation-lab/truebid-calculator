'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Check, X, HelpCircle, Sparkles, ArrowRight } from 'lucide-react'
import { proposalsApi } from '@/lib/api'
import { useAppContext } from '@/contexts/app-context'

// ==================== TYPES ====================

type BidDecision = 'bid' | 'no_bid' | 'undecided'

interface CompetitiveContext {
  incumbent: string
  ourRole: string
  keyCompetitors: string
  pastPerformanceFit: string
}

interface StrategyData {
  bidDecision: BidDecision
  winThemes: [string, string, string]
  competitiveContext: CompetitiveContext
  notes: string
}

const DEFAULT_STRATEGY: StrategyData = {
  bidDecision: 'undecided',
  winThemes: ['', '', ''],
  competitiveContext: {
    incumbent: '',
    ourRole: '',
    keyCompetitors: '',
    pastPerformanceFit: '',
  },
  notes: '',
}

// ==================== DECISION CARD ====================

interface DecisionCardProps {
  type: 'bid' | 'no_bid' | 'undecided'
  selected: boolean
  onClick: () => void
}

function DecisionCard({ type, selected, onClick }: DecisionCardProps) {
  const configs = {
    bid: {
      icon: Check,
      label: 'Bid',
      subtitle: "We're pursuing this opportunity",
      defaultBg: '#FAFAF9',
      defaultBorder: '#E8E7E2',
      activeBg: '#111110',
      activeBorder: '#111110',
      activeIconBg: 'rgba(245,194,0,0.15)',
      activeIconColor: '#F5C200',
      activeLabel: '#FFFFFF',
      activeSubtitle: 'rgba(255,255,255,0.45)',
    },
    no_bid: {
      icon: X,
      label: 'No Bid',
      subtitle: "We're passing on this one",
      defaultBg: '#FAFAF9',
      defaultBorder: '#E8E7E2',
      activeBg: '#FCEBEB',
      activeBorder: '#F09595',
      activeIconBg: 'rgba(163,45,45,0.1)',
      activeIconColor: '#A32D2D',
      activeLabel: '#501313',
      activeSubtitle: '#791F1F',
    },
    undecided: {
      icon: HelpCircle,
      label: 'Undecided',
      subtitle: 'Still evaluating the fit',
      defaultBg: '#FAFAF9',
      defaultBorder: '#D4D3CE',
      activeBg: '#FAFAF9',
      activeBorder: '#D4D3CE',
      activeIconBg: 'rgba(155,154,149,0.15)',
      activeIconColor: '#6B6A65',
      activeLabel: '#111110',
      activeSubtitle: '#6B6A65',
    },
  }

  const config = configs[type]
  const Icon = config.icon
  const isUndecided = type === 'undecided'

  return (
    <button
      onClick={onClick}
      className="flex-1 text-center cursor-pointer transition-all"
      style={{
        padding: '20px 16px',
        borderRadius: '10px',
        border: isUndecided
          ? `1.5px dashed ${selected ? config.activeBorder : config.defaultBorder}`
          : `1.5px solid ${selected ? config.activeBorder : config.defaultBorder}`,
        backgroundColor: selected ? config.activeBg : config.defaultBg,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#D4D3CE'
          e.currentTarget.style.backgroundColor = '#F4F3EF'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = config.defaultBorder
          e.currentTarget.style.backgroundColor = config.defaultBg
        }
      }}
    >
      {/* Icon */}
      <div
        className="mx-auto mb-2.5 flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: selected ? config.activeIconBg : 'rgba(155,154,149,0.1)',
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: selected ? config.activeIconColor : '#6B6A65' }}
        />
      </div>

      {/* Label */}
      <div
        className="mb-0.5"
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: selected ? config.activeLabel : '#111110',
        }}
      >
        {config.label}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: selected ? config.activeSubtitle : '#6B6A65',
        }}
      >
        {config.subtitle}
      </div>
    </button>
  )
}

// ==================== EDITABLE BOX ====================

interface EditableBoxProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function EditableBox({ label, value, onChange, placeholder = 'Not specified' }: EditableBoxProps) {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  return (
    <div
      style={{
        backgroundColor: '#FAFAF9',
        border: '0.5px solid #E8E7E2',
        borderRadius: 7,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#6B6A65',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              setIsEditing(false)
            }
          }}
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#111110',
          }}
          placeholder={placeholder}
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="cursor-pointer"
          style={{
            fontSize: 13,
            fontWeight: value ? 500 : 400,
            fontStyle: value ? 'normal' : 'italic',
            color: value ? '#111110' : '#C4C3BE',
          }}
        >
          {value || placeholder}
        </div>
      )}
    </div>
  )
}

// ==================== SAVE STATUS ====================

interface SaveStatusProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

function SaveStatusIndicator({ status }: SaveStatusProps) {
  if (status === 'idle') return null

  const configs = {
    saving: { color: '#F5C200', text: 'Saving...' },
    saved: { color: '#639922', text: 'Saved' },
    error: { color: '#A32D2D', text: 'Failed to save' },
  }

  const config = configs[status]

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      <span style={{ fontSize: 11, color: config.color }}>
        {config.text}
      </span>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function Strategy() {
  const params = useParams()
  const proposalId = params?.id as string
  const { solicitation } = useAppContext()

  const [strategy, setStrategy] = useState<StrategyData>(DEFAULT_STRATEGY)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)

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
          // Merge with defaults to ensure all fields exist
          const loaded = response.proposal.strategy
          setStrategy({
            bidDecision: loaded.bidDecision || 'undecided',
            winThemes: loaded.winThemes || ['', '', ''],
            competitiveContext: {
              incumbent: loaded.competitiveContext?.incumbent || '',
              ourRole: loaded.competitiveContext?.ourRole || '',
              keyCompetitors: loaded.competitiveContext?.keyCompetitors || '',
              pastPerformanceFit: loaded.competitiveContext?.pastPerformanceFit || '',
            },
            notes: loaded.notes || '',
          })
        }
      } catch (error) {
        console.warn('[Strategy] Failed to load:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStrategy()
  }, [proposalId])

  // Auto-save with debounce
  const saveStrategy = useCallback(async (data: StrategyData) => {
    if (!proposalId) return

    setSaveStatus('saving')
    try {
      await proposalsApi.update(proposalId, { strategy: data })
      setSaveStatus('saved')
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
      }, 500)

      return updated
    })
  }, [saveStrategy])

  const updateWinTheme = (index: number, value: string) => {
    const updated = [...strategy.winThemes] as [string, string, string]
    updated[index] = value
    updateStrategy({ winThemes: updated })
  }

  const updateCompetitiveContext = (field: keyof CompetitiveContext, value: string) => {
    updateStrategy({
      competitiveContext: {
        ...strategy.competitiveContext,
        [field]: value,
      },
    })
  }

  // Check if AI suggestions should show (when solicitation has been analyzed and themes are empty)
  const showAISuggestion = solicitation?.analyzedFromDocument && strategy.winThemes.some(t => !t.trim())

  const handleGenerateSuggestions = async () => {
    setIsGeneratingSuggestions(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/generate-win-themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { winThemes } = await res.json()
      updateStrategy({ winThemes: winThemes as [string, string, string] })
    } catch {
      console.error('[Strategy] Win theme generation failed')
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#E8E7E2] border-t-[#111110] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: 720,
        padding: '48px 56px',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: 40 }}>
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#C4C3BE',
            marginBottom: 8,
          }}
        >
          Scope · Strategy
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#111110',
            letterSpacing: '-0.7px',
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          Are we bidding?
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#6B6A65',
            lineHeight: 1.5,
          }}
        >
          Make the call, set your win themes. This shapes how TrueBid coaches your proposal from here on.
        </p>
      </div>

      {/* Section 1: Decision */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: '#6B6A65',
            marginBottom: 14,
          }}
        >
          Decision
        </div>

        <div className="grid grid-cols-3" style={{ gap: 10 }}>
          <DecisionCard
            type="bid"
            selected={strategy.bidDecision === 'bid'}
            onClick={() => updateStrategy({ bidDecision: 'bid' })}
          />
          <DecisionCard
            type="no_bid"
            selected={strategy.bidDecision === 'no_bid'}
            onClick={() => updateStrategy({ bidDecision: 'no_bid' })}
          />
          <DecisionCard
            type="undecided"
            selected={strategy.bidDecision === 'undecided'}
            onClick={() => updateStrategy({ bidDecision: 'undecided' })}
          />
        </div>
      </section>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '0.5px solid #E8E7E2', margin: '40px 0' }} />

      {/* Section 2: Win Themes */}
      <section>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#6B6A65',
            }}
          >
            Win themes
          </div>
          <div style={{ fontSize: 11, color: '#C4C3BE' }}>3 max</div>
        </div>

        <p
          style={{
            fontSize: 13,
            color: '#6B6A65',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          The 2–3 reasons FFTC wins this contract. Be specific — these feed into the AI coaching engine for every section you write.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {strategy.winThemes.map((theme, index) => (
            <div key={index} className="flex items-center" style={{ gap: 10 }}>
              <div
                style={{
                  width: 16,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#C4C3BE',
                }}
              >
                {index + 1}
              </div>
              <input
                type="text"
                value={theme}
                onChange={(e) => updateWinTheme(index, e.target.value)}
                placeholder={
                  index === 0
                    ? "e.g. Our prior DoS Doorway work is directly analogous to what's being requested..."
                    : index === 1
                      ? "e.g. We already have FedRAMP-authorized AWS GovCloud infrastructure in place..."
                      : "Add a third win theme..."
                }
                className="flex-1 outline-none"
                style={{
                  padding: '10px 14px',
                  border: '0.5px solid #E8E7E2',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 400,
                  color: '#111110',
                  backgroundColor: '#FFFFFF',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F5C200'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(245,194,0,0.12)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E7E2'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          ))}
        </div>

        {/* AI Suggestion Nudge */}
        {showAISuggestion && (
          <button
            onClick={handleGenerateSuggestions}
            disabled={isGeneratingSuggestions}
            className="w-full flex items-center cursor-pointer transition-colors"
            style={{
              marginTop: 10,
              backgroundColor: '#F4F3EF',
              borderRadius: 8,
              padding: '12px 14px',
              gap: 10,
              border: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EEECEA'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F4F3EF'
            }}
          >
            {/* Sparkles icon box */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 20,
                height: 20,
                backgroundColor: '#111110',
                borderRadius: 5,
              }}
            >
              <Sparkles className="w-3 h-3" style={{ color: '#F5C200' }} />
            </div>

            {/* Text */}
            <div className="flex-1 text-left" style={{ fontSize: 12, color: '#5F5E5A' }}>
              {isGeneratingSuggestions
                ? 'Generating suggestions...'
                : 'AI suggestion: Based on the solicitation, technical approach and past performance are highest-weight. Want suggested win themes?'
              }
            </div>

            {/* Arrow */}
            {!isGeneratingSuggestions && (
              <ArrowRight className="w-3 h-3 shrink-0" style={{ color: '#C4C3BE' }} />
            )}
          </button>
        )}
      </section>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '0.5px solid #E8E7E2', margin: '40px 0' }} />

      {/* Section 3: Competitive Context */}
      <section>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#6B6A65',
            }}
          >
            Competitive context
          </div>
          <div style={{ fontSize: 11, color: '#C4C3BE' }}>Optional</div>
        </div>

        <p
          style={{
            fontSize: 13,
            color: '#6B6A65',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          Quick context that informs how you position the proposal.
        </p>

        <div className="grid grid-cols-2" style={{ gap: 8 }}>
          <EditableBox
            label="Incumbent"
            value={strategy.competitiveContext.incumbent}
            onChange={(v) => updateCompetitiveContext('incumbent', v)}
          />
          <EditableBox
            label="Our role"
            value={strategy.competitiveContext.ourRole}
            onChange={(v) => updateCompetitiveContext('ourRole', v)}
          />
          <EditableBox
            label="Key competitors"
            value={strategy.competitiveContext.keyCompetitors}
            onChange={(v) => updateCompetitiveContext('keyCompetitors', v)}
          />
          <EditableBox
            label="Past performance fit"
            value={strategy.competitiveContext.pastPerformanceFit}
            onChange={(v) => updateCompetitiveContext('pastPerformanceFit', v)}
          />
        </div>
      </section>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '0.5px solid #E8E7E2', margin: '40px 0' }} />

      {/* Section 4: Notes */}
      <section>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#6B6A65',
            }}
          >
            Notes
          </div>
          <div style={{ fontSize: 11, color: '#C4C3BE' }}>Internal only</div>
        </div>

        <textarea
          value={strategy.notes}
          onChange={(e) => updateStrategy({ notes: e.target.value })}
          placeholder="Anything the team should know before writing begins — intel from industry day, relationship context, risks..."
          className="w-full resize-y outline-none"
          style={{
            padding: '12px 14px',
            border: '0.5px solid #E8E7E2',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 400,
            color: '#111110',
            lineHeight: 1.6,
            minHeight: 96,
            backgroundColor: '#FFFFFF',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#F5C200'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(245,194,0,0.12)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E8E7E2'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />

        {/* Save status */}
        <div className="mt-2">
          <SaveStatusIndicator status={saveStatus} />
        </div>
      </section>
    </div>
  )
}

export default Strategy
